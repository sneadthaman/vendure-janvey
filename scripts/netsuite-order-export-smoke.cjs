const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});
const axios=require('axios');
const OAuth=require('oauth-1.0a');
const crypto=require('crypto-js');
const {Client}=require('pg');

const ledgerId=process.argv.find(value=>/^\d+$/.test(value))||'3';
const recoveryMode=process.argv.includes('--recovery');
const inspectExisting=process.argv.includes('--inspect-existing');

function required(name){
    const value=process.env[name]?.trim();
    if(!value)throw new Error(`${name} is required.`);
    return value;
}

async function signedRequest(method,body){
    const endpoint=required('NETSUITE_ORDERS_RESTLET_URL');
    const url=new URL(endpoint);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.restlets.api.netsuite.com'))throw new Error('Invalid NetSuite order RESTlet URL.');
    const oauth=new OAuth({
        consumer:{key:required('NETSUITE_CONSUMER_KEY'),secret:required('NETSUITE_CONSUMER_SECRET')},
        signature_method:'HMAC-SHA256',
        hash_function:(base,key)=>crypto.HmacSHA256(base,key).toString(crypto.enc.Base64),
    });
    const auth=oauth.toHeader(oauth.authorize({url:url.toString(),method},{key:required('NETSUITE_TOKEN_ID'),secret:required('NETSUITE_TOKEN_SECRET')}));
    return axios.request({
        url:url.toString(),method,data:body,timeout:30000,maxRedirects:0,
        headers:{Authorization:`${auth.Authorization}, realm="${required('NETSUITE_ACCOUNT_ID')}"`,'Content-Type':'application/json'},
    });
}

async function main(){
    if(process.env.NETSUITE_ORDER_EXPORT_MODE!=='dry-run')throw new Error('Smoke verification requires NETSUITE_ORDER_EXPORT_MODE=dry-run.');
    const shippingMethodInternalId=required('NETSUITE_ORDER_SHIPPING_METHOD_ID');
    const db=new Client({
        host:required('DB_HOST'),port:Number(required('DB_PORT')),database:required('DB_NAME'),
        user:required('DB_USERNAME'),password:required('DB_PASSWORD'),
    });
    await db.connect();
    let row;
    try{
        row=(await db.query('SELECT id,"externalId",status,"payloadJson" FROM netsuite_order_export WHERE id=$1',[ledgerId])).rows[0];
    }finally{await db.end();}
    const eligibleStatus=row&&(row.status==='validated'||recoveryMode&&row.status==='failed');
    if(!eligibleStatus||!row.payloadJson)throw new Error(`Ledger ${ledgerId} is not a ${recoveryMode?'failed or validated':'validated'} dry-run candidate.`);
    const payload=JSON.parse(row.payloadJson);
    if(payload.externalId!==row.externalId||!recoveryMode&&payload.dryRun!==true)throw new Error('Stored payload is not a consistent request for this ledger.');
    const dryRunPayload={...payload,dryRun:true};

    const discovery=(await signedRequest('GET')).data;
    if(discovery?.success!==true||discovery.contractVersion!==1||!Array.isArray(discovery.shippingItems))throw new Error('Invalid Shipping Item discovery response.');
    const shipping=discovery.shippingItems.find(item=>String(item.internalId)===shippingMethodInternalId);
    if(!shipping)throw new Error(`Shipping Item ${shippingMethodInternalId} is not active or visible to the integration role.`);

    let rejectedInvalidShipping=false,existingExternalIdDetected=false;
    try{
        const probe=(await signedRequest('POST',{...dryRunPayload,shippingMethodInternalId:'999999999'})).data;
        existingExternalIdDetected=probe?.success===true&&probe.externalId===row.externalId;
    }catch(error){
        rejectedInvalidShipping=axios.isAxiosError(error)&&Boolean(error.response);
    }
    if(recoveryMode&&existingExternalIdDetected){
        if(inspectExisting){
            const existing=(await signedRequest('POST',{...payload,dryRun:false})).data;
            console.log(JSON.stringify({
                verified:true,recoveryMode:true,ledgerId:String(row.id),externalId:row.externalId,
                existingExternalIdDetected:true,createdByProbe:false,
                response:{
                    success:existing?.success,contractVersion:existing?.contractVersion,dryRun:existing?.dryRun,
                    idempotent:existing?.idempotent,internalId:existing?.internalId,transactionId:existing?.transactionId,
                    subtotalCents:existing?.subtotalCents,shippingCents:existing?.shippingCents,
                    taxCents:existing?.taxCents,totalCents:existing?.totalCents,
                },
            },null,2));
            return;
        }
        console.log(JSON.stringify({
            verified:true,recoveryMode:true,ledgerId:String(row.id),externalId:row.externalId,
            existingExternalIdDetected:true,dryRun:true,createdByProbe:false,
        },null,2));
        return;
    }
    if(recoveryMode){
        if(!rejectedInvalidShipping)throw new Error('The recovery probe did not return a conclusive result.');
        console.log(JSON.stringify({
            verified:true,recoveryMode:true,ledgerId:String(row.id),externalId:row.externalId,
            existingExternalIdDetected:false,dryRun:true,createdByProbe:false,
        },null,2));
        return;
    }
    if(!rejectedInvalidShipping)throw new Error('The deployed RESTlet did not reject an invalid Shipping Item; redeploy the current script before live export.');

    const result=(await signedRequest('POST',{...dryRunPayload,shippingMethodInternalId})).data;
    if(result?.success!==true||result.contractVersion!==1||result.dryRun!==true||result.externalId!==row.externalId||result.internalId!==null||result.transactionId!==null){
        throw new Error('The live dry-run response was invalid or returned a transaction identifier.');
    }
    console.log(JSON.stringify({
        verified:true,recoveryMode,ledgerId:String(row.id),externalId:row.externalId,existingExternalIdDetected:false,
        shippingItem:{internalId:String(shipping.internalId),name:String(shipping.name||'')},
        invalidShippingRejected:true,dryRun:result.dryRun,internalId:result.internalId,transactionId:result.transactionId,
    },null,2));
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
