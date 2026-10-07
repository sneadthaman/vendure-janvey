const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({ignoreDeprecations:'6.0'});
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});

const {netsuiteAccountTermsEligibilityChecker,netsuiteAccountTermsPaymentHandler}=require('../apps/server/src/plugins/netsuite-sync/account-terms-payment');

const ctx={};
const method={};
const direct={requiresApproval:false,netsuiteContactId:'4710',account:{netsuiteInternalId:'4359'}};
const approval={requiresApproval:true,netsuiteContactId:'4711',account:{netsuiteInternalId:'4359'}};

function initialize(contact){
    const pricing={contactForCustomer:async()=>contact};
    const injector={get:()=>pricing};
    netsuiteAccountTermsEligibilityChecker.init(injector);
    netsuiteAccountTermsPaymentHandler.init(injector);
}

test('account terms are eligible only for a linked direct-purchase contact',async()=>{
    initialize(direct);
    assert.equal(await netsuiteAccountTermsEligibilityChecker.check(ctx,{customerId:73},[],method),true);
    assert.match(await netsuiteAccountTermsEligibilityChecker.check(ctx,{customerId:null},[],method),/Sign in/);
    initialize(undefined);
    assert.match(await netsuiteAccountTermsEligibilityChecker.check(ctx,{customerId:73},[],method),/NetSuite customer account/);
    initialize(approval);
    assert.match(await netsuiteAccountTermsEligibilityChecker.check(ctx,{customerId:73},[],method),/approval/);
});

test('account terms authorize the full total with a stable internal reference',async()=>{
    initialize(direct);
    const order={customerId:73,totalWithTax:3133,code:'ABC123'};
    const result=await netsuiteAccountTermsPaymentHandler.createPayment(ctx,order,3133,[],{},method);
    assert.equal(result.state,'Authorized');
    assert.equal(result.amount,3133);
    assert.equal(result.transactionId,'NETSUITE-TERMS-ABC123');
    assert.deepEqual(result.metadata,{
        paymentType:'netsuite-account-terms',
        netsuiteCustomerInternalId:'4359',
        netsuiteContactInternalId:'4710',
    });
});

test('account terms reject bypasses and cannot be marked settled locally',async()=>{
    initialize(approval);
    const order={customerId:73,totalWithTax:3133,code:'ABC123'};
    assert.equal((await netsuiteAccountTermsPaymentHandler.createPayment(ctx,order,3133,[],{},method)).state,'Error');
    initialize(direct);
    assert.equal((await netsuiteAccountTermsPaymentHandler.createPayment(ctx,order,3000,[],{},method)).state,'Error');
    assert.deepEqual(await netsuiteAccountTermsPaymentHandler.settlePayment(ctx,order,{},[],method),{
        success:false,errorMessage:'Account-terms payments are settled through NetSuite.',
    });
    assert.deepEqual(await netsuiteAccountTermsPaymentHandler.cancelPayment(ctx,order,{},[],method),{success:true});
});
