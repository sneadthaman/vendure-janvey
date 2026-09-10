const test=require('node:test');
const assert=require('node:assert/strict');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});
const {NetsuiteService}=require('../apps/server/src/plugins/netsuite-sync/services/netsuite.service');
function client(responder) {const c=new NetsuiteService({});c.request=responder;return c;}
const row=id=>({internalid:String(id)});
test('catalog pages require stable totals before reconciliation is safe',async()=>{
    const c=client(async(_,__,p)=>{const offset=Number(p.offset);const items=offset===0?Array.from({length:100},(_,i)=>row(i)): [row(100)];return {offset,limit:100,count:items.length,total:101,items};});
    const snapshot=await c.fetchCatalog();assert.equal(snapshot.items.length,101);assert.equal(snapshot.reconciliationSafe,true);
    const old=client(async()=>({offset:0,limit:100,count:1,items:[row(1)]}));
    assert.equal((await old.fetchCatalog()).reconciliationSafe,false);
});
test('partial catalogs and duplicate IDs cannot become successful snapshots',async()=>{
    await assert.rejects(client(async()=>({offset:0,limit:100,count:1,total:3,items:[row(1)]})).fetchCatalog(),/Incomplete/);
    await assert.rejects(client(async()=>({offset:0,limit:100,count:2,total:2,items:[row(1),row(1)]})).fetchCatalog(),/Duplicate/);
});
test('guest pricing preserves cents and explicitly avoids customer context',async()=>{
    const c=client(async(_,method,params,body)=>{
        assert.equal(method,'POST');assert.equal(body.customerId,null);
        return {success:true,currencyCode:'USD',prices:body.skus.map(sku=>({sku,internalId:'5644',price:60139,basePrice:60139,purchasable:true,source:'online_price'}))};
    });
    assert.equal((await c.fetchOnlinePrices(['MAJ R04032'])).get('MAJ R04032').price,60139);
});
test('invalid or incomplete pricing fails instead of converting transport errors into zero prices',async()=>{
    await assert.rejects(client(async()=>({success:true,currencyCode:'USD',prices:[]})).fetchOnlinePrices(['a']),/omitted/);
    await assert.rejects(client(async()=>({success:true,currencyCode:'USD',prices:[{sku:'a',price:1.2,basePrice:1.2,purchasable:true}]})).fetchOnlinePrices(['a']),/Inconsistent/);
});
test('duplicate image names are rejected instead of choosing an arbitrary file',async()=>{
    const file={name:'x_01.jpg',url:'https://example.app.netsuite.com/core/media/media.nl',internalid:'1'};
    await assert.rejects(client(async()=>({success:true,offset:0,limit:1000,count:2,total:2,files:[file,file]})).fetchImages(),/duplicate/);
});
