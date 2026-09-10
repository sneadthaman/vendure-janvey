/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * Read-only image manifest backed by NetSuite saved search 2118.
 * GET ?offset=0&limit=1000. Deploy with the existing integration's TBA role.
 */
define(['N/search', 'N/file', 'N/url', 'N/runtime'], (search, file, url, runtime) => {
    const IMAGE_SAVED_SEARCH_ID = '2118';
    const KNOWN_FILE_ID = '72239';

    function integer(value, fallback, maximum) {
        if (value === undefined || value === '') return fallback;
        if (!/^\d+$/.test(String(value))) throw new Error('Invalid pagination parameter');
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new Error('Pagination parameter out of range');
        return parsed;
    }

    function get(params) {
        const offset = integer(params.offset, 0, 1000000);
        const limit = integer(params.limit, 1000, 1000);
        if (limit < 1) throw new Error('limit must be positive');
        const host = url.resolveDomain({hostType: url.HostType.APPLICATION, accountId: runtime.accountId});
        // Loading the proven saved search preserves its folder/file filters and
        // execution settings. The previous ad hoc file search returned no rows
        // for the integration role even though this search exports the files.
        const fileSearch = search.load({id: IMAGE_SAVED_SEARCH_ID});
        const columns = {};
        fileSearch.columns.forEach(column => {
            // Keep the actual SearchColumn object for getValue(), while
            // accepting both SuiteScript names and saved-search labels.
            const fieldName = String(column.name).toLowerCase().replace(/_\d+$/, '');
            if (!columns[fieldName]) columns[fieldName] = column;
            const label = String(column.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const labelFields = {
                internalid: 'internalid', name: 'name', url: 'url',
                lastmodified: 'modified', sizekb: 'documentsize',
            };
            if (labelFields[label] && !columns[labelFields[label]]) columns[labelFields[label]] = column;
        });
        // Search 2118's exported result contract is: Internal ID, Name,
        // Folder, Size (KB), URL, Date Created, Last Modified, Type. NetSuite
        // does not expose usable names/labels for every loaded column in this
        // account, so retain those known positions as a final fallback.
        const savedSearchPositions = {internalid: 0, name: 1, documentsize: 3, url: 4, modified: 6};
        Object.entries(savedSearchPositions).forEach(([fieldName, position]) => {
            if (!columns[fieldName] && fileSearch.columns[position]) columns[fieldName] = fileSearch.columns[position];
        });
        for (const required of ['internalid', 'name', 'url']) {
            if (!columns[required]) throw new Error(`Saved search ${IMAGE_SAVED_SEARCH_ID} is missing the ${required} result column`);
        }
        const paged = fileSearch.runPaged({pageSize: 1000});
        let diagnostics;
        if (String(params.diagnostic || '') === '1') {
            diagnostics = {savedSearchCount: paged.count, knownFileLoad: false, knownFileSearchCount: null};
            try {
                file.load({id: KNOWN_FILE_ID});
                diagnostics.knownFileLoad = true;
            } catch (error) {
                diagnostics.knownFileLoadError = String(error.name || 'Error');
            }
            try {
                diagnostics.knownFileSearchCount = search.create({
                    type: 'file', filters: [['internalid', 'anyof', KNOWN_FILE_ID]], columns: ['internalid'],
                }).runPaged({pageSize: 1000}).count;
            } catch (error) {
                diagnostics.knownFileSearchError = String(error.name || 'Error');
            }
        }
        const files = [];
        let index = offset;
        while (files.length < limit && index < paged.count) {
            const page = paged.fetch({index: Math.floor(index / 1000)});
            let withinPage = index % 1000;
            if (withinPage >= page.data.length) throw new Error('Search changed during pagination; retry the manifest');
            while (withinPage < page.data.length && files.length < limit) {
                const row = page.data[withinPage++];
                const value = name => columns[name] ? row.getValue(columns[name]) : '';
                const relative = String(value('url') || '');
                // Preserve the opaque NetSuite URL/hash; only resolve a relative URI.
                const absolute = relative.startsWith('/') && !relative.startsWith('//')
                    ? 'https://' + host + relative : relative;
                files.push({
                    internalid: String(value('internalid')),
                    name: String(value('name')),
                    url: absolute,
                    modified: String(value('modified') || ''),
                    size: String(value('documentsize') || ''),
                    availableWithoutLogin: value('availablewithoutlogin') === true || value('availablewithoutlogin') === 'T',
                });
                index++;
            }
        }
        const response = {
            success: true, count: files.length, total: paged.count, offset, limit, files,
            remainingUsage: runtime.getCurrentScript().getRemainingUsage(),
        };
        if (diagnostics) response.diagnostics = diagnostics;
        return response;
    }
    return {get};
});
