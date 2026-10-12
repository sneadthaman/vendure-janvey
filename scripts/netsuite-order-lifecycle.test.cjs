const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({ignoreDeprecations:'6.0'});
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});

const {NetsuiteOrderLifecycleService}=require('../apps/server/src/plugins/netsuite-sync/services/netsuite-order-lifecycle.service');

function snapshot(){
    return {success:true,contractVersion:1,salesOrder:{internalId:'204855',transactionId:'SO310591',externalId:'VENDURE-ABC123',vendureOrderCode:'ABC123',statusCode:'B',statusText:'Pending Fulfillment',orderDate:'2026-10-07T07:00:00.000Z',lastModifiedAt:'2026-10-12T14:41:00.000Z'},fulfillments:[],invoices:[]};
}

function fixture(client){
    const record={id:3,orderId:10,status:'exported',externalId:'VENDURE-ABC123',netsuiteInternalId:'204855',netsuiteTransactionId:'SO310591',lifecycleJson:null,lifecycleSyncedAt:null,lifecycleLastError:null};
    const saves=[];
    const repo={findOneByOrFail:async()=>record,findOneBy:async()=>record,save:async value=>{saves.push({...value});return value;}};
    const service=new NetsuiteOrderLifecycleService({getRepository:()=>repo},client);
    return {record,saves,service};
}

test('successful refresh stores a normalized lifecycle snapshot',async()=>{
    const value=fixture({fetchSalesOrderLifecycle:async()=>snapshot()});
    const result=await value.service.refreshOrder({},10);
    assert.equal(result.salesOrder.transactionId,'SO310591');
    assert.equal(value.record.lifecycleLastError,null);
    assert.equal(JSON.parse(value.record.lifecycleJson).salesOrder.statusText,'Pending Fulfillment');
    assert.equal(value.saves.length,1);
});

test('failed refresh preserves the last successful snapshot and records the error',async()=>{
    const value=fixture({fetchSalesOrderLifecycle:async()=>{throw new Error('NetSuite unavailable');}});
    value.record.lifecycleJson=JSON.stringify(snapshot());
    const previous=value.record.lifecycleJson;
    await assert.rejects(value.service.refreshOrder({},10),/NetSuite unavailable/);
    assert.equal(value.record.lifecycleJson,previous);
    assert.equal(value.record.lifecycleLastError,'NetSuite unavailable');
    assert.equal(value.saves.length,1);
});
