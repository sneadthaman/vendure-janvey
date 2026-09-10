import { Injectable, OnModuleInit } from '@nestjs/common';
import { Channel, CurrencyCode, Facet, FacetValue, FacetService, FacetValueService, ID, Job, JobQueue, JobQueueService, LanguageCode, Logger, Product, ProductService, ProductVariant, ProductVariantService, RequestContext, RequestContextService, TransactionalConnection, User } from '@vendure/core';
import { IsNull } from 'typeorm';
import { GlobalFlag } from '@vendure/common/lib/generated-types';
import { createHash } from 'node:crypto';
import { NetsuiteService } from './netsuite.service';
import { NetsuiteAssetService } from './netsuite-asset.service';
import { mapItem, MappedItem } from '../netsuite.mapper';
import { NetsuiteSyncRun, emptyCounts } from '../netsuite-sync-run.entity';
import { loggerCtx } from '../constants';
import { NetsuitePrice } from '../types';
import { NetsuiteCollectionService } from './netsuite-collection.service';

export function priceBelongsToItem(price:NetsuitePrice,itemId:string):boolean {
    return price.internalId===itemId ||
        price.internalId===null&&price.price===null&&price.purchasable===false;
}
@Injectable()
export class NetsuiteSyncService implements OnModuleInit {
    private queue:JobQueue<{runId:string}>;
    constructor(private connection:TransactionalConnection,private queues:JobQueueService,
        private contexts:RequestContextService,private client:NetsuiteService,private images:NetsuiteAssetService,
        private products:ProductService,private variants:ProductVariantService,
        private facets:FacetService,private values:FacetValueService,private collections:NetsuiteCollectionService) {}
    async onModuleInit(){
        this.queue=await this.queues.createQueue({name:'netsuite-catalog-sync',process:job=>this.process(job)});
    }
    async start(ctx:RequestContext,sampleSize?:number):Promise<NetsuiteSyncRun>{
        if(sampleSize!==undefined&&(!Number.isInteger(sampleSize)||sampleSize<1||sampleSize>100)) throw new Error('Sample size must be between 1 and 100.');
        if(!ctx.activeUserId) throw new Error('Administrator login required.');
        if(ctx.currencyCode!==CurrencyCode.USD) throw new Error('NetSuite catalog sync currently supports USD only.');
        const repo=this.connection.getRepository(ctx,NetsuiteSyncRun);
        let run:NetsuiteSyncRun;
        try {run=await repo.save(new NetsuiteSyncRun({channelId:String(ctx.channelId),userId:String(ctx.activeUserId),activeKey:'netsuite-catalog',status:'queued',sampleSize:sampleSize??null,counts:emptyCounts(),issues:[]}));}
        catch(error){if((error as {code?:string}).code==='23505') throw new Error('A NetSuite catalog sync is already active.');throw error;}
        try {const job=await this.queue.add({runId:String(run.id)},{retries:0});await repo.update(run.id,{jobId:String(job.id)});return await repo.findOneByOrFail({id:run.id});}
        catch(error){run.status='failed';run.activeKey=null;run.finishedAt=new Date();run.issues=[{message:'Could not enqueue sync.'}];await repo.save(run);throw error;}
    }
    async list(ctx:RequestContext){return this.connection.getRepository(ctx,NetsuiteSyncRun).find({where:{channelId:String(ctx.channelId)},order:{createdAt:'DESC'},take:20});}
    async refreshCollections(ctx:RequestContext){
        const active=await this.connection.getRepository(ctx,NetsuiteSyncRun).findOne({where:{channelId:String(ctx.channelId),activeKey:'netsuite-catalog'}});
        if(active)throw new Error('Wait for the active NetSuite catalog sync to finish.');
        return this.collections.refresh(ctx);
    }

    private async process(job:Job<{runId:string}>){
        const repo=this.connection.rawConnection.getRepository(NetsuiteSyncRun);
        const run=await repo.findOneByOrFail({id:job.data.runId});
        if(run.status==='completed'||run.status==='failed') return run.counts;
        const issue=(message:string,itemId?:string)=>{if(run.issues.length<100)run.issues.push({itemId,message});};
        try {
            const user=await this.connection.rawConnection.getRepository(User).findOneOrFail({where:{id:run.userId},relations:{roles:{channels:true}}});
            const channel=await this.connection.rawConnection.getRepository(Channel).findOneOrFail({where:{id:run.channelId},relations:{defaultTaxZone:true,defaultShippingZone:true}});
            const ctx=await this.contexts.create({apiType:'admin',user,channelOrToken:channel,languageCode:LanguageCode.en,currencyCode:CurrencyCode.USD});
            run.status='fetching';run.counts=emptyCounts();run.issues=[];await repo.save(run);
            const snapshot=await this.client.fetchCatalog();
            run.counts.fetched=snapshot.items.length;
            // Fail before writes for an empty full catalog; absence must not wipe the shop.
            if(!snapshot.items.length) throw new Error('Empty catalog: reconciliation and writes refused.');
            let manifest:Awaited<ReturnType<NetsuiteService['fetchImages']>>=new Map();
            try {manifest=await this.client.fetchImages();}catch(error){issue('Image manifest unavailable; products will retain existing images.');}
            const selected=run.sampleSize?snapshot.items.slice(0,run.sampleSize):snapshot.items;
            const seen=new Set(snapshot.items.map(item=>item.internalid).filter(id=>typeof id==='string'&&id.trim()));
            const skus=selected.map(item=>item.itemid).filter(sku=>typeof sku==='string'&&sku.trim()).map(sku=>sku.trim());
            // A pricing transport failure is not an unpriced item. Abort before writes.
            const prices=await this.client.fetchOnlinePrices(skus);
            run.status='syncing';await repo.save(run);
            for(let start=0;start<selected.length;start+=25){
                for(const raw of selected.slice(start,start+25)){
                    const mapped=mapItem(raw);
                    if(!mapped.ok){run.counts.skipped++;issue(mapped.reason,raw.internalid);}
                    else {
                        try {
                            const price=prices.get(mapped.item.sku);
                            if(!price||!priceBelongsToItem(price,mapped.item.netsuiteInternalId)) throw new Error('Pricing identity does not match item identity.');
                            const result=await this.upsert(ctx,mapped.item,price,manifest,issue);
                            run.counts[result.created?'created':'updated']++;
                            if(result.image==='imported')run.counts.imagesImported++;
                            if(result.image==='reused')run.counts.imagesReused++;
                            if(result.image==='failed')run.counts.imageFailures++;
                        }catch(error){run.counts.failed++;issue(error instanceof Error?error.message:'Item import failed.',raw.internalid);}
                    }
                    run.counts.processed++;
                }
                job.setProgress(Math.floor(run.counts.processed/selected.length*90));
                await repo.save(run);
            }
            if(!run.sampleSize&&snapshot.reconciliationSafe&&run.counts.failed===0&&run.counts.skipped===0){
                run.status='reconciling';await repo.save(run);
                const all=await this.connection.getRepository(ctx,Product).find({where:{deletedAt:IsNull()},relations:{channels:true,variants:true}});
                for(const product of all){
                    const id=(product.customFields as {netsuiteInternalId?:string}).netsuiteInternalId;
                    if(!id||seen.has(id)||!product.channels.some(c=>String(c.id)===String(ctx.channelId)))continue;
                    if(product.enabled){
                        await this.connection.withTransaction(ctx,async tx=>{
                            await this.products.update(tx,{id:product.id,enabled:false});
                            const variants=product.variants.filter(v=>!v.deletedAt);
                            if(variants.length)await this.variants.update(tx,variants.map(v=>({id:v.id,enabled:false})));
                        });
                        run.counts.disabled++;
                    }
                }
                run.reconciliationPerformed=true;
            }else if(!run.sampleSize){issue('Reconciliation skipped: catalog completeness or item success checks did not pass.');}
            if(!run.sampleSize&&run.counts.failed===0&&run.counts.skipped===0){
                run.status='categorizing';await repo.save(run);
                try{
                    const result=await this.collections.refresh(ctx);
                    Object.assign(run.counts,result.counts);
                    for(const message of result.issues)issue(message);
                }catch(error){run.counts.categoryFailures++;issue(error instanceof Error?error.message:'Category refresh failed.');}
            }
            run.status=run.counts.failed||run.counts.categoryFailures?'completed_with_errors':'completed';job.setProgress(100);
            Logger.info(`Catalog sync ${run.id}: ${JSON.stringify(run.counts)}`,loggerCtx);
        }catch(error){run.status='failed';issue(error instanceof Error?error.message:'Catalog sync failed.');Logger.error(`Catalog sync ${run.id} failed`,loggerCtx);}
        finally {run.activeKey=null;run.finishedAt=new Date();await repo.save(run);}
        return run.counts;
    }

    private async facetIds(ctx:RequestContext,item:MappedItem):Promise<ID[]>{
        const ids:ID[]=[];
        for(const [code,name,isPrivate] of [['netsuite-manufacturer',item.facets.manufacturer,false],['netsuite-class',item.facets.netsuiteClass,true]] as const){
            if(!name)continue;
            let facet=await this.connection.getRepository(ctx,Facet).findOne({where:{code}});
            if(!facet)facet=await this.facets.create(ctx,{code,isPrivate,translations:[{languageCode:LanguageCode.en,name:code==='netsuite-class'?'NetSuite Class':'Manufacturer'}]});
            const valueCode=`${code}-${createHash('sha256').update(name).digest('hex').slice(0,24)}`;
            let value=await this.connection.getRepository(ctx,FacetValue).findOne({where:{code:valueCode,facet:{id:facet.id}}});
            if(!value)value=await this.values.create(ctx,facet,{code:valueCode,translations:[{languageCode:LanguageCode.en,name}]});
            ids.push(value.id);
        }
        return ids;
    }

    private async upsert(ctx:RequestContext,item:MappedItem,price:NetsuitePrice,manifest:Awaited<ReturnType<NetsuiteService['fetchImages']>>,issue:(message:string,itemId?:string)=>void){
        const existing=await this.connection.getRepository(ctx,Product).findOne({where:{customFields:{netsuiteInternalId:item.netsuiteInternalId},deletedAt:IsNull()} as never,relations:{channels:true,variants:{facetValues:{facet:true}},facetValues:{facet:true},assets:true,translations:true}});
        if(existing&&!existing.channels.some(c=>String(c.id)===String(ctx.channelId)))throw new Error('Item already belongs to another channel.');
        const variants=(existing?.variants||[]).filter(v=>!v.deletedAt);
        if(variants.length>1)throw new Error('Expected exactly one product variant; refusing to alter a multi-variant product.');
        const locked=Boolean((existing?.customFields as {syncLocked?:boolean}|undefined)?.syncLocked);
        let image:'none'|'failed'|'reused'|'imported'='none',assetId:ID|undefined;
        if(item.imageToken&&!locked){
            const file=manifest.get(`${item.imageToken}_01.jpg`.toLowerCase());
            if(!file){image='failed';issue('Image token has no manifest match.',item.netsuiteInternalId);}
            else try{const result=await this.images.importImage(ctx,file);assetId=result.id;image=result.reused?'reused':'imported';}
            catch{image='failed';issue('Image import failed; previous image retained.',item.netsuiteInternalId);}
        }
        const created=!existing;
        await this.connection.withTransaction(ctx,async tx=>{
            const managed=await this.facetIds(tx,item);
            const preserved=(existing?.facetValues||[]).filter(v=>!['netsuite-manufacturer','netsuite-class'].includes(v.facet.code)).map(v=>v.id);
            let slug=item.content.slug;
            const collision=await this.products.findOneBySlug(tx,slug);
            if(collision&&String(collision.id)!==String(existing?.id)){
                slug=`${slug}-${item.netsuiteInternalId}`;
                const second=await this.products.findOneBySlug(tx,slug);
                if(second&&String(second.id)!==String(existing?.id))throw new Error('Product slug collision requires review.');
            }
            const content=locked?{}:{translations:[{languageCode:LanguageCode.en,name:item.content.name,slug,description:item.content.description}]};
            const fields={netsuiteInternalId:item.netsuiteInternalId,netsuiteLastSyncedAt:new Date(),...(!locked?item.content.customFields:{})};
            const assetIds=assetId?[...new Set([...(existing?.assets||[]).map(a=>a.assetId),assetId])]:undefined;
            const input={enabled:true,customFields:fields,facetValueIds:[...preserved,...managed],...(assetId?{featuredAssetId:assetId,assetIds}:{}),...content};
            const product=existing?await this.products.update(tx,{id:existing.id,...input}):await this.products.create(tx,{...input,translations:[{languageCode:LanguageCode.en,name:item.content.name,slug,description:item.content.description}]});
            const purchasable=price.price!==null&&price.purchasable;
            const variantFacets=(variants[0]?.facetValues||[]).filter(v=>!['netsuite-manufacturer','netsuite-class'].includes(v.facet.code)).map(v=>v.id);
            const variant={sku:item.sku,price:price.price??0,enabled:purchasable,customFields:{...item.identity.customFields,purchasable},facetValueIds:[...variantFacets,...managed],...(!locked?{translations:[{languageCode:LanguageCode.en,name:item.content.name}]}:{})};
            if(variants.length)await this.variants.update(tx,[{id:variants[0].id,...variant}]);
            else await this.variants.create(tx,[{...variant,productId:product.id,trackInventory:GlobalFlag.FALSE,translations:[{languageCode:LanguageCode.en,name:item.content.name}]}]);
        });
        return {created,image};
    }
}
