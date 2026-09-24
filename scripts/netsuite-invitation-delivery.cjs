const path=require('node:path');

require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});

const endpoint='http://localhost:3000/admin-api';
let token;

async function request(query,variables={}){
    const response=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({query,variables}),
    });
    const result=await response.json();
    const nextToken=response.headers.get('vendure-auth-token');
    if(nextToken)token=nextToken;
    if(result.errors)throw new Error(result.errors.map(error=>error.message).join('; '));
    return result.data;
}

(async()=>{
    const accountInternalId=process.argv[2];
    const recipient=process.argv[3]?.trim().toLowerCase();
    const send=process.argv.includes('--send');
    const status=process.argv.includes('--status');
    if(!status&&(!/^\d+$/.test(accountInternalId||'')||!recipient)){
        throw new Error('Usage: node scripts/netsuite-invitation-delivery.cjs <NetSuite customer ID> <contact email> [--send]');
    }

    const auth=await request(
        'mutation Login($username:String!,$password:String!){login(username:$username,password:$password){__typename}}',
        {username:process.env.SUPERADMIN_USERNAME,password:process.env.SUPERADMIN_PASSWORD},
    );
    if(auth.login.__typename!=='CurrentUser')throw new Error('Admin login failed.');

    if(status){
        const result=await request('{jobs(options:{take:20,sort:{createdAt:DESC}}){items{id createdAt settledAt queueName state error attempts}} netsuiteContactInvitations{id emailAddress netsuiteContactId expiresAt acceptedAt revokedAt account{companyName}} netsuiteAccounts{id netsuiteInternalId companyName contacts{netsuiteContactId requiresApproval canApproveOrders active eligibilityIssue defaultShippingAddress{id label} customer{id firstName lastName emailAddress}}}}');
        const latestInvitation=result.netsuiteContactInvitations[0]??null;
        const linkedContact=result.netsuiteAccounts
            .flatMap(account=>account.contacts.map(contact=>({account:{id:account.id,netsuiteInternalId:account.netsuiteInternalId,companyName:account.companyName},...contact})))
            .find(contact=>latestInvitation&&contact.netsuiteContactId===latestInvitation.netsuiteContactId&&contact.customer.emailAddress.trim().toLowerCase()===latestInvitation.emailAddress.trim().toLowerCase())??null;
        console.log(JSON.stringify({
            latestInvitation,
            linkedContact,
            recentInvitations:result.netsuiteContactInvitations.slice(0,3),
            emailJobs:result.jobs.items.filter(job=>job.queueName==='send-email').slice(0,5),
        },null,2));
        return;
    }

    const accounts=await request('{netsuiteAccounts{id netsuiteInternalId companyName active webCustomer}}');
    const account=accounts.netsuiteAccounts.find(item=>item.netsuiteInternalId===accountInternalId&&item.active&&item.webCustomer);
    if(!account)throw new Error(`Eligible imported NetSuite account ${accountInternalId} was not found.`);

    const inspection=await request(
        'query Inspect($customerId:String!){inspectNetsuiteCustomer(customerId:$customerId)}',
        {customerId:accountInternalId},
    );
    const contact=inspection.inspectNetsuiteCustomer.contacts.find(item=>item.active&&item.emailAddress?.trim().toLowerCase()===recipient);
    if(!contact)throw new Error(`No active contact with email ${recipient} exists on NetSuite account ${accountInternalId}.`);

    if(!send){
        console.log(JSON.stringify({ready:true,account:account.companyName,accountInternalId,contactId:contact.internalId,recipient},null,2));
        return;
    }

    const result=await request(
        'mutation Invite($input:InviteNetsuiteContactInput!){inviteNetsuiteContact(input:$input){id emailAddress netsuiteContactId expiresAt account{companyName}}}',
        {input:{accountId:account.id,netsuiteContactId:contact.internalId,requiresApproval:false,canApproveOrders:false}},
    );
    console.log(JSON.stringify({
        sent:true,
        invitationId:result.inviteNetsuiteContact.id,
        recipient:result.inviteNetsuiteContact.emailAddress,
        contactId:result.inviteNetsuiteContact.netsuiteContactId,
        account:result.inviteNetsuiteContact.account.companyName,
        expiresAt:result.inviteNetsuiteContact.expiresAt,
    },null,2));
})().catch(error=>{
    console.error(error.message);
    process.exitCode=1;
});
