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

    // Standard Item / Web Store tab fields only -- no custom fields.
    // Note: not every field visible on the item record is available as a
    // search column via the generic search.Type.ITEM (which spans all
    // item subtypes). pagetitle was rejected with SSS_INVALID_SRCH_COL --
    // removed for now. Add fields back one at a time and re-test if you
    // hit the same error on urlcomponent or others.
    const COLUMNS = [
        'internalid',
        'itemid',                    // Item Name/Number -> maps to Axim SKU
        'displayname',
        'salesdescription',
        'storedescription',
        'storedetaileddescription',
        'urlcomponent'
    ];

    const get = (requestParams) => {
        const limit = Math.min(parseInt(requestParams.limit, 10) || 100, 1000);
        const offset = parseInt(requestParams.offset, 10) || 0;

        const itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [
                ['isonline', 'is', 'T'] // Display in Web Store checkbox
            ],
            columns: COLUMNS
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

                const row = {};
                itemSearch.columns.forEach((column) => {
                    row[column.name] = result.getValue(column);
                });
                results.push(row);
                collected++;
            }
        }

        return {
            count: results.length,
            offset,
            limit,
            items: results
        };
    };

    return { get };
});
