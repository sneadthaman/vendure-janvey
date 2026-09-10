/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 *
 * Vendure Dynamic Pricing RESTlet
 *
 * Rewritten from the Axim pricing RESTlet. Same pricing hierarchy, but:
 *   - batched: one search resolves every SKU in the request, one more
 *     search pulls the whole price matrix. No record.load per item.
 *   - returns prices in MINOR UNITS (integer cents), which is what
 *     Vendure stores natively.
 *   - returns basePrice (Online Price) alongside the resolved price so
 *     the storefront can show list vs. your price.
 *   - no Axim-specific response shape (inv_mast_uid / variants).
 *
 * Pricing hierarchy (unchanged):
 *   1. Customer Specific Item Pricing (direct price)
 *   2. Customer Specific Item Pricing (pointing at a price level)
 *   3. Customer's assigned Price Level
 *   4. Online Price fallback
 *
 * Assumptions for v1:
 *   - Qty is always 1. Quantity breaks are read but the lowest-minimum
 *     row wins. See resolveLevelPrice() if tiered pricing is added.
 *   - Single currency. The account's base currency column is used.
 *     See CURRENCY note below before enabling multi-currency.
 *   - UOM logic ignored.
 *
 * Request:
 *   {
 *     "customerId": "1234" | "ACME001" | null,   // null/omitted = guest
 *     "skus": ["ABC-123", "XYZ-789"]
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "currencyCode": "USD",
 *     "prices": [
 *       {
 *         "sku": "ABC-123",
 *         "internalId": "5521",
 *         "price": 1299,          // minor units, null if unpriced
 *         "basePrice": 1499,      // Online Price, minor units, may be null
 *         "source": "customer_price_level",
 *         "purchasable": true
 *       }
 *     ],
 *     "remainingUsage": 4930
 *   }
 */

define(['N/search', 'N/record', 'N/log', 'N/runtime'], (search, record, log, runtime) => {

  const ONLINE_PRICE_LEVEL_NAME = 'Online Price';

  /**
   * Vendure sends one request per page of products. Cap the batch so a
   * runaway request can't blow the 5,000-unit RESTlet governance limit
   * or the search filter-expression nesting limit.
   */
  const MAX_SKUS_PER_REQUEST = 100;

  /**
   * CURRENCY: single-currency account. The `pricing` search join exposes a
   * `currency` column; if multi-currency is ever enabled, add it to the
   * columns in fetchPriceMatrix() and key the level map by
   * `${priceLevelId}:${currencyId}` instead of `${priceLevelId}`.
   */
  const CURRENCY_CODE = 'USD';

  // ---------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------

  const post = (requestBody) => {
    try {
      const skus = normalizeSkus(requestBody && requestBody.skus);
      const customerIdentifier = (requestBody && requestBody.customerId) || null;

      if (skus.length === 0) {
        return respond(true, 'no skus supplied', []);
      }

      if (skus.length > MAX_SKUS_PER_REQUEST) {
        return respond(
          false,
          'too many skus: max ' + MAX_SKUS_PER_REQUEST + ' per request',
          []
        );
      }

      const onlinePriceLevelId = findPriceLevelIdByName(ONLINE_PRICE_LEVEL_NAME);

      if (!onlinePriceLevelId) {
        log.error({
          title: 'Vendure Pricing: Online Price level missing',
          details: 'No price level named "' + ONLINE_PRICE_LEVEL_NAME + '"'
        });
      }

      // Guest / logged-out requests skip the customer lookup entirely and
      // fall straight through to Online Price.
      let customer = null;

      if (customerIdentifier) {
        customer = findCustomer(customerIdentifier);

        if (!customer) {
          return respond(false, 'customer not found', []);
        }
      }

      // One search: SKU -> internal id. Kept separate from the pricing
      // search because the `pricing` join is an INNER join — an item with
      // no price rows at all vanishes from those results, and we need to
      // tell "item does not exist" apart from "item has no price".
      const itemsBySku = resolveItems(skus);

      // One search: full price matrix for every resolved item.
      const internalIds = Object.keys(itemsBySku).map((sku) => itemsBySku[sku].internalId);
      const priceMatrix = fetchPriceMatrix(internalIds);

      // One record.load: the customer's item-specific pricing sublist.
      const customerOverrides = customer
        ? getCustomerItemPricing(customer.record)
        : {};

      const prices = skus.map((sku) => {
        const item = itemsBySku[sku];

        if (!item) {
          return buildLine(sku, null, null, null, 'item_not_found');
        }

        const levels = priceMatrix[item.internalId] || {};

        return resolvePrice({
          sku,
          item,
          levels,
          customer,
          customerOverrides,
          onlinePriceLevelId
        });
      });

      return respond(true, 'success', prices);

    } catch (error) {
      log.error({
        title: 'Vendure Pricing RESTlet Error',
        details: error
      });

      return respond(false, error.message || 'unexpected error', []);
    }
  };

  // ---------------------------------------------------------------------
  // Price resolution
  // ---------------------------------------------------------------------

  /**
   * Walk the hierarchy for a single SKU using data already in memory.
   * No governance cost here — everything was fetched in bulk above.
   */
  const resolvePrice = ({
    sku,
    item,
    levels,
    customer,
    customerOverrides,
    onlinePriceLevelId
  }) => {
    const basePrice = resolveLevelPrice(levels, onlinePriceLevelId);
    const override = customerOverrides[String(item.internalId)];

    // 1. Customer-specific item pricing, direct price.
    if (override && override.price !== null) {
      return buildLine(
        sku,
        item.internalId,
        override.price,
        basePrice,
        'customer_specific_item_pricing'
      );
    }

    // 2. Customer-specific item pricing row that points at a price level.
    if (override && override.priceLevelId) {
      const overrideLevelPrice = resolveLevelPrice(levels, override.priceLevelId);

      if (overrideLevelPrice !== null) {
        return buildLine(
          sku,
          item.internalId,
          overrideLevelPrice,
          basePrice,
          'customer_specific_price_level'
        );
      }
    }

    // 3. The customer's assigned price level.
    if (customer && customer.priceLevelId) {
      const customerLevelPrice = resolveLevelPrice(levels, customer.priceLevelId);

      if (customerLevelPrice !== null) {
        return buildLine(
          sku,
          item.internalId,
          customerLevelPrice,
          basePrice,
          'customer_price_level'
        );
      }
    }

    // 4. Online Price fallback.
    if (basePrice !== null) {
      return buildLine(sku, item.internalId, basePrice, basePrice, 'online_price');
    }

    return buildLine(sku, item.internalId, null, null, 'no_price_found');
  };

  /**
   * Pull one price level out of an item's level map.
   *
   * Each level may hold several quantity-break rows. v1 assumes qty 1, so
   * the row with the lowest minimum quantity wins. If tiered pricing is
   * added later, this is the only function that needs to change — pass the
   * requested quantity in and pick the highest minimum <= that quantity.
   */
  const resolveLevelPrice = (levels, priceLevelId) => {
    if (!priceLevelId) return null;

    const rows = levels[String(priceLevelId)];

    if (!rows || rows.length === 0) return null;

    let best = null;

    rows.forEach((row) => {
      if (row.price === null) return;
      if (best === null || row.minimumQuantity < best.minimumQuantity) {
        best = row;
      }
    });

    return best ? best.price : null;
  };

  // ---------------------------------------------------------------------
  // Bulk fetches
  // ---------------------------------------------------------------------

  /**
   * Resolve every requested SKU to an internal id in a single search.
   *
   * NOTE on itemid: for sub-items, NetSuite's `itemid` search field holds
   * the leaf name, not the "Parent : Child" display string. The rule
   * established for Axim is that the storefront SKU equals the NetSuite
   * Item Number, so this should be a straight match — but if a sub-item
   * ever fails to resolve, this is why.
   */
  const resolveItems = (skus) => {
    const filters = [
      ['isinactive', 'is', 'F'],
      'AND',
      buildSkuFilter(skus)
    ];

    const itemSearch = search.create({
      type: search.Type.ITEM,
      filters,
      columns: [
        search.createColumn({ name: 'internalid' }),
        search.createColumn({ name: 'itemid' })
      ]
    });

    const bySku = {};

    eachResult(itemSearch, (result) => {
      const itemId = result.getValue({ name: 'itemid' });

      bySku[itemId] = {
        internalId: result.getValue({ name: 'internalid' }),
        itemId,
        recordType: result.recordType
      };
    });

    return bySku;
  };

  /**
   * Pull the full price matrix for a set of items in one search, using the
   * `pricing` join rather than record.load. This is the whole reason this
   * RESTlet scales: record.load costs 10 units per item, so a 100-item
   * page would be 1,000+ units against a 5,000-unit limit.
   *
   * VERIFY BEFORE DEPLOY: build this as a saved Item search in the UI first
   * and confirm the join column names ("pricelevel", "unitprice",
   * "minimumquantity") resolve in this account. If any throws
   * SSS_INVALID_SRCH_COL, the join is named differently here.
   *
   * Returns: { [internalId]: { [priceLevelId]: [ { price, minimumQuantity } ] } }
   */
  const fetchPriceMatrix = (internalIds) => {
    const matrix = {};

    if (!internalIds || internalIds.length === 0) return matrix;

    const priceSearch = search.create({
      type: search.Type.ITEM,
      filters: [
        ['internalid', 'anyof', internalIds]
      ],
      columns: [
        search.createColumn({ name: 'internalid' }),
        search.createColumn({ name: 'pricelevel', join: 'pricing' }),
        search.createColumn({ name: 'unitprice', join: 'pricing' }),
        search.createColumn({ name: 'minimumquantity', join: 'pricing' })
      ]
    });

    eachResult(priceSearch, (result) => {
      const internalId = String(result.getValue({ name: 'internalid' }));

      const priceLevelId = String(
        result.getValue({ name: 'pricelevel', join: 'pricing' })
      );

      const price = toMinorUnits(
        result.getValue({ name: 'unitprice', join: 'pricing' })
      );

      const minimumQuantity = parseFloat(
        result.getValue({ name: 'minimumquantity', join: 'pricing' })
      ) || 0;

      if (!priceLevelId || priceLevelId === 'null') return;

      if (!matrix[internalId]) matrix[internalId] = {};
      if (!matrix[internalId][priceLevelId]) matrix[internalId][priceLevelId] = [];

      matrix[internalId][priceLevelId].push({ price, minimumQuantity });
    });

    return matrix;
  };

  /**
   * Read the customer's item-specific pricing sublist once.
   *
   * Returns: { [itemInternalId]: { price, priceLevelId } }
   */
  const getCustomerItemPricing = (customerRecord) => {
    const overrides = {};

    const lineCount = customerRecord.getLineCount({ sublistId: 'itempricing' });

    if (lineCount < 0) return overrides;

    for (let i = 0; i < lineCount; i++) {
      const itemInternalId = customerRecord.getSublistValue({
        sublistId: 'itempricing',
        fieldId: 'item',
        line: i
      });

      if (!itemInternalId) continue;

      overrides[String(itemInternalId)] = {
        price: toMinorUnits(
          customerRecord.getSublistValue({
            sublistId: 'itempricing',
            fieldId: 'price',
            line: i
          })
        ),
        priceLevelId: customerRecord.getSublistValue({
          sublistId: 'itempricing',
          fieldId: 'level',
          line: i
        })
      };
    }

    return overrides;
  };

  // ---------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------

  /**
   * Resolve the customer by internal id, falling back to entity id.
   *
   * Vendure should send the NetSuite internal id from a custom field on
   * the Customer entity, which skips the search entirely.
   */
  const findCustomer = (customerIdentifier) => {
    let internalId = null;

    if (/^\d+$/.test(String(customerIdentifier))) {
      internalId = String(customerIdentifier);
    } else {
      const results = search.create({
        type: search.Type.CUSTOMER,
        filters: [
          ['entityid', 'is', customerIdentifier],
          'AND',
          ['isinactive', 'is', 'F']
        ],
        columns: ['internalid']
      }).run().getRange({ start: 0, end: 1 });

      if (!results || results.length === 0) return null;

      internalId = results[0].getValue({ name: 'internalid' });
    }

    let customerRecord;

    try {
      customerRecord = record.load({
        type: record.Type.CUSTOMER,
        id: internalId,
        isDynamic: false
      });
    } catch (e) {
      log.audit({
        title: 'Vendure Pricing: customer load failed',
        details: customerIdentifier + ' -> ' + internalId + ': ' + e.message
      });

      return null;
    }

    return {
      internalId,
      priceLevelId: customerRecord.getValue({ fieldId: 'pricelevel' }),
      currencyId: customerRecord.getValue({ fieldId: 'currency' }),
      record: customerRecord
    };
  };

  const findPriceLevelIdByName = (priceLevelName) => {
    const results = search.create({
      type: 'pricelevel',
      filters: [
        ['name', 'is', priceLevelName]
      ],
      columns: ['internalid']
    }).run().getRange({ start: 0, end: 1 });

    if (!results || results.length === 0) return null;

    return results[0].getValue({ name: 'internalid' });
  };

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  const normalizeSkus = (skus) => {
    if (!skus) return [];

    const list = Array.isArray(skus) ? skus : [skus];
    const seen = {};
    const out = [];

    list.forEach((sku) => {
      const trimmed = String(sku || '').trim();

      if (!trimmed || seen[trimmed]) return;

      seen[trimmed] = true;
      out.push(trimmed);
    });

    return out;
  };

  /**
   * Build [['itemid','is',a],'OR',['itemid','is',b], ...].
   * itemid is a free-text field, so 'anyof' is not available.
   */
  const buildSkuFilter = (skus) => {
    const expression = [];

    skus.forEach((sku, index) => {
      if (index > 0) expression.push('OR');
      expression.push(['itemid', 'is', sku]);
    });

    return expression;
  };

  /**
   * Page through a search. getRange() caps at 1000 rows per call, and the
   * pricing join multiplies rows (items x price levels), so a 100-SKU
   * request can exceed that.
   */
  const eachResult = (searchObj, callback) => {
    const pageSize = 1000;
    let start = 0;

    for (;;) {
      const page = searchObj.run().getRange({
        start,
        end: start + pageSize
      });

      if (!page || page.length === 0) break;

      page.forEach(callback);

      if (page.length < pageSize) break;

      start += pageSize;
    }
  };

  /**
   * NetSuite returns prices as decimal strings. Vendure stores integer
   * minor units. Convert once, here, so nothing downstream deals in floats.
   */
  const toMinorUnits = (value) => {
    if (value === null || value === undefined || value === '') return null;

    const parsed = parseFloat(value);

    if (isNaN(parsed)) return null;

    return Math.round(parsed * 100);
  };

  /**
   * A null price means NOT PURCHASABLE. It must never coerce to zero on
   * the Vendure side — hide the product from the catalog and reject
   * add-to-cart rather than shipping it for free.
   */
  const buildLine = (sku, internalId, price, basePrice, source) => ({
    sku,
    internalId: internalId || null,
    price,
    basePrice,
    source,
    purchasable: price !== null
  });

  const respond = (success, message, prices) => ({
    success,
    message,
    currencyCode: CURRENCY_CODE,
    prices,
    remainingUsage: runtime.getCurrentScript().getRemainingUsage()
  });

  return { post };

});
