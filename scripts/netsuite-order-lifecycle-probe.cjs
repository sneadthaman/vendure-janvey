const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});
const axios=require('axios');
const OAuth=require('oauth-1.0a');
const crypto=require('crypto-js');

function required(name){
    const value=process.env[name]?.trim();
    if(!value)throw new Error(`${name} is required.`);
    return value;
}

async function main(){
    const internalId=process.argv.find(value=>/^\d+$/.test(value));
    const fulfillmentMode=process.argv.includes('--fulfillment');
    if(!internalId)throw new Error(`Pass a numeric NetSuite ${fulfillmentMode?'Item Fulfillment':'Sales Order'} internal ID.`);
    const url=new URL(required('NETSUITE_ORDERS_RESTLET_URL'));
    if(url.protocol!=='https:'||!url.hostname.endsWith('.restlets.api.netsuite.com'))throw new Error('Invalid NetSuite order RESTlet URL.');
    url.searchParams.set(fulfillmentMode?'fulfillmentInternalId':'salesOrderInternalId',internalId);
    const oauth=new OAuth({
        consumer:{key:required('NETSUITE_CONSUMER_KEY'),secret:required('NETSUITE_CONSUMER_SECRET')},
        signature_method:'HMAC-SHA256',
        hash_function:(base,key)=>crypto.HmacSHA256(base,key).toString(crypto.enc.Base64),
    });
    const target=url.toString();
    const auth=oauth.toHeader(oauth.authorize({url:target,method:'GET'},{
        key:required('NETSUITE_TOKEN_ID'),secret:required('NETSUITE_TOKEN_SECRET'),
    }));
    const response=await axios.get(target,{
        timeout:30000,maxRedirects:0,
        headers:{Authorization:`${auth.Authorization}, realm="${required('NETSUITE_ACCOUNT_ID')}"`},
    });
    const result=typeof response.data==='string'?JSON.parse(response.data):response.data;
    const valid=fulfillmentMode
        ? String(result?.fulfillment?.internalId)===internalId&&Array.isArray(result.links)
        : String(result?.salesOrder?.internalId)===internalId&&Array.isArray(result.fulfillments)&&Array.isArray(result.invoices);
    if(result?.success!==true||result.contractVersion!==1||!valid)throw new Error('Invalid NetSuite order lifecycle response.');
    console.log(JSON.stringify(result,null,2));
}

main().catch(error=>{
    const response=axios.isAxiosError(error)?error.response?.data:undefined;
    console.error(response?JSON.stringify(response):error.message);
    process.exitCode=1;
});
