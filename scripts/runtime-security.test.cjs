const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({ignoreDeprecations:'6.0'});
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});

const {parseCorsOrigins,requireProductionValue}=require('../apps/server/src/runtime-security');

test('production values reject missing, short, and placeholder secrets',()=>{
    assert.throws(()=>requireProductionValue('COOKIE_SECRET',undefined),/required/);
    assert.throws(()=>requireProductionValue('COOKIE_SECRET','too-short',{minLength:32}),/at least 32/);
    assert.throws(
        ()=>requireProductionValue('SUPERADMIN_PASSWORD','replace-me',{rejectedValues:['replace-me']}),
        /placeholder/,
    );
    assert.throws(
        ()=>requireProductionValue(
            'COOKIE_SECRET',
            'replace-with-at-least-32-random-characters',
            {rejectedValues:['replace-with-at-least-32-random-characters']},
        ),
        /placeholder/,
    );
    assert.equal(
        requireProductionValue('COOKIE_SECRET','01234567890123456789012345678901',{minLength:32}),
        '01234567890123456789012345678901',
    );
});

test('CORS origins are normalized, deduplicated, and may use a safe fallback',()=>{
    assert.deepEqual(
        parseCorsOrigins('https://shop.example.com/, https://admin.example.com,https://shop.example.com'),
        ['https://shop.example.com','https://admin.example.com'],
    );
    assert.deepEqual(parseCorsOrigins(undefined,['http://localhost:3001']),['http://localhost:3001']);
});

test('CORS origins reject paths, non-HTTP protocols, and credentials',()=>{
    assert.throws(()=>parseCorsOrigins('https://example.com/shop'),/without paths/);
    assert.throws(()=>parseCorsOrigins('javascript:alert(1)'),/HTTP/);
    assert.throws(()=>parseCorsOrigins('https://user:password@example.com'),/without paths/);
});
