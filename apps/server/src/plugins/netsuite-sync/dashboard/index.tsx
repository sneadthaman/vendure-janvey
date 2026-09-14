import { api, Button, defineDashboardExtension, Page, PageBlock, PageLayout, PageTitle } from '@vendure/dashboard';
import { useCallback, useEffect, useState } from 'react';

interface Run {
    id:string; status:string; createdAt:string; sampleSize:number|null;
    counts:Record<string,number>; issues:Array<{itemId?:string;message:string}>;
    reconciliationPerformed:boolean;
}
interface Customer {id:string;firstName:string;lastName:string;emailAddress:string;}
interface Address {id:string;label:string|null;streetLine1:string;city:string;province:string;postalCode:string;active:boolean;}
interface Contact {id:string;customer:Customer;netsuiteContactId:string|null;requiresApproval:boolean;canApproveOrders:boolean;defaultShippingAddress:Address|null;}
interface Account {id:string;netsuiteInternalId:string;companyName:string;taxable:boolean;taxExempt:boolean;lastSyncedAt:string|null;addresses:Address[];contacts:Contact[];}
interface CustomerRun {id:string;createdAt:string;status:string;netsuiteCustomerId:string;counts:Record<string,number>;issues:Array<{code:string;message:string}>;}
interface Approval {id:string;createdAt:string;status:string;order:{id:string;code:string;state:string;totalWithTax:number;currencyCode:string};requester:Customer|null;account:Account;}
const runsQuery=`query { netsuiteSyncRuns { id status createdAt sampleSize counts issues reconciliationPerformed } }`;
const startMutation=`mutation StartNetsuiteSync($sampleSize:Int) { startNetsuiteSync(sampleSize:$sampleSize) { id } }`;
const refreshCollectionsMutation=`mutation { refreshNetsuiteCollections }`;
const activeStates=['queued','fetching','syncing','reconciling','categorizing'];
const accountsQuery=`query { netsuiteAccounts { id netsuiteInternalId companyName taxable taxExempt lastSyncedAt addresses { id label streetLine1 city province postalCode active } contacts { id netsuiteContactId requiresApproval canApproveOrders customer { id firstName lastName emailAddress } defaultShippingAddress { id label } } } netsuiteCustomerSyncRuns { id createdAt status netsuiteCustomerId counts issues } netsuiteApprovalOrders { id createdAt status order { id code state totalWithTax currencyCode } requester { id firstName lastName emailAddress } account { id companyName } } }`;
const findCustomersQuery=`query FindCustomers($options:CustomerListOptions){customers(options:$options){items{id firstName lastName emailAddress}}}`;
const inspectCustomerQuery=`query Inspect($customerId:String!){inspectNetsuiteCustomer(customerId:$customerId)}`;
const syncCustomerMutation=`mutation Sync($customerId:String!){syncNetsuiteCustomer(customerId:$customerId){id}}`;
const linkCustomerMutation=`mutation Link($input:LinkNetsuiteCustomerInput!){linkNetsuiteCustomer(input:$input)}`;
const updateLinkMutation=`mutation Update($input:UpdateNetsuiteContactLinkInput!){updateNetsuiteContactLink(input:$input)}`;
const unlinkCustomerMutation=`mutation Unlink($customerId:ID!){unlinkNetsuiteCustomer(customerId:$customerId)}`;
const resolveApprovalMutation=`mutation Resolve($id:ID!,$action:String!,$comment:String){resolveNetsuiteApprovalOrder(id:$id,action:$action,comment:$comment){id status}}`;

function NetsuiteCatalogPage(){
    const [runs,setRuns]=useState<Run[]>([]);
    const [error,setError]=useState('');
    const [starting,setStarting]=useState(false);
    const [refreshingCollections,setRefreshingCollections]=useState(false);
    const refresh=useCallback(async()=>{
        try{const result=await api.query<{netsuiteSyncRuns:Run[]}>(runsQuery);setRuns(result.netsuiteSyncRuns);setError('');}
        catch(e){setError(e instanceof Error?e.message:'Could not load sync progress.');}
    },[]);
    useEffect(()=>{void refresh();const interval=setInterval(()=>void refresh(),3000);return()=>clearInterval(interval);},[refresh]);
    const active=runs.some(run=>activeStates.includes(run.status));
    async function start(sampleSize:number|null){
        setStarting(true);setError('');
        try{await api.mutate(startMutation,{sampleSize});await refresh();}
        catch(e){setError(e instanceof Error?e.message:'Could not start sync.');}
        finally{setStarting(false);}
    }
    async function refreshCollections(){
        setRefreshingCollections(true);setError('');
        try{await api.mutate(refreshCollectionsMutation);await refresh();}
        catch(e){setError(e instanceof Error?e.message:'Could not refresh category memberships.');}
        finally{setRefreshingCollections(false);}
    }
    return <Page pageId="netsuite-catalog-sync">
        <PageTitle>NetSuite catalog sync</PageTitle>
        <PageLayout><PageBlock column="main" blockId="netsuite-sync-controls">
            <p className="mb-4">Import NetSuite products, Online Prices and images. Locked product content is preserved. No NetSuite records are changed.</p>
            <div className="flex gap-3 mb-4">
                <Button disabled={starting||active} onClick={()=>void start(10)}>Sync 10 sample items</Button>
                <Button variant="secondary" disabled={starting||active} onClick={()=>void start(null)}>Sync full catalog</Button>
                <Button variant="outline" disabled={starting||refreshingCollections||active} onClick={()=>void refreshCollections()}>Refresh category memberships</Button>
            </div>
            <p className="text-sm mb-4">Sample runs never disable missing products. Full runs reconcile only after completeness and item-success checks pass.</p>
            {error&&<p role="alert" className="text-destructive">{error}</p>}
            {runs.map(run=>{
                const target=run.sampleSize?Math.min(run.sampleSize,run.counts.fetched||0):run.counts.fetched||0;
                return <section key={run.id} className="border rounded p-4 my-4">
                    <h2 className="font-semibold">Run {run.id} · {run.sampleSize?'Sample':'Full catalog'} · {run.status.replace(/_/g,' ')}</h2>
                    <p>{new Date(run.createdAt).toLocaleString()}</p>
                    <p aria-live="polite">Processed {run.counts.processed||0} of {target}</p>
                    <progress className="w-full" value={run.counts.processed||0} max={target||1}/>
                    <dl className="grid grid-cols-3 gap-2 my-3">{['created','updated','skipped','disabled','failed','imageFailures','imagesImported','imagesReused','collectionsCreated','collectionsRefreshed','categoriesPendingReview','unclassifiedProducts','categoryFailures','demoProductsDisabled'].map(key=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{run.counts[key]||0}</dd></div>)}</dl>
                    <p>Missing-product reconciliation: {run.reconciliationPerformed?'performed':'not performed'}</p>
                    {run.issues.length>0&&<details><summary>Issues ({run.issues.length}, first 100 shown)</summary><ul>{run.issues.map((issue,index)=><li key={index}>{issue.itemId?`${issue.itemId}: `:''}{issue.message}</li>)}</ul></details>}
                </section>;
            })}
        </PageBlock></PageLayout>
    </Page>;
}

function NetsuiteCustomersPage(){
    const [accounts,setAccounts]=useState<Account[]>([]);const [runs,setRuns]=useState<CustomerRun[]>([]);const [approvals,setApprovals]=useState<Approval[]>([]);
    const [customers,setCustomers]=useState<Customer[]>([]);const [netsuiteId,setNetsuiteId]=useState('');const [search,setSearch]=useState('');
    const [inspection,setInspection]=useState<unknown>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
    const refresh=useCallback(async()=>{try{const result=await api.query<{netsuiteAccounts:Account[];netsuiteCustomerSyncRuns:CustomerRun[];netsuiteApprovalOrders:Approval[]}>(accountsQuery);setAccounts(result.netsuiteAccounts);setRuns(result.netsuiteCustomerSyncRuns);setApprovals(result.netsuiteApprovalOrders);setError('');}catch(e){setError(message(e));}},[]);
    useEffect(()=>{void refresh();},[refresh]);
    async function inspect(sync:boolean){setBusy(true);setError('');try{if(sync){await api.mutate(syncCustomerMutation,{customerId:netsuiteId.trim()});await refresh();}else{const result=await api.query<{inspectNetsuiteCustomer:unknown}>(inspectCustomerQuery,{customerId:netsuiteId.trim()});setInspection(result.inspectNetsuiteCustomer);}}catch(e){setError(message(e));}finally{setBusy(false);}}
    async function findCustomers(){try{const term=search.trim();const result=await api.query<{customers:{items:Customer[]}}>(findCustomersQuery,{options:{take:25,filter:{_or:[{emailAddress:{contains:term}},{firstName:{contains:term}},{lastName:{contains:term}}]}}});setCustomers(result.customers.items);}catch(e){setError(message(e));}}
    async function link(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);try{await api.mutate(linkCustomerMutation,{input:{customerId:data.get('customerId'),accountId:data.get('accountId'),netsuiteContactId:String(data.get('netsuiteContactId')||'')||null,defaultShippingAddressId:String(data.get('addressId')||'')||null,requiresApproval:data.get('requiresApproval')==='on',canApproveOrders:data.get('canApproveOrders')==='on'}});await refresh();event.currentTarget.reset();}catch(e){setError(message(e));}finally{setBusy(false);}}
    async function update(contact:Contact,input:Record<string,unknown>){try{await api.mutate(updateLinkMutation,{input:{customerId:contact.customer.id,...input}});await refresh();}catch(e){setError(message(e));}}
    async function unlink(contact:Contact){try{await api.mutate(unlinkCustomerMutation,{customerId:contact.customer.id});await refresh();}catch(e){setError(message(e));}}
    async function resolve(id:string,action:string){try{await api.mutate(resolveApprovalMutation,{id,action,comment:'Resolved by staff in Dashboard'});await refresh();}catch(e){setError(message(e));}}
    return <Page pageId="netsuite-customers"><PageTitle>NetSuite customer accounts</PageTitle><PageLayout><PageBlock column="main" blockId="netsuite-customer-controls">
        <p className="mb-4">Only Customer Master records marked as web customers can be found or imported. NetSuite remains authoritative for company, tax, contacts and ship-to addresses. Linking a Vendure login is always an explicit staff action.</p>
        {error&&<p role="alert" className="mb-4 text-destructive">{error}</p>}
        <section className="mb-8 rounded border p-4"><h2 className="font-semibold mb-3">Import or refresh a NetSuite customer</h2><p className="mb-3 text-sm">Use NetSuite Saved Search <strong>Web Customers</strong> to copy the customer internal ID. Import verifies <code>custentity_web_customer</code> directly, so unflagged records cannot be added.</p><div className="flex gap-2"><input className="flex-1 rounded border px-3" value={netsuiteId} onChange={e=>setNetsuiteId(e.target.value)} placeholder="NetSuite customer internal ID"/><Button disabled={busy||!/^\d+$/.test(netsuiteId.trim())} onClick={()=>void inspect(false)}>Inspect</Button><Button disabled={busy||!/^\d+$/.test(netsuiteId.trim())} onClick={()=>void inspect(true)}>Import / refresh</Button></div>{inspection!==undefined&&<pre className="mt-3 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(inspection,null,2)}</pre>}</section>
        <section className="mb-8 rounded border p-4"><h2 className="font-semibold mb-3">Link a Vendure contact</h2><div className="flex gap-2 mb-3"><input className="flex-1 rounded border px-3" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email"/><Button onClick={()=>void findCustomers()}>Find contacts</Button></div><form onSubmit={link} className="grid gap-3 md:grid-cols-2">
            <select name="customerId" required className="rounded border px-3 py-2"><option value="">Vendure contact</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName} · {customer.emailAddress}</option>)}</select>
            <select name="accountId" required className="rounded border px-3 py-2"><option value="">NetSuite account</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.companyName} ({account.netsuiteInternalId})</option>)}</select>
            <input name="netsuiteContactId" className="rounded border px-3" placeholder="NetSuite contact ID (optional)"/><input name="addressId" className="rounded border px-3" placeholder="Default local address ID (optional)"/>
            <label><input name="requiresApproval" type="checkbox"/> Requires approval</label><label><input name="canApproveOrders" type="checkbox"/> Can approve orders</label><Button disabled={busy} type="submit">Link contact</Button>
        </form></section>
        <section className="space-y-4"><h2 className="text-lg font-semibold">Accounts</h2>{accounts.map(account=><article key={account.id} className="rounded border p-4"><h3 className="font-semibold">{account.companyName} · NetSuite {account.netsuiteInternalId}</h3><p className="text-sm">Tax: {account.taxExempt?'exempt':account.taxable?'taxable':'not taxable'} · Last sync: {account.lastSyncedAt?new Date(account.lastSyncedAt).toLocaleString():'never'}</p><p className="text-sm">Ship-to addresses: {account.addresses.filter(a=>a.active).map(a=>`${a.id}: ${a.label||a.streetLine1}, ${a.city}`).join(' · ')||'none'}</p>
            {account.contacts.map(contact=><div key={contact.id} className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3"><span className="min-w-64">{contact.customer.firstName} {contact.customer.lastName} · {contact.customer.emailAddress}</span><label><input type="checkbox" checked={contact.requiresApproval} onChange={e=>void update(contact,{requiresApproval:e.target.checked})}/> Requires approval</label><label><input type="checkbox" checked={contact.canApproveOrders} onChange={e=>void update(contact,{canApproveOrders:e.target.checked})}/> Approver</label><select value={contact.defaultShippingAddress?.id||''} onChange={e=>void update(contact,{defaultShippingAddressId:e.target.value||null})} className="rounded border px-2 py-1"><option value="">No default ship-to</option>{account.addresses.filter(a=>a.active).map(address=><option key={address.id} value={address.id}>{address.label||address.streetLine1}</option>)}</select><Button variant="outline" onClick={()=>void unlink(contact)}>Unlink</Button></div>)}
        </article>)}</section>
        <section className="mt-8 space-y-3"><h2 className="text-lg font-semibold">Approval recovery</h2>{approvals.filter(a=>a.status==='pending').map(approval=><div key={approval.id} className="flex flex-wrap items-center gap-3 rounded border p-3"><span>#{approval.order.code} · {approval.account.companyName} · {approval.requester?.emailAddress||'unknown requester'} · {(approval.order.totalWithTax/100).toLocaleString(undefined,{style:'currency',currency:approval.order.currencyCode})}</span><Button onClick={()=>void resolve(approval.id,'approve')}>Approve</Button><Button variant="secondary" onClick={()=>void resolve(approval.id,'reject')}>Reject</Button><Button variant="destructive" onClick={()=>void resolve(approval.id,'cancel')}>Cancel</Button></div>)}</section>
        <section className="mt-8"><h2 className="text-lg font-semibold">Recent customer sync reports</h2>{runs.map(run=><details key={run.id} className="rounded border p-3 my-2"><summary>{run.netsuiteCustomerId} · {run.status} · {new Date(run.createdAt).toLocaleString()}</summary><pre className="text-xs">{JSON.stringify({counts:run.counts,issues:run.issues},null,2)}</pre></details>)}</section>
    </PageBlock></PageLayout></Page>;
}
function message(error:unknown){return error instanceof Error?error.message:'NetSuite customer operation failed.';}

defineDashboardExtension({routes:[
    {path:'/netsuite-sync',loader:()=>({breadcrumb:'NetSuite sync'}),navMenuItem:{id:'netsuite-sync',title:'NetSuite sync',sectionId:'catalog',requiresPermission:'SuperAdmin'},component:NetsuiteCatalogPage},
    {path:'/netsuite-customers',loader:()=>({breadcrumb:'NetSuite customers'}),navMenuItem:{id:'netsuite-customers',title:'NetSuite customers',sectionId:'customers',requiresPermission:'SuperAdmin'},component:NetsuiteCustomersPage},
]});
