const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});

const endpoint='http://localhost:3000/admin-api';
let token;

async function request(query,variables={}){
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({query,variables})});
    const result=await response.json();
    const next=response.headers.get('vendure-auth-token');if(next)token=next;
    if(result.errors)throw new Error(result.errors.map(error=>error.message).join('; '));
    return result.data;
}

async function main(){
    const code=process.argv[2]?.trim();
    if(!code||!/^[A-Za-z0-9._-]+$/.test(code))throw new Error('Pass a Vendure order code.');
    const auth=await request('mutation Login($username:String!,$password:String!){login(username:$username,password:$password){__typename}}',{
        username:process.env.SUPERADMIN_USERNAME,password:process.env.SUPERADMIN_PASSWORD,
    });
    if(auth.login.__typename!=='CurrentUser')throw new Error('Admin login failed.');
    const exports=await request('{netsuiteOrderExports{order{id code} status netsuiteInternalId}}');
    const record=exports.netsuiteOrderExports.find(value=>value.order.code===code);
    if(!record)throw new Error(`No NetSuite export ledger was found for order ${code}.`);
    const result=await request('mutation Refresh($orderId:ID!){refreshNetsuiteOrderLifecycle(orderId:$orderId)}',{orderId:record.order.id});
    console.log(JSON.stringify(result.refreshNetsuiteOrderLifecycle,null,2));
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
