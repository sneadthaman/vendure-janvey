const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../netsuite/vendure-netsuite-customers-restlet.js'),'utf8');

function fixture({addressId='44',bodyOverrides={},sublistOverrides={},addressOverrides={}}={}){
    let endpoint,dependencies;
    const body={entityid:'DISTRICT-1',companyname:'Example District',email:'office@example.test',phone:'555-0100',pricelevel:'7',custentity_web_customer:true,isinactive:false,taxable:true,taxitem:'12',...bodyOverrides};
    const sublist={internalid:addressId,label:'Elementary School',defaultbilling:false,defaultshipping:true,...sublistOverrides};
    const address={addressee:'Example Elementary',attention:'Head Custodian',addr1:'1 School Way',addr2:'',city:'Testville',state:'PA',zip:'19000',country:'US',addrphone:'555-0101',...addressOverrides};
    const customer={
        getFields:()=>Object.keys(body),getValue:({fieldId})=>body[fieldId],getText:({fieldId})=>fieldId==='pricelevel'?'Contract':body[fieldId],
        getSublists:()=>['addressbook'],getSublistFields:()=>Object.keys(sublist),getLineCount:()=>1,
        getSublistValue:({fieldId})=>sublist[fieldId],getSublistSubrecord:()=>({getFields:()=>Object.keys(address),getValue:({fieldId})=>address[fieldId]}),
    };
    const contact={internalid:'91',entityid:'Custodian One',firstname:'Casey',lastname:'Custodian',email:'casey@example.test',phone:'555-0102',isinactive:false};
    vm.runInNewContext(source,{define:(deps,factory)=>{
        dependencies=Array.from(deps);
        const candidate={internalid:'725',entityid:'DISTRICT-1',companyname:'Example District',isinactive:false};
        const taxItem={getFields:()=>['itemid','rate'],getValue:({fieldId})=>fieldId==='rate'?'8.625':null,getText:({fieldId})=>fieldId==='rate'?'8.625%':null};
        endpoint=factory({Type:{CUSTOMER:'customer',SALES_TAX_ITEM:'salestaxitem'},load:({type})=>type==='salestaxitem'?taxItem:customer},{Type:{CONTACT:'contact',CUSTOMER:'customer'},create:({type})=>({run:()=>({each:callback=>callback({getValue:({name})=>(type==='customer'?candidate:contact)[name]})})})},{getCurrentScript:()=>({getRemainingUsage:()=>4990})});
    }});
    return {get:params=>endpoint.get(params),dependencies:()=>dependencies};
}

test('customer endpoint is read-only and rejects non-numeric identities',()=>{
    const value=fixture();
    assert.deepEqual(value.dependencies(),['N/record','N/search','N/runtime']);
    for(const customerId of ['', 'ABC', '1 OR 1=1']) assert.throws(()=>value.get({customerId}));
});

test('customer search is read-only, bounded, and returns only customer selectors',()=>{
    const endpoint=fixture();
    const result=endpoint.get({query:'Example'});
    assert.equal(result.success,true);
    assert.equal(result.candidates.length,1);
    assert.deepEqual(JSON.parse(JSON.stringify(result.candidates[0])),{internalId:'725',entityId:'DISTRICT-1',companyName:'Example District',active:true});
    for(const query of ['', 'x', 'a'.repeat(101)])assert.throws(()=>endpoint.get({query}));
});

test('customer contract returns stable contacts, addresses and discovered tax metadata',()=>{
    const result=fixture().get({customerId:'725',diagnostic:'1'});
    assert.equal(result.success,true);
    assert.equal(result.contractVersion,1);
    assert.equal(result.customer.internalId,'725');
    assert.equal(result.customer.companyName,'Example District');
    assert.equal(result.customer.webCustomer,true);
    assert.equal(result.customer.taxMetadata.taxitem.value,'12');
    assert.equal(result.addresses[0].internalId,'44');
    assert.equal(result.addresses[0].defaultShipping,true);
    assert.equal(result.addresses[0].countryCode,'US');
    assert.equal(result.contacts[0].internalId,'91');
    assert.deepEqual(Array.from(result.diagnostics.taxFields),['taxable','taxitem']);
    assert.equal(result.diagnostics.taxItem.internalId,'12');
    assert.equal(result.diagnostics.taxItem.rateFields.rate.value,'8.625');
    assert.deepEqual(Array.from(result.issues),[]);
});

test('checkbox strings preserve inactive and non-default address state',()=>{
    const result=fixture({
        addressId:'15',bodyOverrides:{isinactive:'T'},sublistOverrides:{defaultbilling:'F',defaultshipping:'F'},
    }).get({customerId:'725'});
    assert.equal(result.customer.active,false);
    assert.equal(result.addresses[0].defaultBilling,false);
    assert.equal(result.addresses[0].defaultShipping,false);
});

test('address without an immutable NetSuite ID is reported and never replaced by a line index',()=>{
    const value=fixture({addressId:''});
    const result=value.get({customerId:'725'});
    assert.equal(result.addresses[0].internalId,'');
    assert.match(result.issues[0],/no stable internal ID/);
});
