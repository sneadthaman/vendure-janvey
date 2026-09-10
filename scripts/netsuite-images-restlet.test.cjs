const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../netsuite/vendure-netsuite-images-restlet.js'), 'utf8');
function fixture(count = 1003, columnNames = ['result0','result1','result2','result3','result4','result5','result6','result7']) {
    let endpoint, loadedId;
    vm.runInNewContext(source, {define: (_, factory) => {
        endpoint = factory({load:({id}) => {
            loadedId = id;
            return {columns:columnNames.map(name=>({name})),runPaged:()=>({count,fetch:({index})=>({data:Array.from({length:Math.min(1000,count-index*1000)},(_,i)=>({getValue:column=>{
                const position=columnNames.indexOf(column.name);
                return [String(index*1000+i+1),`token${index*1000+i+1}_01.jpg`,'Product Images','12','/core/media/media.nl?id=1&h=opaque','created','today','JPEG'][position];
            }}))})})};
        },create:()=>({runPaged:()=>({count:1})})},{load:()=>({id:'72239'})},{HostType:{APPLICATION:'APPLICATION'},resolveDomain:()=> 'example.app.netsuite.com'}, {accountId:'example',getCurrentScript:()=>({getRemainingUsage:()=>4990})});
    }});
    return {get:params=>endpoint.get(params),loadedId:()=>loadedId};
}
test('manifest paginates across search pages without duplicating/skipping files',()=>{
    const f=fixture();const result=f.get({offset:'998',limit:'5'});
    assert.deepEqual(Array.from(result.files,x=>x.internalid),['999','1000','1001','1002','1003']);
    assert.equal(result.total,1003);assert.equal(result.count,5);
    assert.equal(result.files[0].url,'https://example.app.netsuite.com/core/media/media.nl?id=1&h=opaque');
    assert.equal(result.files[0].availableWithoutLogin,false);
    assert.equal(f.loadedId(),'2118');
});
test('empty and exhausted folders return a terminal page',()=>{
    assert.equal(fixture(0).get({}).count,0);
    assert.equal(fixture(2).get({offset:'2'}).count,0);
});
test('invalid pagination is rejected rather than silently misreading the folder',()=>{
    for(const params of [{limit:'0'},{limit:'1001'},{offset:'-1'},{offset:'1x'}]) assert.throws(()=>fixture().get(params));
});
test('saved search must expose immutable ID, filename, and URL columns',()=>{
    assert.throws(()=>fixture(1,['internalid','name']).get({}),/missing the url result column/);
});
test('diagnostic distinguishes direct file access from search visibility',()=>{
    const result=fixture(0).get({diagnostic:'1'});
    assert.equal(result.diagnostics.savedSearchCount,0);
    assert.equal(result.diagnostics.knownFileLoad,true);
    assert.equal(result.diagnostics.knownFileSearchCount,1);
});
