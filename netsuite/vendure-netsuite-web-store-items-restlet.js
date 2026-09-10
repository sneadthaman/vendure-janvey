/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 *
 * Returns items where "Display in Web Store" (isonline) is checked,
 * along with the standard Web Store tab fields.
 *
 * GET params:
 *   - limit  (optional, default 100, max 1000)
 *   - offset (optional, default 0)  -> use for pagination, same pattern
 *                                      Axim already asked you to add on
 *                                      the history endpoints
 *
 * Deploy this the same way as your existing item/history RESTlets:
 * same script record type, same role/integration record so the
 * existing OAuth 1.0a TBA credentials work against it unchanged.
 */
define(['N/search'], (search) => {

    // Standard Item / Web Store tab fields, plus the custom fields you use.
    // Note: not every field visible on the item record is available as a
    // search column via the generic search.Type.ITEM (which spans all
    // item subtypes). pagetitle was rejected with SSS_INVALID_SRCH_COL and
    // stays out. If any of these throw the same error, pull that one field
    // out, redeploy, and test again -- SSS_INVALID_SRCH_COL always names
    // the offending field, so you'll know exactly which one to remove.
    const COLUMNS = [
        'internalid',
        'itemid',                    // Item Name/Number -> maps to Axim SKU
        'displayname',
        'salesdescription',
        'storedescription',
        'storedetaileddescription',
        'urlcomponent',
        'featureddescription',
        'weight',
        'manufacturer',
        'mpn',
        'countryofmanufacture',
        'upccode',
        'class',                             // maps to your product categories
        'custitem_janvey_jm_images',
        'custitem_packship_itm_pack_height',
        'custitem_packship_itm_pack_length',
        'custitem_packship_itm_pack_width',
        'custitem10',                        // video link
        'custitem7',                         // attribute pack size
        'custitem9',                         // literature link
        'custitem8',                         // SDS link
        'custitem_pallet_qqty'
    ];

    // These are NetSuite list/record fields -- getValue() returns their
    // internal ID, getText() returns the readable name. Since these are
    // used for display (class -> product categories, etc.), we want text.
    // manufacturer is stored as free text in this account (not a list
    // field), so it's read with getValue() like everything else.
    const TEXT_FIELDS = new Set(['class', 'countryofmanufacture']);

    const get = (requestParams) => {
        const limit = Math.min(parseInt(requestParams.limit, 10) || 100, 1000);
        const offset = parseInt(requestParams.offset, 10) || 0;

        const itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [
                ['isonline', 'is', 'T'] // Display in Web Store checkbox
            ],
            columns: COLUMNS.map(name => name === 'internalid'
                ? search.createColumn({name, sort: search.Sort.ASC}) : name)
        });

        const results = [];
        const pagedData = itemSearch.runPaged({ pageSize: 1000 });

        // Simple offset/limit slice across pages. Fine for a first pass;
        // if your catalog is large we can switch to native paged iteration.
        let collected = 0;
        let skipped = 0;

        outer:
        for (let p = 0; p < pagedData.pageRanges.length; p++) {
            const page = pagedData.fetch({ index: p });
            for (const result of page.data) {
                if (skipped < offset) {
                    skipped++;
                    continue;
                }
                if (collected >= limit) break outer;

                const row = { recordType: result.recordType };
                itemSearch.columns.forEach((column) => {
                    row[column.name] = TEXT_FIELDS.has(column.name)
                        ? result.getText(column)
                        : result.getValue(column);
                });
                results.push(row);
                collected++;
            }
        }

        return {
            count: results.length,
            total: pagedData.count,
            offset,
            limit,
            items: results
        };
    };

    return { get };
});
