/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 *
 * Idempotent Vendure -> NetSuite Sales Order endpoint.
 * Deploy this separately from the read-only catalog/customer RESTlets and grant
 * its integration role only the transaction and record permissions it needs.
 */
define(['N/record','N/search','N/runtime','N/log'],(record,search,runtime,log)=>{
  const CONTRACT_VERSION=1;
  const MAX_LINES=200;

  function requiredId(value,name){
    const id=String(value||'').trim();
    if(!/^\d+$/.test(id))throw new Error(name+' must be a numeric NetSuite internal ID');
    return id;
  }

  function requiredText(value,name,max){
    const text=String(value||'').trim();
    if(!text||text.length>max)throw new Error(name+' is required and must not exceed '+max+' characters');
    return text;
  }

  function cents(value,name){
    if(!Number.isSafeInteger(value)||value<0)throw new Error(name+' must be a non-negative integer number of cents');
    return value;
  }

  function normalize(body){
    if(!body||body.contractVersion!==CONTRACT_VERSION)throw new Error('Unsupported contractVersion');
    const lines=Array.isArray(body.lines)?body.lines:[];
    if(!lines.length||lines.length>MAX_LINES)throw new Error('lines must contain 1 to '+MAX_LINES+' items');
    const normalized={
      contractVersion:CONTRACT_VERSION,dryRun:body.dryRun===true,
      externalId:requiredText(body.externalId,'externalId',255),vendureOrderCode:requiredText(body.vendureOrderCode,'vendureOrderCode',255),
      customerInternalId:requiredId(body.customerInternalId,'customerInternalId'),
      contactInternalId:body.contactInternalId?requiredId(body.contactInternalId,'contactInternalId'):null,
      shippingAddressInternalId:requiredId(body.shippingAddressInternalId,'shippingAddressInternalId'),
      billingAddressInternalId:requiredId(body.billingAddressInternalId,'billingAddressInternalId'),
      currencyCode:String(body.currencyCode||''),memo:String(body.memo||'').slice(0,999),
      customerPurchaseOrder:body.customerPurchaseOrder?String(body.customerPurchaseOrder).slice(0,99):null,
      shippingMethodInternalId:body.shippingMethodInternalId?requiredId(body.shippingMethodInternalId,'shippingMethodInternalId'):null,
      shippingCents:cents(body.shippingCents,'shippingCents'),expectedSubtotalCents:cents(body.expectedSubtotalCents,'expectedSubtotalCents'),
      expectedTaxCents:cents(body.expectedTaxCents,'expectedTaxCents'),expectedTotalCents:cents(body.expectedTotalCents,'expectedTotalCents'),
      lines:lines.map((line,index)=>({
        itemInternalId:requiredId(line&&line.itemInternalId,'lines['+index+'].itemInternalId'),
        sku:requiredText(line&&line.sku,'lines['+index+'].sku',255),
        quantity:cents(line&&line.quantity,'lines['+index+'].quantity'),
        rateCents:cents(line&&line.rateCents,'lines['+index+'].rateCents'),
        amountCents:cents(line&&line.amountCents,'lines['+index+'].amountCents'),
      })),
    };
    if(normalized.currencyCode!=='USD')throw new Error('Only USD is supported');
    if(!normalized.lines.every(line=>line.quantity>0&&line.rateCents*line.quantity===line.amountCents))throw new Error('Line quantity, rate, and amount do not reconcile');
    const subtotal=normalized.lines.reduce((sum,line)=>sum+line.amountCents,0);
    if(subtotal!==normalized.expectedSubtotalCents||subtotal+normalized.shippingCents+normalized.expectedTaxCents!==normalized.expectedTotalCents)throw new Error('Request totals do not reconcile');
    if(normalized.shippingCents>0&&!normalized.shippingMethodInternalId)throw new Error('shippingMethodInternalId is required when shippingCents is greater than zero');
    return normalized;
  }

  function existingSalesOrder(externalId){
    let internalId=null;
    search.create({type:search.Type.SALES_ORDER,filters:[['mainline','is','T'],'AND',['externalidstring','is',externalId]],columns:['internalid']}).run().each(result=>{
      internalId=String(result.getValue({name:'internalid'}));return false;
    });
    return internalId;
  }

  function validateCustomerAndAddresses(payload){
    const customer=record.load({type:record.Type.CUSTOMER,id:payload.customerInternalId,isDynamic:false});
    const checked=value=>value===true||value==='T';
    if(checked(customer.getValue({fieldId:'isinactive'})))throw new Error('Customer is inactive');
    if(customer.getFields().indexOf('custentity_web_customer')!==-1&&!checked(customer.getValue({fieldId:'custentity_web_customer'})))throw new Error('Customer is not enabled for web orders');
    const validAddresses=new Set();
    const fields=customer.getSublistFields({sublistId:'addressbook'});
    const idField=['internalid','id','addressid'].find(field=>fields.indexOf(field)!==-1);
    if(!idField)throw new Error('Customer addressbook does not expose stable internal IDs');
    for(let line=0;line<customer.getLineCount({sublistId:'addressbook'});line++)validAddresses.add(String(customer.getSublistValue({sublistId:'addressbook',fieldId:idField,line})||''));
    if(!validAddresses.has(payload.shippingAddressInternalId))throw new Error('Ship-to address does not belong to the customer');
    if(!validAddresses.has(payload.billingAddressInternalId))throw new Error('Bill-to address does not belong to the customer');
  }

  function validateItems(payload){
    const expected=new Set(payload.lines.map(line=>line.itemInternalId));
    const found=new Set();
    search.create({type:search.Type.ITEM,filters:[['internalid','anyof',Array.from(expected)]],columns:['internalid','isinactive']}).run().each(result=>{
      if(result.getValue({name:'isinactive'})==='T')throw new Error('Order contains an inactive item');
      found.add(String(result.getValue({name:'internalid'})));return true;
    });
    if(found.size!==expected.size)throw new Error('One or more order item IDs were not found');
  }

  function validateContact(payload){
    if(!payload.contactInternalId)return;
    let found=false;
    search.create({type:search.Type.CONTACT,filters:[['internalid','anyof',payload.contactInternalId],'AND',['company','anyof',payload.customerInternalId],'AND',['isinactive','is','F']],columns:['internalid']}).run().each(()=>{found=true;return false;});
    if(!found)throw new Error('Contact is inactive or does not belong to the customer');
  }

  function moneyToCents(value){
    const number=Number(value);
    return Number.isFinite(number)?Math.round(number*100):null;
  }

  function resultFor(internalId,externalId,idempotent,dryRun){
    if(dryRun)return {success:true,contractVersion:CONTRACT_VERSION,dryRun:true,idempotent,internalId:null,transactionId:null,externalId,subtotalCents:null,shippingCents:null,taxCents:null,totalCents:null,remainingUsage:runtime.getCurrentScript().getRemainingUsage()};
    const salesOrder=record.load({type:record.Type.SALES_ORDER,id:internalId,isDynamic:false});
    return {success:true,contractVersion:CONTRACT_VERSION,dryRun:false,idempotent,internalId:String(internalId),transactionId:String(salesOrder.getValue({fieldId:'tranid'})||''),externalId,
      subtotalCents:moneyToCents(salesOrder.getValue({fieldId:'subtotal'})),shippingCents:moneyToCents(salesOrder.getValue({fieldId:'shippingcost'})),
      taxCents:moneyToCents(salesOrder.getValue({fieldId:'taxtotal'})),totalCents:moneyToCents(salesOrder.getValue({fieldId:'total'})),remainingUsage:runtime.getCurrentScript().getRemainingUsage()};
  }

  function createSalesOrder(payload){
    const salesOrder=record.create({type:record.Type.SALES_ORDER,isDynamic:true});
    salesOrder.setValue({fieldId:'entity',value:payload.customerInternalId});
    salesOrder.setValue({fieldId:'externalid',value:payload.externalId});
    salesOrder.setValue({fieldId:'memo',value:payload.memo});
    salesOrder.setValue({fieldId:'shipaddresslist',value:payload.shippingAddressInternalId});
    salesOrder.setValue({fieldId:'billaddresslist',value:payload.billingAddressInternalId});
    if(payload.contactInternalId)salesOrder.setValue({fieldId:'contact',value:payload.contactInternalId});
    if(payload.customerPurchaseOrder)salesOrder.setValue({fieldId:'otherrefnum',value:payload.customerPurchaseOrder});
    for(const line of payload.lines){
      salesOrder.selectNewLine({sublistId:'item'});
      salesOrder.setCurrentSublistValue({sublistId:'item',fieldId:'item',value:line.itemInternalId});
      salesOrder.setCurrentSublistValue({sublistId:'item',fieldId:'quantity',value:line.quantity});
      salesOrder.setCurrentSublistValue({sublistId:'item',fieldId:'price',value:-1});
      salesOrder.setCurrentSublistValue({sublistId:'item',fieldId:'rate',value:line.rateCents/100});
      salesOrder.setCurrentSublistValue({sublistId:'item',fieldId:'amount',value:line.amountCents/100});
      salesOrder.commitLine({sublistId:'item'});
    }
    if(payload.shippingMethodInternalId){
      salesOrder.setValue({fieldId:'shipmethod',value:payload.shippingMethodInternalId});
      salesOrder.setValue({fieldId:'shippingcost',value:payload.shippingCents/100});
    }
    return String(salesOrder.save({enableSourcing:true,ignoreMandatoryFields:false}));
  }

  function post(body){
    const payload=normalize(body);
    const existing=existingSalesOrder(payload.externalId);
    if(existing)return resultFor(existing,payload.externalId,true,payload.dryRun);
    validateCustomerAndAddresses(payload);validateContact(payload);validateItems(payload);
    if(payload.dryRun)return resultFor(null,payload.externalId,false,true);
    try{return resultFor(createSalesOrder(payload),payload.externalId,false,false);}
    catch(error){
      const raced=existingSalesOrder(payload.externalId);
      if(raced)return resultFor(raced,payload.externalId,true,false);
      log.error({title:'Vendure Sales Order export failed',details:String(error&&error.name||'Error')});throw error;
    }
  }

  function get(){
    const shippingItems=[];
    search.create({type:search.Type.SHIP_ITEM,filters:[['isinactive','is','F']],columns:['internalid','itemid']}).run().each(result=>{
      shippingItems.push({internalId:String(result.getValue({name:'internalid'})||''),name:String(result.getValue({name:'itemid'})||'')});
      return shippingItems.length<100;
    });
    return {success:true,contractVersion:CONTRACT_VERSION,shippingItems,remainingUsage:runtime.getCurrentScript().getRemainingUsage()};
  }

  return {get,post};
});
