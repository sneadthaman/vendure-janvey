const test=require('node:test');
const assert=require('node:assert/strict');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});
const {NetsuiteSyncService,priceBelongsToItem}=require('../apps/server/src/plugins/netsuite-sync/services/netsuite-sync.service');
const {mapItem}=require('../apps/server/src/plugins/netsuite-sync/netsuite.mapper');
const item=mapItem({internalid:'42',itemid:'renamed-SKU',recordType:'inventoryitem',displayname:'Upstream name',onlineprice:null}).item;
function fixture(existing){
    const calls={};
    const connection={getRepository:()=>({findOne:async()=>existing}),withTransaction:async(ctx,fn)=>fn(ctx)};
    const products={findOneBySlug:async()=>undefined,update:async(ctx,input)=>{calls.product=input;return {id:existing.id};},create:async(ctx,input)=>{calls.product=input;return {id:'new'};}};
    const variants={update:async(ctx,input)=>{calls.variant=input[0];},create:async(ctx,input)=>{calls.variant=input[0];}};
    const service=new NetsuiteSyncService(connection,null,null,null,null,products,variants,null,null);
    service.facetIds=async()=>[];
    return {calls,service};
}
test('locked product updates identity and prices without overwriting descriptive fields',async()=>{
    const {calls,service}=fixture({id:'1',channels:[{id:'1'}],customFields:{syncLocked:true},variants:[{id:'2',facetValues:[]}],facetValues:[],assets:[]});
    await service.upsert({channelId:'1'},item,{price:60139,purchasable:true},new Map(),()=>{});
    assert.equal(calls.product.translations,undefined);
    assert.equal(calls.product.customFields.salesDescription,undefined);
    assert.equal(calls.variant.translations,undefined);
    assert.equal(calls.variant.sku,'renamed-SKU');
    assert.equal(calls.variant.price,60139);
    assert.equal(calls.variant.id,'2');
});
test('unpriced variant writes disabled and unpurchasable alongside zero placeholder',async()=>{
    const {calls,service}=fixture(null);
    await service.upsert({channelId:'1'},item,{price:null,purchasable:false},new Map(),()=>{});
    assert.equal(calls.variant.price,0);assert.equal(calls.variant.enabled,false);assert.equal(calls.variant.customFields.purchasable,false);
});
test('multi-variant collisions are rejected before writes',async()=>{
    const {calls,service}=fixture({id:'1',channels:[{id:'1'}],variants:[{id:'2'},{id:'3'}]});
    await assert.rejects(service.upsert({channelId:'1'},item,{price:1,purchasable:true},new Map(),()=>{}),/multi-variant/);
    assert.deepEqual(calls,{});
});
test('a pricing item-not-found row is a valid unpriced result, not an identity collision',()=>{
    assert.equal(priceBelongsToItem({internalId:null,price:null,purchasable:false},'2943'),true);
    assert.equal(priceBelongsToItem({internalId:null,price:1,purchasable:true},'2943'),false);
    assert.equal(priceBelongsToItem({internalId:'other',price:null,purchasable:false},'2943'),false);
});
