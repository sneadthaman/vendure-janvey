const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});
require('ts-node').register({project:path.resolve(__dirname,'../apps/server/tsconfig.json')});
const {NetsuiteService}=require('../apps/server/src/plugins/netsuite-sync/services/netsuite.service');

const client=new NetsuiteService({
    accountId:process.env.NETSUITE_ACCOUNT_ID,
    consumerKey:process.env.NETSUITE_CONSUMER_KEY,
    consumerSecret:process.env.NETSUITE_CONSUMER_SECRET,
    tokenId:process.env.NETSUITE_TOKEN_ID,
    tokenSecret:process.env.NETSUITE_TOKEN_SECRET,
    pricingUrl:process.env.NETSUITE_PRICING_RESTLET_URL||'https://5013697.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2212&deploy=1',
    customersUrl:process.env.NETSUITE_CUSTOMERS_RESTLET_URL,
});

(async()=>{
    const customerId=process.argv[2]||'725';
    const sku=process.argv[3]||'MAJ R04032';
    const price=(await client.fetchCustomerPrices(customerId,[sku])).get(sku);
    if(!price)throw new Error('Customer pricing response omitted the requested SKU.');
    const output={customerId,sku,internalId:price.internalId,price:price.price,basePrice:price.basePrice,source:price.source,purchasable:price.purchasable};
    if(process.env.NETSUITE_CUSTOMERS_RESTLET_URL){
        const verbose=process.argv.includes('--verbose');
        const includeContacts=process.argv.includes('--contacts');
        const customer=await client.fetchCustomer(customerId,{diagnostic:verbose});
        const taxFields=['taxable','taxitem','resalenumber','vatregnumber'];
        const taxMetadata=Object.fromEntries(taxFields.flatMap(field=>{
            const entry=customer.customer.taxMetadata[field];
            return entry?[ [field,{value:entry.value??null,text:entry.text??null}] ]:[];
        }));
        output.customerContract={contractVersion:customer.contractVersion,addressCount:customer.addresses.length,contactCount:customer.contacts.length,issues:customer.issues,...(verbose?{diagnostics:customer.diagnostics}:{})};
        output.customerTax={taxMetadata};
        if(includeContacts){
            output.eligibleContacts=customer.contacts
                .filter(contact=>contact.active&&contact.emailAddress)
                .map(contact=>({
                    internalId:contact.internalId,
                    name:[contact.firstName,contact.lastName].filter(Boolean).join(' ')||contact.entityId,
                    emailAddress:contact.emailAddress,
                }));
        }
    }
    console.log(JSON.stringify(output,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
