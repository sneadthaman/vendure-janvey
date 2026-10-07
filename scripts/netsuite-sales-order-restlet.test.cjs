const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../netsuite/vendure-netsuite-sales-order-restlet.js'),'utf8');

function payload(overrides={}){
    return {contractVersion:1,dryRun:true,externalId:'VENDURE-ABC123',vendureOrderCode:'ABC123',customerInternalId:'712',contactInternalId:'5847',
        shippingAddressInternalId:'10',billingAddressInternalId:'11',currencyCode:'USD',memo:'Vendure web order ABC123',customerPurchaseOrder:null,
        shippingMethodInternalId:'99',shippingCents:500,expectedSubtotalCents:13180,expectedTaxCents:1180,expectedTotalCents:14860,
        lines:[{itemInternalId:'1968',sku:'KCC 1804',quantity:2,rateCents:6590,amountCents:13180}],...overrides};
}

function fixture({existing=null,shippingExists=true,shippingCost=5}={}){
    let endpoint,created=0,saved=0,fields={},lines=[];
    const customer={getValue:({fieldId})=>({isinactive:false,custentity_web_customer:true}[fieldId]),getFields:()=>['isinactive','custentity_web_customer'],
        getSublistFields:()=>['internalid'],getLineCount:()=>2,getSublistValue:({line})=>line===0?'10':'11'};
    const loadedOrder={getValue:({fieldId})=>({tranid:'SO123',subtotal:131.8,shippingcost:shippingCost,taxtotal:11.8,total:148.6}[fieldId])};
    const salesOrder={setValue:({fieldId,value})=>{fields[fieldId]=value;},selectNewLine:()=>{lines.push({});},
        setCurrentSublistValue:({fieldId,value})=>{lines.at(-1)[fieldId]=value;},commitLine:()=>{},save:()=>{saved++;return '444';}};
    const record={Type:{CUSTOMER:'customer',SALES_ORDER:'salesorder'},load:({type})=>type==='customer'?customer:loadedOrder,
        create:()=>{created++;return salesOrder;}};
    const search={Type:{SALES_ORDER:'salesorder',ITEM:'item',CONTACT:'contact',SHIP_ITEM:'shipitem'},create:({type})=>({run:()=>({each:callback=>{
        if(type==='salesorder'&&existing)callback({getValue:()=>existing});
        if(type==='contact')callback({getValue:()=> '5847'});
        if(type==='item')callback({getValue:({name})=>name==='internalid'?'1968':'F'});
        if(type==='shipitem'&&shippingExists)callback({getValue:({name})=>name==='internalid'?'99':'Janvey Delivery'});
    }})})};
    vm.runInNewContext(source,{define:(_deps,factory)=>{endpoint=factory(record,search,{getCurrentScript:()=>({getRemainingUsage:()=>4900})},{error:()=>{}});}});
    return {get:()=>endpoint.get(),post:value=>endpoint.post(value),stats:()=>({created,saved,fields,lines})};
}

test('GET lists active Shipping Item internal IDs without changing records',()=>{
    const value=fixture();const result=value.get();
    assert.equal(result.success,true);assert.deepEqual(JSON.parse(JSON.stringify(result.shippingItems)),[{internalId:'99',name:'Janvey Delivery'}]);
    assert.equal(value.stats().created,0);
});

test('dry run validates immutable references without creating a transaction',()=>{
    const value=fixture();const result=value.post(payload());
    assert.equal(result.success,true);assert.equal(result.dryRun,true);assert.equal(result.internalId,null);
    assert.deepEqual(value.stats(),{created:0,saved:0,fields:{},lines:[]});
});

test('live export creates a custom-priced Sales Order with the stable external id',()=>{
    const value=fixture();const result=value.post(payload({dryRun:false}));const state=value.stats();
    assert.equal(result.internalId,'444');assert.equal(result.totalCents,14860);assert.equal(state.saved,1);
    assert.equal(state.fields.entity,'712');assert.equal(state.fields.externalid,'VENDURE-ABC123');
    assert.equal(state.fields.shipaddresslist,'10');assert.equal(state.fields.billaddresslist,'11');assert.equal(state.fields.shipmethod,'99');
    assert.deepEqual(state.lines[0],{item:'1968',quantity:2,price:-1,rate:65.9,amount:131.8});
});

test('an existing external id is idempotent and never creates a second Sales Order',()=>{
    const value=fixture({existing:'444'});const result=value.post(payload({dryRun:false}));
    assert.equal(result.idempotent,true);assert.equal(result.internalId,'444');assert.equal(value.stats().created,0);
});

test('a blank NetSuite shipping cost is returned as zero cents',()=>{
    const value=fixture({existing:'444',shippingCost:''});const result=value.post(payload({dryRun:false}));
    assert.equal(result.idempotent,true);assert.equal(result.shippingCents,0);assert.equal(value.stats().created,0);
});

test('invalid totals and unmapped paid shipping are rejected before record creation',()=>{
    const value=fixture();
    assert.throws(()=>value.post(payload({expectedTotalCents:1})),/totals do not reconcile/);
    assert.throws(()=>value.post(payload({shippingMethodInternalId:null})),/shippingMethodInternalId/);
    assert.equal(value.stats().created,0);
});

test('dry run rejects an inactive or missing Shipping Item before record creation',()=>{
    const value=fixture({shippingExists:false});
    assert.throws(()=>value.post(payload({shippingCents:0,expectedTotalCents:14360})),/Shipping Item/);
    assert.equal(value.stats().created,0);
});
