import {Injectable} from '@nestjs/common';
import {ID} from '@vendure/common/lib/shared-types';
import {Customer, EventBus, RequestContext, TransactionalConnection} from '@vendure/core';
import {createHash,randomBytes} from 'node:crypto';
import {IsNull} from 'typeorm';

import {NetsuiteAccount,NetsuiteAccountAddress,NetsuiteContactInvitation,NetsuiteContactLink} from '../entities';
import {NetsuiteContactInvitationEvent} from '../netsuite-invitation.event';
import {NetsuiteService} from './netsuite.service';

interface InviteInput {accountId:ID;netsuiteContactId:string;requiresApproval?:boolean;canApproveOrders?:boolean;defaultShippingAddressId?:ID|null;}

@Injectable()
export class NetsuiteInvitationService {
    constructor(private connection:TransactionalConnection,private client:NetsuiteService,private eventBus:EventBus){}

    list(ctx:RequestContext){return this.connection.getRepository(ctx,NetsuiteContactInvitation).find({relations:{account:true,defaultShippingAddress:true,acceptedByCustomer:true},order:{createdAt:'DESC'},take:100});}

    async invite(ctx:RequestContext,input:InviteInput){
        if(!ctx.activeUserId)throw new Error('Administrator login required.');
        const account=await this.connection.getRepository(ctx,NetsuiteAccount).findOneBy({id:input.accountId,active:true,webCustomer:true});
        if(!account)throw new Error('Eligible NetSuite account not found.');
        const live=await this.client.fetchCustomer(account.netsuiteInternalId,{diagnostic:true});
        const contact=live.contacts.find(item=>item.internalId===input.netsuiteContactId&&item.active);
        if(!contact)throw new Error('Active NetSuite contact not found on this account.');
        const emailAddress=contact.emailAddress?.trim().toLowerCase();
        if(!emailAddress)throw new Error('The NetSuite contact has no email address.');
        if(input.defaultShippingAddressId){
            const address=await this.connection.getRepository(ctx,NetsuiteAccountAddress).findOneBy({id:input.defaultShippingAddressId,accountId:account.id,active:true});
            if(!address)throw new Error('Default ship-to must be active on this account.');
        }
        const token=randomBytes(32).toString('hex');
        const repo=this.connection.getRepository(ctx,NetsuiteContactInvitation);
        const pending=await repo.find({where:{accountId:account.id,netsuiteContactId:contact.internalId,acceptedAt:IsNull(),revokedAt:IsNull()}});
        for(const old of pending){old.revokedAt=new Date();await repo.save(old);}
        const ttl=Number(process.env.NETSUITE_INVITATION_TTL_HOURS||168);
        const invitation=await repo.save(new NetsuiteContactInvitation({
            accountId:account.id,netsuiteContactId:contact.internalId,emailAddress,
            firstName:contact.firstName,lastName:contact.lastName,tokenHash:this.hash(token),
            requiresApproval:Boolean(input.requiresApproval),canApproveOrders:Boolean(input.canApproveOrders),
            defaultShippingAddressId:input.defaultShippingAddressId??null,
            expiresAt:new Date(Date.now()+(Number.isFinite(ttl)&&ttl>0?ttl:168)*3_600_000),acceptedAt:null,revokedAt:null,acceptedByCustomerId:null,
            invitedByUserId:String(ctx.activeUserId),
        }));
        await this.eventBus.publish(new NetsuiteContactInvitationEvent(ctx,emailAddress,[contact.firstName,contact.lastName].filter(Boolean).join(' ')||emailAddress,account.companyName,token,invitation.expiresAt));
        return repo.findOneOrFail({where:{id:invitation.id},relations:{account:true,defaultShippingAddress:true,acceptedByCustomer:true}});
    }

    async preview(ctx:RequestContext,token:string){
        const invitation=await this.byToken(ctx,token);
        return {accountName:invitation.account.companyName,emailHint:this.mask(invitation.emailAddress),expiresAt:invitation.expiresAt,available:this.available(invitation)};
    }

    async accept(ctx:RequestContext,token:string){
        if(!ctx.activeUserId)throw new Error('Sign in before accepting this invitation.');
        return this.connection.withTransaction(ctx,async tx=>{
            const invitation=await this.byToken(tx,token);
            if(!this.available(invitation))throw new Error('This invitation is expired, revoked, or already used.');
            const customer=await this.connection.getRepository(tx,Customer).findOne({where:{user:{id:tx.activeUserId}},relations:{user:true}});
            if(!customer?.user?.verified)throw new Error('Verify your email address before accepting this invitation.');
            if(customer.emailAddress.trim().toLowerCase()!==invitation.emailAddress)throw new Error('Sign in with the email address that received this invitation.');
            const existing=await this.connection.getRepository(tx,NetsuiteContactLink).findOneBy({customerId:customer.id});
            if(existing)throw new Error('This customer is already linked to a NetSuite account.');
            const live=await this.client.fetchCustomer(invitation.account.netsuiteInternalId,{diagnostic:true});
            if(!live.customer.active||!live.customer.webCustomer)throw new Error('This NetSuite account is no longer eligible for web use.');
            const contact=live.contacts.find(item=>item.internalId===invitation.netsuiteContactId&&item.active&&item.emailAddress?.trim().toLowerCase()===invitation.emailAddress);
            if(!contact)throw new Error('This NetSuite contact is no longer eligible for web use.');
            await this.connection.getRepository(tx,NetsuiteContactLink).save(new NetsuiteContactLink({
                accountId:invitation.accountId,customerId:customer.id,netsuiteContactId:invitation.netsuiteContactId,
                requiresApproval:invitation.requiresApproval,canApproveOrders:invitation.canApproveOrders,
                active:true,eligibilityIssue:null,defaultShippingAddressId:invitation.defaultShippingAddressId,linkedByUserId:String(tx.activeUserId),
            }));
            invitation.acceptedAt=new Date();invitation.acceptedByCustomerId=customer.id;
            await this.connection.getRepository(tx,NetsuiteContactInvitation).save(invitation);
            return {accountName:invitation.account.companyName};
        });
    }

    private async byToken(ctx:RequestContext,token:string){
        if(!/^[a-f0-9]{64}$/i.test(token))throw new Error('Invalid invitation token.');
        const invitation=await this.connection.getRepository(ctx,NetsuiteContactInvitation).findOne({where:{tokenHash:this.hash(token)},relations:{account:true}});
        if(!invitation)throw new Error('Invitation not found.');
        return invitation;
    }
    private available(invitation:NetsuiteContactInvitation){return !invitation.acceptedAt&&!invitation.revokedAt&&invitation.expiresAt.getTime()>Date.now()&&invitation.account.active&&invitation.account.webCustomer;}
    private hash(token:string){return createHash('sha256').update(token).digest('hex');}
    private mask(email:string){const [name,domain]=email.split('@');return `${name.slice(0,2)}${'*'.repeat(Math.max(1,name.length-2))}@${domain}`;}
}
