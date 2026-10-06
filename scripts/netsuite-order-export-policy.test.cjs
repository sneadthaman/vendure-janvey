const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({ignoreDeprecations:'6.0'});
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});

const {shouldResumeOrderExport}=require('../apps/server/src/plugins/netsuite-sync/order-export-policy');

test('dry-run mode safely resumes incomplete validations',()=>{
    assert.equal(shouldResumeOrderExport('dry-run','pending',null),true);
    assert.equal(shouldResumeOrderExport('dry-run','failed',JSON.stringify({dryRun:true})),true);
    assert.equal(shouldResumeOrderExport('dry-run','exporting',JSON.stringify({dryRun:true})),true);
    assert.equal(shouldResumeOrderExport('dry-run','validated',JSON.stringify({dryRun:true})),false);
});

test('live startup resumes only records already attempted live',()=>{
    assert.equal(shouldResumeOrderExport('live','failed',JSON.stringify({dryRun:false})),true);
    assert.equal(shouldResumeOrderExport('live','exporting',JSON.stringify({dryRun:false})),true);
    assert.equal(shouldResumeOrderExport('live','pending',null),false);
    assert.equal(shouldResumeOrderExport('live','failed',JSON.stringify({dryRun:true})),false);
    assert.equal(shouldResumeOrderExport('live','failed','invalid JSON'),false);
    assert.equal(shouldResumeOrderExport('live','validated',JSON.stringify({dryRun:true})),false);
});

test('disabled mode never resumes exports',()=>{
    assert.equal(shouldResumeOrderExport('disabled','failed',JSON.stringify({dryRun:false})),false);
});
