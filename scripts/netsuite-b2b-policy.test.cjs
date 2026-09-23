const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({ignoreDeprecations:'6.0'});
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});

const {assertApprovalAccount,assertCanDecideApproval,assertCanViewApproval}=require('../apps/server/src/plugins/netsuite-sync/b2b-policy');
const {netsuiteApprovalOrderProcess,withAuthorizedOrderTransition}=require('../apps/server/src/plugins/netsuite-sync/netsuite-order-process');
const {NetsuiteBillToTaxZoneStrategy,NetsuiteTaxLineStrategy,netsuiteAddressShippingCalculator}=require('../apps/server/src/plugins/netsuite-sync/b2b-strategies');
const {accountEligibility,contactEligibility,defaultAddressIsStale}=require('../apps/server/src/plugins/netsuite-sync/b2b-lifecycle');

const requester={accountId:10,customerId:100,canApproveOrders:false};
const approver={accountId:'10',customerId:101,canApproveOrders:true};
const selfApprover={accountId:10,customerId:'100',canApproveOrders:true};
const outsider={accountId:20,customerId:200,canApproveOrders:true};
const approval={accountId:10,requesterCustomerId:100};

test('approval policy permits account requester and account approver views only',()=>{
    assert.doesNotThrow(()=>assertCanViewApproval(requester,approval));
    assert.doesNotThrow(()=>assertCanViewApproval(approver,approval));
    assert.throws(()=>assertCanViewApproval(outsider,approval),/not found for this account/);
});

test('approval policy denies ordinary, self, and cross-account decisions',()=>{
    assert.throws(()=>assertCanDecideApproval(requester,approval),/not an order approver/);
    assert.throws(()=>assertCanDecideApproval(selfApprover,approval),/own order/);
    assert.throws(()=>assertCanDecideApproval(outsider,approval),/not found for this account/);
    assert.doesNotThrow(()=>assertCanDecideApproval(approver,approval));
    assert.throws(()=>assertApprovalAccount(outsider,approval));
});

test('contacts requiring approval cannot use the normal payment transition',async()=>{
    netsuiteApprovalOrderProcess.init({get:()=>({contactForCustomer:async()=>({requiresApproval:true})})});
    const result=await netsuiteApprovalOrderProcess.onTransitionStart('AddingItems','ArrangingPayment',{
        ctx:{},order:{id:1,state:'AddingItems',customerId:100},
    });
    assert.match(result,/must submit/);
});

test('approval states reject generic transitions and accept one protected transition',async()=>{
    netsuiteApprovalOrderProcess.init({get:()=>({contactForCustomer:async()=>undefined})});
    const ctx={};const order={id:7,state:'AddingItems'};
    assert.match(await netsuiteApprovalOrderProcess.onTransitionStart('AddingItems','PendingApproval',{ctx,order}),/protected/);
    const result=await withAuthorizedOrderTransition(ctx,order,'PendingApproval',()=>netsuiteApprovalOrderProcess.onTransitionStart('AddingItems','PendingApproval',{ctx,order}));
    assert.equal(result,undefined);
    assert.match(await netsuiteApprovalOrderProcess.onTransitionStart('AddingItems','PendingApproval',{ctx,order}),/protected/);
});

test('tax strategies zero exempt line and shipping tax and retain address rate for taxable accounts',async()=>{
    const exemptLookup={contactForCustomer:async()=>({account:{taxExempt:true}})};
    const lineStrategy=new NetsuiteTaxLineStrategy();lineStrategy.init({get:()=>exemptLookup});
    const line=await lineStrategy.calculate({order:{customerId:100},orderLine:{proratedUnitPrice:1000},applicableTaxRate:{apply:()=>({description:'PA',taxRate:6})}});
    assert.deepEqual(line,[{description:'NetSuite tax-exempt account',taxRate:0}]);

    netsuiteAddressShippingCalculator.init({get:()=>exemptLookup});
    const args=[{name:'rate',value:'500'},{name:'includesTax',value:'exclude'},{name:'taxRate',value:'3'}];
    const exemptShipping=await netsuiteAddressShippingCalculator.calculate({channel:{pricesIncludeTax:false}},{customerId:100,lines:[{taxLines:[{taxRate:6}]}]},args,{});
    assert.equal(exemptShipping.taxRate,0);

    netsuiteAddressShippingCalculator.init({get:()=>({contactForCustomer:async()=>({account:{taxExempt:false}})})});
    const taxableShipping=await netsuiteAddressShippingCalculator.calculate({channel:{pricesIncludeTax:false}},{customerId:101,lines:[{taxLines:[{taxRate:6}]}]},args,{});
    assert.equal(taxableShipping.taxRate,6);
    assert.equal(taxableShipping.price,500);
});

test('tax zone follows the bill-to country rather than the ship-to country',()=>{
    const us={name:'United States',members:[{code:'US'}]};
    const canada={name:'Canada',members:[{code:'CA'}]};
    const strategy=new NetsuiteBillToTaxZoneStrategy();
    const zone=strategy.determineTaxZone({},[us,canada],{defaultTaxZone:us},{
        billingAddress:{countryCode:'US'},shippingAddress:{countryCode:'CA'},
    });
    assert.equal(zone,us);
});

test('account eligibility follows NetSuite active and web-customer flags',()=>{
    assert.deepEqual(accountEligibility({active:true,webCustomer:true}),{active:true,webCustomer:true,eligible:true,issue:null});
    assert.match(accountEligibility({active:false,webCustomer:true}).issue,/inactive/);
    assert.match(accountEligibility({active:true,webCustomer:false}).issue,/not marked as a web customer/);
});

test('contact eligibility suspends removed and inactive NetSuite contacts',()=>{
    const contacts=[{internalId:'10',active:true},{internalId:'11',active:false}];
    assert.equal(contactEligibility('10',contacts).eligible,true);
    assert.match(contactEligibility('11',contacts).issue,/inactive/);
    assert.match(contactEligibility('12',contacts).issue,/no longer present/);
    assert.equal(contactEligibility(null,contacts).eligible,true);
});

test('inactive address reconciliation identifies stale contact defaults',()=>{
    const activeAddressIds=new Set(['20','21']);
    assert.equal(defaultAddressIsStale(20,activeAddressIds),false);
    assert.equal(defaultAddressIsStale(22,activeAddressIds),true);
    assert.equal(defaultAddressIsStale(null,activeAddressIds),false);
});
