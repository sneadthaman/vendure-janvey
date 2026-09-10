import { api, Button, defineDashboardExtension, Page, PageBlock, PageLayout, PageTitle } from '@vendure/dashboard';
import { useCallback, useEffect, useState } from 'react';

interface Run {
    id:string; status:string; createdAt:string; sampleSize:number|null;
    counts:Record<string,number>; issues:Array<{itemId?:string;message:string}>;
    reconciliationPerformed:boolean;
}
const runsQuery=`query { netsuiteSyncRuns { id status createdAt sampleSize counts issues reconciliationPerformed } }`;
const startMutation=`mutation StartNetsuiteSync($sampleSize:Int) { startNetsuiteSync(sampleSize:$sampleSize) { id } }`;
const refreshCollectionsMutation=`mutation { refreshNetsuiteCollections }`;
const activeStates=['queued','fetching','syncing','reconciling','categorizing'];

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
defineDashboardExtension({routes:[{path:'/netsuite-sync',loader:()=>({breadcrumb:'NetSuite sync'}),navMenuItem:{id:'netsuite-sync',title:'NetSuite sync',sectionId:'catalog',requiresPermission:'SuperAdmin'},component:NetsuiteCatalogPage}]});
