const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({ignoreDeprecations:'6.0'});
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});

const {RuntimeReadinessController}=require('../apps/server/src/plugins/netsuite-sync/runtime-readiness.controller');

test('readiness verifies the database before reporting success',async()=>{
    const queries=[];
    const controller=new RuntimeReadinessController({rawConnection:{query:async sql=>queries.push(sql)}});
    assert.deepEqual(await controller.ready(),{status:'ok',database:'ok'});
    assert.deepEqual(queries,['SELECT 1']);
});

test('readiness propagates database failures',async()=>{
    const controller=new RuntimeReadinessController({
        rawConnection:{query:async()=>{throw new Error('database unavailable');}},
    });
    await assert.rejects(controller.ready(),/database unavailable/);
});
