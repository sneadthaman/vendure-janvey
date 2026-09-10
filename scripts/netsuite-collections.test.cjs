const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
require('ts-node').register({project:path.resolve(__dirname,'../apps/server/tsconfig.json')});
const {CATEGORY_GROUPS,FEATURED_PRODUCT_NETSUITE_IDS,KNOWN_CLASS_MAP}=require('../apps/server/src/plugins/netsuite-sync/collection-taxonomy');

test('category taxonomy contains six unique groups and all sixteen NetSuite classes',()=>{
    assert.equal(CATEGORY_GROUPS.length,6);
    const groups=CATEGORY_GROUPS.map(group=>group.key);
    const classes=CATEGORY_GROUPS.flatMap(group=>group.classes.map(item=>item.key));
    assert.equal(new Set(groups).size,6);
    assert.equal(classes.length,16);
    assert.equal(new Set(classes).size,16);
    assert.equal(KNOWN_CLASS_MAP.size,16);
});
test('category labels and slugs are customer-facing and stable',()=>{
    const carts=KNOWN_CLASS_MAP.get('MATERIAL HANDLING - CARTS/TRUC');
    assert.deepEqual({name:carts.name,slug:carts.slug},{name:'Carts & Trucks',slug:'carts-trucks'});
    const floor=KNOWN_CLASS_MAP.get('FLOOR CARE/STRIP & FINISH');
    assert.deepEqual({name:floor.name,slug:floor.slug},{name:'Floor Strippers & Finishes',slug:'floor-strippers-finishes'});
});

test('featured seed has eight unique immutable NetSuite product IDs',()=>{
    assert.equal(FEATURED_PRODUCT_NETSUITE_IDS.length,8);
    assert.equal(new Set(FEATURED_PRODUCT_NETSUITE_IDS).size,8);
    assert.ok(FEATURED_PRODUCT_NETSUITE_IDS.every(id=>/^\d+$/.test(id)));
});
