const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});
const endpoint='http://localhost:3000/admin-api';
let token;
async function request(query,variables={}){
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({query,variables})});
    const result=await response.json();
    const next=response.headers.get('vendure-auth-token');if(next)token=next;
    if(result.errors)throw Error(result.errors.map(e=>e.message).join('; '));
    return result.data;
}
(async()=>{
    const auth=await request('mutation Login($username:String!,$password:String!){login(username:$username,password:$password){__typename}}',{username:process.env.SUPERADMIN_USERNAME,password:process.env.SUPERADMIN_PASSWORD});
    if(auth.login.__typename!=='CurrentUser')throw Error('Admin login failed');
    const argument=process.argv[2]||'3';
    if(argument==='categories'){
        const data=await request('mutation {refreshNetsuiteCollections}');
        console.log(JSON.stringify(data.refreshNetsuiteCollections,null,2));
        return;
    }
    const sampleSize=argument==='full'?undefined:Number(argument);
    if(sampleSize!==undefined&&(!Number.isInteger(sampleSize)||sampleSize<1||sampleSize>100))throw Error('Use a sample size from 1 to 100, "full", or "categories".');
    const data=await request('mutation Start($size:Int){startNetsuiteSync(sampleSize:$size){id status}}',{size:sampleSize});
    const id=data.startNetsuiteSync.id;console.log(`Started ${sampleSize===undefined?'full':'sample'} run`,id);
    for(let poll=0;poll<180;poll++){
        const result=await request('{netsuiteSyncRuns{id status counts issues reconciliationPerformed}}');
        const run=result.netsuiteSyncRuns.find(r=>r.id===id);
        if(!run)throw Error('Run disappeared');
        if(['completed','completed_with_errors','failed'].includes(run.status)){console.log(JSON.stringify(run,null,2));if(run.status!=='completed')process.exitCode=1;return;}
        if(poll%5===0)console.log(run.status,JSON.stringify(run.counts));
        await new Promise(resolve=>setTimeout(resolve,2000));
    }
    throw Error('Timed out observing run; inspect its status before restarting.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
