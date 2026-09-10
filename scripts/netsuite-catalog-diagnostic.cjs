const path=require('node:path');

require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});
require('ts-node').register({project:path.resolve(__dirname,'../apps/server/tsconfig.json')});

const {NetsuiteService}=require('../apps/server/src/plugins/netsuite-sync/services/netsuite.service');

const env=process.env;
const client=new NetsuiteService({
    accountId:env.NETSUITE_ACCOUNT_ID,
    consumerKey:env.NETSUITE_CONSUMER_KEY,
    consumerSecret:env.NETSUITE_CONSUMER_SECRET,
    tokenId:env.NETSUITE_TOKEN_ID,
    tokenSecret:env.NETSUITE_TOKEN_SECRET,
    itemsUrl:env.NETSUITE_RESTLET_URL,
});

client.fetchCatalog()
    .then(snapshot=>console.log(JSON.stringify({
        count:snapshot.items.length,
        reconciliationSafe:snapshot.reconciliationSafe,
    })))
    .catch(error=>{
        console.error(error instanceof Error?error.message:'Catalog diagnostic failed.');
        process.exitCode=1;
    });
