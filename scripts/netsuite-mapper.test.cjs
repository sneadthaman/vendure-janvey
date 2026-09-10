const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node').register({project: require('node:path').resolve(__dirname, '../apps/server/tsconfig.json')});
const {mapItem, mapItems, priceInCents} = require('../apps/server/src/plugins/netsuite-sync/netsuite.mapper');
const row = {internalid: '42', itemid: 'SKU', recordType: 'inventoryitem', displayname: 'Café Soap', onlineprice: '19.99'};

test('money is parsed exactly, including zero, with invalid values rejected', () => {
    for (const [input, expected] of [['19.99',1999],['0',0],['0.29',29],['12.3',1230],['21474836.47',2147483647]]) {
        assert.equal(priceInCents(input), expected);
    }
    for (const value of [null, undefined, '', 'no', '-1', '1.999', '1e2', '1,000', '21474836.48']) assert.equal(priceInCents(value), null);
});
test('missing identities return stable skip reasons and retain the raw row', () => {
    for (const [field, reason] of [['internalid','missing_internalid'],['itemid','missing_itemid'],['recordType','missing_recordtype']]) {
        const raw = {...row, [field]: ' '};
        assert.deepEqual(mapItem(raw), {ok:false, reason, raw});
    }
});
test('unpriced variants cannot be purchased; a genuine zero price is distinct', () => {
    for (const onlineprice of [null, undefined, '', 'bad', '-2']) {
        const {item} = mapItem({...row, onlineprice});
        assert.equal(item.identity.price, 0);
        assert.equal(item.identity.enabled, false);
        assert.equal(item.identity.customFields.purchasable, false);
    }
    assert.equal(mapItem({...row, onlineprice:'0'}).item.identity.enabled, true);
});
test('content is separate, fallback slugs include immutable identity, and input is unchanged', () => {
    const input = Object.freeze({...row, weight:'2.5', custitem_pallet_qqty:'2.5', custitem7:'12/case', manufacturer:' Maker '});
    const {item} = mapItem(input);
    assert.equal(item.content.slug, 'cafe-soap-42');
    assert.equal(item.identity.customFields.weight, 2.5);
    assert.equal(item.identity.customFields.palletQuantity, null);
    assert.equal(item.facets.manufacturer, 'Maker');
    assert.equal(item.identity.name, undefined);
    assert.equal(item.content.customFields.featuredRank, undefined);
    assert.equal(mapItem({...row,urlcomponent:'existing-url'}).item.content.slug, 'existing-url');
    assert.equal(mapItem({...row,displayname:null}).item.content.name, 'SKU');
});
test('batches preserve successes and collect rejected rows without mutating them', () => {
    const invalid = {...row, recordType:undefined};
    const result = mapItems([row, invalid]);
    assert.equal(result.mapped.length, 1);
    assert.deepEqual(result.skipped, [{reason:'missing_recordtype',raw:invalid}]);
});
