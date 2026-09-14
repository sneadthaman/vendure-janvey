import {Injectable} from '@nestjs/common';
import {ID} from '@vendure/common/lib/shared-types';
import {ActiveOrderService, EventBus, Order, OrderService, RequestContext, TransactionalConnection} from '@vendure/core';

import {NetsuiteAccountAddress,NetsuiteContactLink,NetsuiteOrderApproval,NetsuiteOrderApprovalEvent} from '../entities';
import {NetsuiteApprovalDecisionEvent,NetsuiteApprovalRequestedEvent} from '../netsuite-approval.events';
import {withAuthorizedOrderTransition} from '../netsuite-order-process';
import {assertApprovalAccount,assertCanDecideApproval,assertCanViewApproval} from '../b2b-policy';
import {NetsuiteCustomerService} from './netsuite-customer.service';

export interface PendingOrderChanges {
    lines?:Array<{orderLineId:ID;quantity:number}>;
    addItems?:Array<{productVariantId:ID;quantity:number}>;
    shippingAddressId?:ID;
    comment?:string;
}

@Injectable()
export class NetsuiteApprovalService {
    private readonly orderRelations=['customer','lines','lines.productVariant','shippingLines','surcharges'] as const;

    constructor(
        private connection:TransactionalConnection,
        private activeOrders:ActiveOrderService,
        private orders:OrderService,
        private customers:NetsuiteCustomerService,
        private eventBus:EventBus,
    ){}

    async activeAccount(ctx:RequestContext){
        const link=await this.customers.findLinkForUser(ctx);
        if(!link)return null;
        return {
            id:link.account.id,
            companyName:link.account.companyName,
            requiresApproval:link.requiresApproval,
            canApproveOrders:link.canApproveOrders,
            defaultShippingAddressId:link.defaultShippingAddressId,
            addresses:link.account.addresses.filter(address=>address.active),
        };
    }

    async selectShipTo(ctx:RequestContext,addressId:ID){
        const link=await this.requireContact(ctx);
        const address=await this.requireAddress(ctx,link,addressId);
        link.defaultShippingAddressId=address.id;
        await this.connection.getRepository(ctx,NetsuiteContactLink).save(link);
        const order=await this.activeOrders.getOrderFromContext(ctx);
        if(order)await this.applyAuthoritativeAddresses(ctx,order.id,link,address);
        return this.activeAccount(ctx);
    }

    async submit(ctx:RequestContext,addressId?:ID){
        return this.connection.withTransaction(ctx,async tx=>{
            const link=await this.requireContact(tx);
            if(!link.requiresApproval)throw new Error('This contact may use the standard checkout flow.');
            const activeOrder=await this.activeOrders.getOrderFromContext(tx);
            if(!activeOrder)throw new Error('No active order was found.');
            const order=await this.requireOrder(tx,activeOrder.id);
            if(String(order.customerId)!==String(link.customerId))throw new Error('The active order does not belong to this contact.');
            if(order.lines.length===0)throw new Error('An empty order cannot be submitted for approval.');
            if(!order.shippingLines?.length)throw new Error('Choose a shipping method before submitting for approval.');
            const selectedId=addressId??link.defaultShippingAddressId;
            if(!selectedId)throw new Error('Choose an authoritative NetSuite ship-to address.');
            const address=await this.requireAddress(tx,link,selectedId);
            await this.applyAuthoritativeAddresses(tx,order.id,link,address);
            const verified=await this.reprice(tx,order.id);
            await this.transition(tx,verified,'PendingApproval');
            const approval=await this.connection.getRepository(tx,NetsuiteOrderApproval).save(new NetsuiteOrderApproval({
                orderId:verified.id,accountId:link.accountId,requesterCustomerId:link.customerId,
                shippingAddressId:address.id,status:'pending',pricingVerifiedAt:new Date(),taxValidatedAt:new Date(),
                decidedAt:null,decidedByCustomerId:null,decisionComment:null,
            }));
            await this.audit(tx,approval,link,'submitted',null,{shippingAddressId:String(address.id)},verified);
            await this.notifyApprovers(tx,link,verified);
            return this.getForContact(tx,approval.id,link);
        });
    }

    async mine(ctx:RequestContext){
        const link=await this.requireContact(ctx);
        return this.connection.getRepository(ctx,NetsuiteOrderApproval).find({
            where:{requesterCustomerId:link.customerId},
            relations:{order:{lines:{productVariant:true}},shippingAddress:true,requester:true,decidedByCustomer:true,events:true},
            order:{createdAt:'DESC',events:{createdAt:'ASC'}},
        });
    }

    async pendingForApprover(ctx:RequestContext){
        const link=await this.requireApprover(ctx);
        return this.connection.getRepository(ctx,NetsuiteOrderApproval).find({
            where:{accountId:link.accountId,status:'pending'},
            relations:{order:{lines:{productVariant:true}},shippingAddress:true,requester:true,decidedByCustomer:true,events:true},
            order:{createdAt:'ASC',events:{createdAt:'ASC'}},
        });
    }

    async one(ctx:RequestContext,id:ID){
        const link=await this.requireContact(ctx);
        return this.getForContact(ctx,id,link);
    }

    async modify(ctx:RequestContext,id:ID,changes:PendingOrderChanges){
        return this.connection.withTransaction(ctx,async tx=>{
            const approver=await this.requireApprover(tx);
            let approval=await this.requirePending(tx,id,approver);
            const before=await this.requireOrder(tx,approval.orderId);
            await this.transition(tx,before,'ApprovalEditing');
            let editing=await this.requireOrder(tx,approval.orderId);
            await this.transition(tx,editing,'AddingItems');
            editing=await this.requireOrder(tx,approval.orderId);

            if(changes.lines?.length){
                const removals=changes.lines.filter(line=>line.quantity===0).map(line=>line.orderLineId);
                const adjustments=changes.lines.filter(line=>line.quantity>0);
                if(changes.lines.some(line=>line.quantity<0))throw new Error('Order line quantities cannot be negative.');
                if(removals.length){
                    const result=await this.orders.removeItemsFromOrder(tx,editing.id,removals);
                    this.throwGraphQlError(result);
                }
                if(adjustments.length){
                    const result=await this.orders.adjustOrderLines(tx,editing.id,adjustments);
                    this.throwBatchErrors(result.errorResults);
                }
            }
            if(changes.addItems?.length){
                if(changes.addItems.some(item=>item.quantity<=0))throw new Error('Added item quantities must be positive.');
                const result=await this.orders.addItemsToOrder(tx,editing.id,changes.addItems);
                this.throwBatchErrors(result.errorResults);
            }
            if(changes.shippingAddressId){
                const address=await this.requireAddress(tx,approver,changes.shippingAddressId);
                await this.applyAuthoritativeAddresses(tx,editing.id,approver,address);
                approval.shippingAddressId=address.id;
            }
            editing=await this.reprice(tx,editing.id);
            if(editing.lines.length===0)throw new Error('A pending order must contain at least one item.');
            await this.transition(tx,editing,'PendingApproval');
            approval.pricingVerifiedAt=new Date();
            approval.taxValidatedAt=new Date();
            approval=await this.connection.getRepository(tx,NetsuiteOrderApproval).save(approval);
            await this.audit(tx,approval,approver,'modified',changes.comment??null,changes,editing);
            await this.notifyRequester(tx,approval,editing,'modified',approver,changes.comment??null);
            return this.getForContact(tx,approval.id,approver);
        });
    }

    approve(ctx:RequestContext,id:ID,comment?:string){return this.decide(ctx,id,'approved','Approved',comment);}
    reject(ctx:RequestContext,id:ID,comment?:string){return this.decide(ctx,id,'rejected','ApprovalRejected',comment);}

    async cancel(ctx:RequestContext,id:ID,comment?:string){
        return this.connection.withTransaction(ctx,async tx=>{
            const contact=await this.requireContact(tx);
            let approval=await this.requirePending(tx,id,contact);
            const isRequester=String(approval.requesterCustomerId)===String(contact.customerId);
            if(!isRequester&&!contact.canApproveOrders)throw new Error('Only the requester or an account approver may cancel this order.');
            const order=await this.requireOrder(tx,approval.orderId);
            await this.transition(tx,order,'ApprovalCancelled');
            approval.status='cancelled';approval.decidedAt=new Date();approval.decidedByCustomerId=contact.customerId;approval.decisionComment=comment??null;
            approval=await this.connection.getRepository(tx,NetsuiteOrderApproval).save(approval);
            await this.audit(tx,approval,contact,'cancelled',comment??null,null,order);
            await this.notifyRequester(tx,approval,order,'cancelled',contact,comment??null);
            return this.getForContact(tx,approval.id,contact);
        });
    }

    async isExportEligible(ctx:RequestContext,orderId:ID){
        const approval=await this.connection.getRepository(ctx,NetsuiteOrderApproval).findOneBy({orderId});
        return !approval||(approval.status==='approved'&&approval.pricingVerifiedAt!==null&&approval.taxValidatedAt!==null);
    }

    async listForStaff(ctx:RequestContext,status?:string){
        const normalized=status?.trim().toLowerCase();
        if(normalized&&!['pending','approved','rejected','cancelled'].includes(normalized))throw new Error('Unknown approval status.');
        return this.connection.getRepository(ctx,NetsuiteOrderApproval).find({
            where:normalized?{status:normalized as NetsuiteOrderApproval['status']}:undefined,
            relations:{account:true,order:{lines:{productVariant:true}},shippingAddress:true,requester:true,decidedByCustomer:true,events:true},
            order:{createdAt:'DESC',events:{createdAt:'ASC'}},
            take:200,
        });
    }

    async staffResolve(ctx:RequestContext,id:ID,action:'approve'|'reject'|'cancel',comment?:string){
        if(!ctx.activeUserId||ctx.apiType!=='admin')throw new Error('Administrator login required.');
        if(!['approve','reject','cancel'].includes(action))throw new Error('Staff action must be approve, reject, or cancel.');
        return this.connection.withTransaction(ctx,async tx=>{
            let approval=await this.connection.getRepository(tx,NetsuiteOrderApproval).findOne({where:{id},relations:{order:true}});
            if(!approval||approval.status!=='pending'||approval.order.state!=='PendingApproval')throw new Error('This order is no longer pending approval.');
            let order=await this.requireOrder(tx,approval.orderId);
            const state=action==='approve'?'Approved':action==='reject'?'ApprovalRejected':'ApprovalCancelled';
            if(action==='approve')order=await this.reprice(tx,order.id);
            await this.transition(tx,order,state);
            approval.status=action==='approve'?'approved':action==='reject'?'rejected':'cancelled';
            approval.decidedAt=new Date();approval.decidedByCustomerId=null;approval.decisionComment=comment??null;
            if(action==='approve'){approval.pricingVerifiedAt=new Date();approval.taxValidatedAt=new Date();}
            approval=await this.connection.getRepository(tx,NetsuiteOrderApproval).save(approval);
            await this.auditStaff(tx,approval,action,comment??null,order);
            await this.notifyRequesterByName(tx,approval,order,approval.status,'Staff',comment??null);
            return this.connection.getRepository(tx,NetsuiteOrderApproval).findOneOrFail({
                where:{id:approval.id},relations:{account:true,order:{lines:{productVariant:true}},shippingAddress:true,requester:true,decidedByCustomer:true,events:true},
                order:{events:{createdAt:'ASC'}},
            });
        });
    }

    private async decide(ctx:RequestContext,id:ID,status:'approved'|'rejected',state:'Approved'|'ApprovalRejected',comment?:string){
        return this.connection.withTransaction(ctx,async tx=>{
            const approver=await this.requireApprover(tx);
            let approval=await this.requirePending(tx,id,approver);
            assertCanDecideApproval(approver,approval);
            let order=await this.requireOrder(tx,approval.orderId);
            if(status==='approved')order=await this.reprice(tx,order.id);
            await this.transition(tx,order,state);
            approval.status=status;approval.decidedAt=new Date();approval.decidedByCustomerId=approver.customerId;approval.decisionComment=comment??null;
            if(status==='approved'){approval.pricingVerifiedAt=new Date();approval.taxValidatedAt=new Date();}
            approval=await this.connection.getRepository(tx,NetsuiteOrderApproval).save(approval);
            await this.audit(tx,approval,approver,status,comment??null,null,order);
            await this.notifyRequester(tx,approval,order,status,approver,comment??null);
            return this.getForContact(tx,approval.id,approver);
        });
    }

    private async requireContact(ctx:RequestContext){
        const link=await this.customers.findLinkForUser(ctx);
        if(!link)throw new Error('An authenticated, staff-linked NetSuite contact is required.');
        return link;
    }

    private async requireApprover(ctx:RequestContext){
        const link=await this.requireContact(ctx);
        if(!link.canApproveOrders)throw new Error('This contact is not an order approver.');
        return link;
    }

    private async requireAddress(ctx:RequestContext,link:NetsuiteContactLink,addressId:ID){
        const address=await this.connection.getRepository(ctx,NetsuiteAccountAddress).findOneBy({id:addressId,accountId:link.accountId,active:true});
        if(!address)throw new Error('The ship-to address is not active on this NetSuite account.');
        return address;
    }

    private async requireBillingAddress(ctx:RequestContext,link:NetsuiteContactLink){
        const address=await this.connection.getRepository(ctx,NetsuiteAccountAddress).findOneBy({
            accountId:link.accountId,active:true,defaultBilling:true,
        });
        if(!address)throw new Error('This NetSuite account has no active default bill-to address. Refresh the account before checkout.');
        return address;
    }

    private async applyAuthoritativeAddresses(ctx:RequestContext,orderId:ID,link:NetsuiteContactLink,shippingAddress:NetsuiteAccountAddress){
        const billingAddress=await this.requireBillingAddress(ctx,link);
        await this.orders.setBillingAddress(ctx,orderId,this.addressInput(billingAddress,link.account.companyName));
        await this.orders.setShippingAddress(ctx,orderId,this.addressInput(shippingAddress,link.account.companyName));
    }

    private async requirePending(ctx:RequestContext,id:ID,contact:NetsuiteContactLink){
        const approval=await this.connection.getRepository(ctx,NetsuiteOrderApproval).findOne({where:{id},relations:{order:true}});
        if(!approval)throw new Error('Pending order was not found for this account.');
        assertApprovalAccount(contact,approval);
        if(approval.status!=='pending'||approval.order.state!=='PendingApproval')throw new Error('This order is no longer pending approval.');
        return approval;
    }

    private async getForContact(ctx:RequestContext,id:ID,contact:NetsuiteContactLink){
        const approval=await this.connection.getRepository(ctx,NetsuiteOrderApproval).findOne({
            where:{id,accountId:contact.accountId},
            relations:{order:{lines:{productVariant:true}},shippingAddress:true,requester:true,decidedByCustomer:true,events:true},
            order:{events:{createdAt:'ASC'}},
        });
        if(!approval)throw new Error('Approval order was not found for this account.');
        assertCanViewApproval(contact,approval);
        return approval;
    }

    private async requireOrder(ctx:RequestContext,id:ID){
        const order=await this.orders.findOne(ctx,id,[...this.orderRelations]);
        if(!order)throw new Error('Order was not found.');
        return order;
    }

    private async reprice(ctx:RequestContext,id:ID){
        const order=await this.requireOrder(ctx,id);
        return this.orders.applyPriceAdjustments(ctx,order,order.lines,[...this.orderRelations]);
    }

    private async transition(ctx:RequestContext,order:Order,to:Order['state']){
        const result=await withAuthorizedOrderTransition(ctx,order,to,()=>this.orders.transitionToState(ctx,order.id,to));
        this.throwGraphQlError(result);
        return result as Order;
    }

    private async audit(ctx:RequestContext,approval:NetsuiteOrderApproval,actor:NetsuiteContactLink,action:string,comment:string|null,changes:unknown,order:Order){
        await this.connection.getRepository(ctx,NetsuiteOrderApprovalEvent).save(new NetsuiteOrderApprovalEvent({
            approvalId:approval.id,actorCustomerId:actor.customerId,actorUserId:String(ctx.activeUserId),action,comment,
            changesJson:changes===null?null:JSON.stringify(changes),total:order.total,totalWithTax:order.totalWithTax,
        }));
    }

    private async auditStaff(ctx:RequestContext,approval:NetsuiteOrderApproval,action:string,comment:string|null,order:Order){
        await this.connection.getRepository(ctx,NetsuiteOrderApprovalEvent).save(new NetsuiteOrderApprovalEvent({
            approvalId:approval.id,actorCustomerId:null,actorUserId:String(ctx.activeUserId),action:`staff_${action}`,comment,
            changesJson:null,total:order.total,totalWithTax:order.totalWithTax,
        }));
    }

    private async notifyApprovers(ctx:RequestContext,requester:NetsuiteContactLink,order:Order){
        const approvers=await this.connection.getRepository(ctx,NetsuiteContactLink).find({
            where:{accountId:requester.accountId,canApproveOrders:true},relations:{customer:true},
        });
        const requesterName=`${requester.customer.firstName} ${requester.customer.lastName}`.trim();
        for(const approver of approvers){
            if(String(approver.customerId)===String(requester.customerId))continue;
            if(!approver.customer.emailAddress)continue;
            await this.eventBus.publish(new NetsuiteApprovalRequestedEvent(
                ctx,approver.customer.emailAddress,order,requesterName,requester.account.companyName,
            ));
        }
    }

    private async notifyRequester(ctx:RequestContext,approval:NetsuiteOrderApproval,order:Order,decision:string,actor:NetsuiteContactLink,comment:string|null){
        if(!approval.requesterCustomerId||String(approval.requesterCustomerId)===String(actor.customerId))return;
        const actorName=`${actor.customer.firstName} ${actor.customer.lastName}`.trim();
        await this.notifyRequesterByName(ctx,approval,order,decision,actorName,comment);
    }

    private async notifyRequesterByName(ctx:RequestContext,approval:NetsuiteOrderApproval,order:Order,decision:string,actorName:string,comment:string|null){
        if(!approval.requesterCustomerId)return;
        const requester=await this.connection.getRepository(ctx,NetsuiteContactLink).findOne({
            where:{customerId:approval.requesterCustomerId},relations:{customer:true},
        });
        if(!requester?.customer.emailAddress)return;
        await this.eventBus.publish(new NetsuiteApprovalDecisionEvent(
            ctx,requester.customer.emailAddress,order,decision,actorName,comment,
        ));
    }

    private addressInput(address:NetsuiteAccountAddress,company:string){
        return {fullName:address.addressee??address.attention??company,company,streetLine1:address.streetLine1,streetLine2:address.streetLine2??undefined,
            city:address.city,province:address.province,postalCode:address.postalCode,countryCode:address.countryCode,phoneNumber:address.phoneNumber??undefined};
    }

    private throwBatchErrors(errors:Array<{message?:string}>){if(errors.length)throw new Error(errors.map(error=>error.message??'Order update failed.').join(' '));}
    private throwGraphQlError(result:unknown){
        if(result&&typeof result==='object'&&'errorCode' in result){
            const error=result as {message?:unknown;transitionError?:unknown;errorCode?:unknown};
            throw new Error([error.message,error.transitionError].filter(Boolean).map(String).join(' ')||String(error.errorCode??'Order operation failed.'));
        }
    }
}
