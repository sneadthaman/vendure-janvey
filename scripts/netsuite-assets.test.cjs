const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});
const {imageFingerprint,localImageFingerprint,validateImageUrl,NetsuiteAssetService}=require('../apps/server/src/plugins/netsuite-sync/services/netsuite-asset.service');
const file={name:'a_01.jpg',url:'https://example.app.netsuite.com/core/media/media.nl?id=1&h=opaque',internalid:'1',modified:'today',size:'10',availableWithoutLogin:true};
test('replacement fingerprint changes for URL, file identity, timestamp or size changes',()=>{
    for(const key of ['url','internalid','modified','size'])assert.notEqual(imageFingerprint(file),imageFingerprint({...file,[key]:file[key]+'changed'}));
    assert.equal(imageFingerprint(file),imageFingerprint({...file}));
});
test('asset downloads reject non-NetSuite URLs and credential-bearing or non-media URLs',()=>{
    assert.equal(validateImageUrl(file.url).hostname,'example.app.netsuite.com');
    for(const url of ['http://example.app.netsuite.com/core/media/media.nl','https://netsuite.com.evil.test/core/media/media.nl','https://127.0.0.1/core/media/media.nl','https://user:pass@example.app.netsuite.com/core/media/media.nl','https://example.app.netsuite.com/login'])assert.throws(()=>validateImageUrl(url));
});
test('local image fingerprints use filename and actual bytes',()=>{
    assert.equal(localImageFingerprint('A.JPG',Buffer.from('one')),localImageFingerprint('a.jpg',Buffer.from('one')));
    assert.notEqual(localImageFingerprint('a.jpg',Buffer.from('one')),localImageFingerprint('a.jpg',Buffer.from('two')));
});
test('unchanged asset is reused without a network call or asset creation',async()=>{
    const existing={id:'7',customFields:{netsuiteSourceFingerprint:imageFingerprint(file)}};
    const service=new NetsuiteAssetService({getRepository:()=>({findOne:async()=>existing})},{create:()=>{throw Error('Unexpected creation');}});
    assert.deepEqual(await service.importImage({},file),{id:'7',reused:true});
});
test('changed local image clears the old sync key and creates a replacement',async()=>{
    const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'netsuite-asset-'));
    const localPath=path.join(tempDir,'replacement_01.jpg');
    const bytes=Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10]);
    fs.writeFileSync(localPath,bytes);
    const existing={id:'7',customFields:{netsuiteSourceFingerprint:'old-fingerprint'}};
    const updates=[];
    let createInput;
    const service=new NetsuiteAssetService(
        {
            getRepository:()=>({findOne:async()=>existing}),
            withTransaction:async(_ctx,work)=>work({transaction:true}),
        },
        {
            update:async(ctx,input)=>updates.push({ctx,input}),
            create:async(_ctx,input)=>{createInput=input;return {id:'8'};},
        },
    );
    try {
        const image={...file,name:'replacement_01.jpg',url:'',localPath};
        assert.deepEqual(await service.importImage({},image),{id:'8',reused:false});
        assert.deepEqual(updates,[{
            ctx:{transaction:true},
            input:{id:'7',customFields:{netsuiteFileName:null,netsuiteSourceFingerprint:null}},
        }]);
        assert.equal(createInput.customFields.netsuiteFileName,image.name);
        assert.equal(createInput.customFields.netsuiteSourceFingerprint,localImageFingerprint(image.name,bytes));
        const upload=await createInput.file;
        const chunks=[];
        for await (const chunk of upload.createReadStream()) chunks.push(Buffer.from(chunk));
        assert.deepEqual(Buffer.concat(chunks),bytes);
    } finally {
        fs.rmSync(tempDir,{recursive:true,force:true});
    }
});
