import {Injectable} from '@nestjs/common';
import {Customer, ID, RequestContext, TransactionalConnection} from '@vendure/core';

import {NetsuiteAccount, NetsuiteAccountAddress, NetsuiteContactLink, NetsuiteCustomerSyncRun} from '../entities';
import {NetsuiteCustomerAddress, NetsuiteCustomerResponse} from '../types';
import {NetsuiteService} from './netsuite.service';

interface LinkInput {
    customerId:ID;
    accountId:ID;
    netsuiteContactId?:string|null;
    requiresApproval?:boolean;
    canApproveOrders?:boolean;
    defaultShippingAddressId?:ID|null;
}

interface UpdateLinkInput {
    customerId:ID;
    requiresApproval?:boolean;
    canApproveOrders?:boolean;
    defaultShippingAddressId?:ID|null;
}

@Injectable()
export class NetsuiteCustomerService {
    constructor(private connection:TransactionalConnection,private client:NetsuiteService){}

    inspect(customerId:string){return this.client.fetchCustomer(customerId,{diagnostic:true});}

    search(query:string){return this.client.searchCustomers(query);}

    listAccounts(ctx:RequestContext){
        return this.connection.getRepository(ctx,NetsuiteAccount).find({
            relations:{addresses:true,contacts:{customer:true,defaultShippingAddress:true}},
            order:{companyName:'ASC',addresses:{label:'ASC'}},
        });
    }

    listRuns(ctx:RequestContext){
        return this.connection.getRepository(ctx,NetsuiteCustomerSyncRun).find({order:{createdAt:'DESC'},take:20});
    }

    async syncAccount(ctx:RequestContext,customerId:string){
        if(!ctx.activeUserId)throw new Error('Administrator login required.');
        if(!/^\d+$/.test(customerId))throw new Error('NetSuite customer ID must be numeric.');
        const runRepo=this.connection.getRepository(ctx,NetsuiteCustomerSyncRun);
        const run=await runRepo.save(new NetsuiteCustomerSyncRun({status:'fetching',netsuiteCustomerId:customerId,counts:{accounts:0,addresses:0,contactsFound:0},issues:[],finishedAt:null}));
        try{
            const result=await this.client.fetchCustomer(customerId,{diagnostic:true});
            if(!result.customer.webCustomer)throw new Error('NetSuite customer is not marked as a web customer.');
            const normalized=this.validate(result);
            const account=await this.connection.withTransaction(ctx,async tx=>{
                const accountRepo=this.connection.getRepository(tx,NetsuiteAccount);
                let target=await accountRepo.findOne({where:{netsuiteInternalId:customerId}});
                const taxable=this.taxable(result,target?.taxable??true);
                const taxExempt=!taxable;
                const values={
                    netsuiteInternalId:customerId,
                    entityId:this.optional(result.customer.entityId),
                    companyName:this.optional(result.customer.companyName)||this.optional(result.customer.entityId)||`NetSuite customer ${customerId}`,
                    emailAddress:this.optional(result.customer.emailAddress),
                    phoneNumber:this.optional(result.customer.phoneNumber),
                    taxable,taxExempt,
                    taxItemId:this.taxValue(result,'taxitem'),
                    taxRate:this.taxRate(result),
                    taxRegistrationNumber:this.firstTaxValue(result,['taxregistrationnumber','taxregnumber','vatregnumber','resalenumber']),
                    taxMetadataJson:JSON.stringify(result.customer.taxMetadata),
                    lastSyncedAt:new Date(),
                };
                target=target?Object.assign(target,values):new NetsuiteAccount(values);
                target=await accountRepo.save(target);
                const addressRepo=this.connection.getRepository(tx,NetsuiteAccountAddress);
                const existing=await addressRepo.find({where:{accountId:target.id}});
                const seen=new Set<string>();
                for(const input of normalized){
                    seen.add(input.internalId!);
                    let address=existing.find(item=>item.netsuiteAddressId===input.internalId);
                    const addressValues=this.addressValues(target.id,input);
                    address=address?Object.assign(address,addressValues):new NetsuiteAccountAddress(addressValues);
                    await addressRepo.save(address);
                }
                for(const address of existing.filter(item=>!seen.has(item.netsuiteAddressId)&&item.active)){
                    address.active=false;
                    await addressRepo.save(address);
                }
                return target;
            });
            run.status='completed';
            run.counts={accounts:1,addresses:normalized.length,contactsFound:result.contacts.filter(contact=>contact.active).length};
            run.issues=result.issues.map((message,index)=>({code:`NETSUITE_${index+1}`,message}));
            run.finishedAt=new Date();
            await runRepo.save(run);
            return this.findAccount(ctx,account.id);
        }catch(error){
            run.status='failed';run.finishedAt=new Date();
            run.issues=[{code:'CUSTOMER_SYNC_FAILED',message:error instanceof Error?error.message:'Customer sync failed.'}];
            await runRepo.save(run);
            throw error;
        }
    }

    async linkCustomer(ctx:RequestContext,input:LinkInput){
        if(!ctx.activeUserId)throw new Error('Administrator login required.');
        const customer=await this.connection.getRepository(ctx,Customer).findOne({where:{id:input.customerId}});
        if(!customer)throw new Error('Vendure customer not found.');
        const account=await this.findAccount(ctx,input.accountId);
        const contactId=this.optional(input.netsuiteContactId);
        if(contactId){
            const live=await this.client.fetchCustomer(account.netsuiteInternalId,{diagnostic:true});
            if(!live.contacts.some(contact=>contact.active&&contact.internalId===contactId))throw new Error('NetSuite contact does not belong to this account.');
        }
        await this.assertAddress(ctx,input.defaultShippingAddressId,account.id);
        const repo=this.connection.getRepository(ctx,NetsuiteContactLink);
        const existing=await repo.findOne({where:{customerId:customer.id}});
        if(existing)throw new Error('Vendure customer is already linked to a NetSuite account.');
        return repo.save(new NetsuiteContactLink({
            accountId:account.id,customerId:customer.id,netsuiteContactId:contactId,
            requiresApproval:Boolean(input.requiresApproval),canApproveOrders:Boolean(input.canApproveOrders),
            defaultShippingAddressId:input.defaultShippingAddressId??null,linkedByUserId:String(ctx.activeUserId),
        }));
    }

    async updateLink(ctx:RequestContext,input:UpdateLinkInput){
        if(!ctx.activeUserId)throw new Error('Administrator login required.');
        const repo=this.connection.getRepository(ctx,NetsuiteContactLink);
        const link=await repo.findOneBy({customerId:input.customerId});
        if(!link)throw new Error('Vendure customer is not linked to a NetSuite account.');
        await this.assertAddress(ctx,input.defaultShippingAddressId,link.accountId);
        if(input.requiresApproval!==undefined)link.requiresApproval=input.requiresApproval;
        if(input.canApproveOrders!==undefined)link.canApproveOrders=input.canApproveOrders;
        if(input.defaultShippingAddressId!==undefined)link.defaultShippingAddressId=input.defaultShippingAddressId;
        return repo.save(link);
    }

    async unlinkCustomer(ctx:RequestContext,customerId:ID){
        if(!ctx.activeUserId)throw new Error('Administrator login required.');
        const repo=this.connection.getRepository(ctx,NetsuiteContactLink);
        const link=await repo.findOneBy({customerId});
        if(!link)return false;
        await repo.remove(link);
        return true;
    }

    async findLinkForUser(ctx:RequestContext){
        if(!ctx.activeUserId)return undefined;
        const customer=await this.connection.getRepository(ctx,Customer).findOne({where:{user:{id:ctx.activeUserId}},relations:{user:true}});
        if(!customer)return undefined;
        return this.connection.getRepository(ctx,NetsuiteContactLink).findOne({where:{customerId:customer.id},relations:{account:{addresses:true},customer:true,defaultShippingAddress:true}});
    }

    private async findAccount(ctx:RequestContext,id:ID){
        const account=await this.connection.getRepository(ctx,NetsuiteAccount).findOne({where:{id},relations:{addresses:true,contacts:{customer:true,defaultShippingAddress:true}}});
        if(!account)throw new Error('NetSuite account not found.');
        return account;
    }

    private async assertAddress(ctx:RequestContext,addressId:ID|null|undefined,accountId:ID){
        if(addressId===undefined||addressId===null)return;
        const address=await this.connection.getRepository(ctx,NetsuiteAccountAddress).findOneBy({id:addressId,accountId,active:true});
        if(!address)throw new Error('Default ship-to must be an active address on the linked account.');
    }

    private validate(result:NetsuiteCustomerResponse){
        if(!result.customer.active)throw new Error('NetSuite customer is inactive.');
        const ids=new Set<string>();
        return result.addresses.map((address,index)=>{
            if(!address.internalId||ids.has(address.internalId))throw new Error(`Address ${index+1} has no unique immutable NetSuite ID.`);
            ids.add(address.internalId);
            for(const field of ['streetLine1','city','province','postalCode','countryCode'] as const){
                if(!this.optional(address[field]))throw new Error(`Address ${address.internalId} is missing ${field}.`);
            }
            if(!/^[A-Za-z]{2}$/.test(address.countryCode!))throw new Error(`Address ${address.internalId} has an invalid country code.`);
            return address;
        });
    }

    private addressValues(accountId:ID,input:NetsuiteCustomerAddress){
        return {
            accountId,netsuiteAddressId:input.internalId!,label:this.optional(input.label),addressee:this.optional(input.addressee),attention:this.optional(input.attention),
            streetLine1:input.streetLine1!.trim(),streetLine2:this.optional(input.streetLine2),city:input.city!.trim(),province:input.province!.trim(),
            postalCode:input.postalCode!.trim(),countryCode:input.countryCode!.trim().toUpperCase(),phoneNumber:this.optional(input.phoneNumber),
            defaultBilling:Boolean(input.defaultBilling),defaultShipping:Boolean(input.defaultShipping),active:true,
        };
    }

    private taxable(result:NetsuiteCustomerResponse,fallback:boolean){
        const value=result.customer.taxMetadata.taxable?.value;
        if(value===true||value==='T')return true;
        if(value===false||value==='F')return false;
        return fallback;
    }

    private taxValue(result:NetsuiteCustomerResponse,key:string){
        const entry=Object.entries(result.customer.taxMetadata).find(([field])=>field.toLowerCase()===key);
        return this.optional(entry?.[1].value)??this.optional(entry?.[1].text);
    }

    private firstTaxValue(result:NetsuiteCustomerResponse,keys:string[]){
        for(const key of keys){const value=this.taxValue(result,key);if(value)return value;}
        return null;
    }

    private taxRate(result:NetsuiteCustomerResponse){
        const value=(result.customer.taxItem??result.diagnostics?.taxItem)?.rateFields?.rate?.value;
        if(value===null||value===undefined||String(value).trim()==='')return null;
        const rate=typeof value==='number'?value:Number(String(value).replace('%','').trim());
        return Number.isFinite(rate)&&rate>=0&&rate<=100?rate:null;
    }

    private optional(value:unknown):string|null{
        if(value===null||value===undefined)return null;
        const normalized=String(value).trim();
        return normalized||null;
    }
}
