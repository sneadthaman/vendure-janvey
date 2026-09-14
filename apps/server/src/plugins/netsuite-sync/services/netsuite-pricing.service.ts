import {Injectable} from '@nestjs/common';
import {Customer, Order, ProductVariant, RequestContext, RequestContextCacheService, TransactionalConnection} from '@vendure/core';

import {NetsuiteContactLink} from '../entities';
import {NetsuitePrice} from '../types';
import {NetsuiteService} from './netsuite.service';

@Injectable()
export class NetsuitePricingService {
    constructor(private connection:TransactionalConnection,private client:NetsuiteService,private requestCache:RequestContextCacheService){}

    async activeContact(ctx:RequestContext){
        if(!ctx.activeUserId)return undefined;
        return this.requestCache.get(ctx,`netsuite-active-contact:${ctx.activeUserId}`,async()=>{
            const customer=await this.connection.getRepository(ctx,Customer).findOne({where:{user:{id:ctx.activeUserId}},relations:{user:true}});
            return customer?this.contactForCustomer(ctx,customer.id):undefined;
        });
    }

    contactForCustomer(ctx:RequestContext,customerId:Customer['id']){
        return this.requestCache.get(ctx,`netsuite-contact-customer:${customerId}`,()=>this.connection.getRepository(ctx,NetsuiteContactLink).findOne({where:{customerId},relations:{account:true,customer:true,defaultShippingAddress:true}}));
    }

    async priceForCatalog(ctx:RequestContext,variant:ProductVariant,publicPrice:number):Promise<number>{
        const contact=await this.activeContact(ctx);
        if(!contact)return publicPrice;
        return this.priceForContact(ctx,contact,variant);
    }

    async priceForOrder(ctx:RequestContext,order:Order,variant:ProductVariant,publicPrice:number):Promise<number>{
        if(!order.customerId)return publicPrice;
        const contact=await this.contactForCustomer(ctx,order.customerId);
        if(!contact)return publicPrice;
        return this.priceForContact(ctx,contact,variant);
    }

    async activeCustomerPrices(ctx:RequestContext,skus:string[]):Promise<NetsuitePrice[]>{
        const contact=await this.activeContact(ctx);
        if(!contact)return [];
        const normalized=[...new Set(skus.map(sku=>sku.trim()).filter(Boolean))];
        if(normalized.length>100)throw new Error('At most 100 SKUs may be priced at once.');
        const prices=await this.prices(ctx,contact.account.netsuiteInternalId,normalized);
        return normalized.map(sku=>{
            const price=prices.get(sku);
            if(!price)throw new Error('NetSuite omitted a requested customer price.');
            return price;
        });
    }

    private async priceForContact(ctx:RequestContext,contact:NetsuiteContactLink,variant:ProductVariant){
        const prices=await this.prices(ctx,contact.account.netsuiteInternalId,[variant.sku]);
        const price=prices.get(variant.sku);
        const itemId=(variant.customFields as {netsuiteInternalId?:string|null}).netsuiteInternalId;
        if(!price||price.price===null||!price.purchasable)throw new Error('Authoritative customer price is unavailable.');
        if(!itemId||price.internalId!==itemId)throw new Error('Customer price identity does not match the requested item.');
        return price.price;
    }

    private prices(ctx:RequestContext,accountId:string,skus:string[]){
        const key=`netsuite-customer-prices:${accountId}:${[...skus].sort().join('|')}`;
        return this.requestCache.get(ctx,key,()=>this.client.fetchCustomerPrices(accountId,skus));
    }
}
