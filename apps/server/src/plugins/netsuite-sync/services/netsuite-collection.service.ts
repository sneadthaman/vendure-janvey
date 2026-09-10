import { Injectable } from '@nestjs/common';
import { Collection, CollectionService, FacetValue, ID, LanguageCode, Product, ProductService, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
import { In, IsNull } from 'typeorm';
import { CATEGORY_GROUPS, DEMO_COLLECTION_SLUGS, FEATURED_COLLECTION_KEY, FEATURED_PRODUCT_NETSUITE_IDS, KNOWN_CLASS_MAP, REVIEW_COLLECTION_KEY } from '../collection-taxonomy';

export interface CollectionRefreshCounts {
    collectionsCreated:number;
    collectionsRefreshed:number;
    categoriesPendingReview:number;
    unclassifiedProducts:number;
    categoryFailures:number;
    demoProductsDisabled:number;
}

const emptyRefreshCounts=():CollectionRefreshCounts=>({collectionsCreated:0,collectionsRefreshed:0,categoriesPendingReview:0,unclassifiedProducts:0,categoryFailures:0,demoProductsDisabled:0});
const facetFilter=(ids:ID[])=>[{code:'facet-value-filter',arguments:[{name:'facetValueIds',value:JSON.stringify(ids)},{name:'containsAny',value:'true'},{name:'combineWithAnd',value:'true'}]}];
const productFilter=(ids:ID[])=>[{code:'product-id-filter',arguments:[{name:'productIds',value:JSON.stringify(ids)},{name:'combineWithAnd',value:'true'}]}];

@Injectable()
export class NetsuiteCollectionService {
    constructor(private connection:TransactionalConnection,private collections:CollectionService,private products:ProductService){}

    async refresh(ctx:RequestContext):Promise<{counts:CollectionRefreshCounts;issues:string[]}> {
        const counts=emptyRefreshCounts();const issues:string[]=[];
        const root=await this.connection.getRepository(ctx,Collection).findOneOrFail({where:{isRoot:true},relations:{channels:true}});
        const values=await this.connection.getRepository(ctx,FacetValue).find({where:{facet:{code:'netsuite-class'}},relations:{facet:true,translations:true}});
        const byClass=new Map(values.map(value=>[value.translations.find(t=>t.languageCode===LanguageCode.en)?.name||'',value]));

        const groups=new Map<string,Collection>();
        for(const definition of CATEGORY_GROUPS){
            const collection=await this.ensure(ctx,definition.key,{parentId:root.id,name:definition.name,slug:definition.slug,isPrivate:false,showInNavigation:true,filters:[]},counts);
            groups.set(definition.key,collection);
        }
        const review=await this.ensure(ctx,REVIEW_COLLECTION_KEY,{parentId:root.id,name:'Needs Classification',slug:'needs-classification',isPrivate:true,showInNavigation:false,filters:[]},counts);

        const leaves:Collection[]=[];
        for(const [className,value] of byClass){
            if(!className)continue;
            const known=KNOWN_CLASS_MAP.get(className);
            const parent=known?groups.get(known.groupKey)!:review;
            const leaf=await this.ensure(ctx,className,{parentId:parent.id,name:known?.name||className,slug:known?.slug||this.slug(className),isPrivate:!known,showInNavigation:Boolean(known),filters:facetFilter([value.id])},counts);
            await this.collections.update(ctx,{id:leaf.id,filters:facetFilter([value.id])});
            counts.collectionsRefreshed++;
            const refreshed=await this.connection.getRepository(ctx,Collection).findOneOrFail({where:{id:leaf.id},relations:{parent:true}});
            if(!known&&String(refreshed.parentId)===String(review.id)){
                counts.categoriesPendingReview++;
                issues.push(`New NetSuite class needs review: ${className}`);
            }
            leaves.push(refreshed);
        }

        const managed=await this.connection.getRepository(ctx,Collection).find({relations:{parent:true}});
        const byId=new Map(managed.map(collection=>[String(collection.id),collection]));
        const groupIds=new Set([...groups.values()].map(group=>String(group.id)));
        for(const group of groups.values()){
            const ids=leaves.filter(leaf=>this.belongsTo(leaf,groupIds,byId)===String(group.id))
                .map(leaf=>byClass.get(String((leaf.customFields as {netsuiteClassKey?:string}).netsuiteClassKey))?.id)
                .filter((id):id is ID=>id!==undefined);
            await this.collections.update(ctx,{id:group.id,filters:facetFilter(ids)});
            counts.collectionsRefreshed++;
        }

        const classFacetId=values[0]?.facet.id;
        if(classFacetId){
            const unclassified=await this.connection.getRepository(ctx,Product).createQueryBuilder('product')
                .where('product.deletedAt IS NULL').andWhere('product.customFieldsNetsuiteinternalid IS NOT NULL')
                .andWhere(`NOT EXISTS (
                    SELECT 1 FROM product_facet_values_facet_value pfv
                    INNER JOIN facet_value fv ON fv.id = pfv."facetValueId"
                    WHERE pfv."productId" = product.id AND fv."facetId" = :facetId
                )`,{facetId:classFacetId}).getCount();
            counts.unclassifiedProducts=unclassified;
            if(unclassified)issues.push(`${unclassified} NetSuite product(s) have no class.`);
        }

        await this.ensureFeatured(ctx,root.id,counts);
        counts.demoProductsDisabled=await this.hideDemoCatalog(ctx);
        await this.collections.triggerApplyFiltersJob(ctx,{applyToChangedVariantsOnly:false});
        return {counts,issues};
    }

    private async ensure(ctx:RequestContext,key:string,input:{parentId:ID;name:string;slug:string;isPrivate:boolean;showInNavigation:boolean;filters:ReturnType<typeof facetFilter>},counts:CollectionRefreshCounts){
        const repo=this.connection.getRepository(ctx,Collection);
        const existing=await repo.findOne({where:{customFields:{netsuiteClassKey:key}} as never,relations:{parent:true}});
        if(existing)return existing;
        const created=await this.collections.create(ctx,{parentId:input.parentId,isPrivate:input.isPrivate,inheritFilters:false,filters:input.filters,customFields:{netsuiteClassKey:key,showInNavigation:input.showInNavigation},translations:[{languageCode:LanguageCode.en,name:input.name,slug:input.slug,description:''}]});
        counts.collectionsCreated++;
        return created;
    }

    private async ensureFeatured(ctx:RequestContext,parentId:ID,counts:CollectionRefreshCounts){
        const existing=await this.connection.getRepository(ctx,Collection).findOne({where:{customFields:{netsuiteClassKey:FEATURED_COLLECTION_KEY}} as never});
        if(existing)return;
        const products=await this.connection.getRepository(ctx,Product).find({where:{customFields:{netsuiteInternalId:In(FEATURED_PRODUCT_NETSUITE_IDS)}} as never});
        await this.collections.create(ctx,{parentId,isPrivate:false,inheritFilters:false,filters:productFilter(products.map(product=>product.id)),customFields:{netsuiteClassKey:FEATURED_COLLECTION_KEY,showInNavigation:false},translations:[{languageCode:LanguageCode.en,name:'Featured Products',slug:'featured-products',description:''}]});
        counts.collectionsCreated++;
    }

    private async hideDemoCatalog(ctx:RequestContext){
        const demos:(Collection|undefined)[]=[];
        for(const slug of DEMO_COLLECTION_SLUGS)demos.push(await this.collections.findOneBySlug(ctx,slug));
        const existing=demos.filter((item):item is Collection=>Boolean(item));
        for(const collection of existing)await this.collections.update(ctx,{id:collection.id,isPrivate:true,customFields:{...(collection.customFields as object),showInNavigation:false}});
        if(!existing.length)return 0;
        const variantIds=new Set<ID>();
        for(const collection of existing)for(const id of await this.collections.getCollectionProductVariantIds(collection,ctx))variantIds.add(id);
        if(!variantIds.size)return 0;
        const variants=await this.connection.getRepository(ctx,ProductVariant).find({where:{id:In([...variantIds]),deletedAt:IsNull()},relations:{product:true}});
        const products=[...new Map(variants.filter(variant=>!(variant.product.customFields as {netsuiteInternalId?:string}).netsuiteInternalId).map(variant=>[String(variant.product.id),variant.product])).values()];
        for(const product of products){
            if(product.enabled)await this.products.update(ctx,{id:product.id,enabled:false});
            const related=variants.filter(variant=>String(variant.product.id)===String(product.id)&&variant.enabled);
            if(related.length)await this.connection.getRepository(ctx,ProductVariant).update({id:In(related.map(variant=>variant.id))},{enabled:false});
        }
        return products.filter(product=>product.enabled).length;
    }

    private belongsTo(leaf:Collection,groupIds:Set<string>,byId:Map<string,Collection>):string|undefined{
        let current=leaf.parentId?byId.get(String(leaf.parentId)):undefined;
        while(current){if(groupIds.has(String(current.id)))return String(current.id);current=current.parentId?byId.get(String(current.parentId)):undefined;}
    }

    private slug(value:string){return value.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);}
}
