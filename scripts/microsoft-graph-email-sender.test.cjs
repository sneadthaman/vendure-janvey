const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({ignoreDeprecations:'6.0'});
require('ts-node').register({project:require('node:path').resolve(__dirname,'../apps/server/tsconfig.json')});

const {MicrosoftGraphEmailSender}=require('../apps/server/src/email/microsoft-graph-email-sender');

test('Microsoft Graph sender caches OAuth tokens and submits complete MIME messages',async()=>{
    const originalFetch=global.fetch;
    const requests=[];
    global.fetch=async(url,options)=>{
        requests.push({url:String(url),options});
        if(String(url).includes('/oauth2/v2.0/token'))return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});
        return new Response(null,{status:202});
    };
    try{
        const sender=new MicrosoftGraphEmailSender({tenantId:'tenant-id',clientId:'client-id',clientSecret:'client-secret',senderMailbox:'sjanvey@janvey.com'});
        const email={
            from:'Janvey <sjanvey@janvey.com>',recipient:'buyer@example.com',subject:'Invitation',attachments:[],cc:'manager@example.com',replyTo:'support@janvey.com',
            body:'<p>You have been invited to access the Example purchasing account.</p><a href="http://localhost:3001/account-invitation?token=abc123">Accept your invitation</a><p>This single-use invitation expires tomorrow.</p>',
        };
        await sender.send(email,{type:'none'});
        await sender.send({...email,subject:'Second message'},{type:'none'});
        assert.equal(requests.filter(request=>request.url.includes('/oauth2/v2.0/token')).length,1);
        const sends=requests.filter(request=>request.url.includes('/sendMail'));
        assert.equal(sends.length,2);
        assert.match(sends[0].url,/users\/sjanvey%40janvey\.com\/sendMail$/);
        assert.equal(sends[0].options.headers.Authorization,'Bearer test-token');
        const mime=Buffer.from(sends[0].options.body,'base64').toString('utf8');
        assert.match(mime,/Subject: Invitation/);
        assert.match(mime,/To: buyer@example\.com/);
        assert.match(mime,/Cc: manager@example\.com/);
        assert.doesNotMatch(mime,/(?<!\r)\n/);
        const decoded=mime.replace(/=\r\n/g,'').replace(/=([A-Fa-f0-9]{2})/g,(_match,hex)=>String.fromCharCode(Number.parseInt(hex,16)));
        assert.match(decoded,/invited to access the Example purchasing account/);
        assert.match(decoded,/Accept your invitation/);
        assert.match(decoded,/This single-use invitation expires tomorrow/);
    }finally{global.fetch=originalFetch;}
});

test('Microsoft Graph sender reports token failures without attempting delivery',async()=>{
    const originalFetch=global.fetch;
    let calls=0;
    global.fetch=async()=>{calls++;return new Response(JSON.stringify({error:'invalid_client',error_description:'Client authentication failed'}),{status:401,headers:{'Content-Type':'application/json'}});};
    try{
        const sender=new MicrosoftGraphEmailSender({tenantId:'tenant-id',clientId:'client-id',clientSecret:'bad-secret',senderMailbox:'sjanvey@janvey.com'});
        await assert.rejects(()=>sender.send({from:'sjanvey@janvey.com',recipient:'buyer@example.com',subject:'Test',body:'Test',attachments:[]},{type:'none'}),/token request failed \(401\): Client authentication failed/);
        assert.equal(calls,1);
    }finally{global.fetch=originalFetch;}
});
