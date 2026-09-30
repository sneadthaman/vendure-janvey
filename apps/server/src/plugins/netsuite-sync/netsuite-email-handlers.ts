import {EmailEventListener,shippingLinesWithMethod,transformOrderLineAssetUrls} from '@vendure/email-plugin';
import {EntityHydrator,OrderStateTransitionEvent} from '@vendure/core';

import {NetsuiteApprovalDecisionEvent,NetsuiteApprovalRequestedEvent,NetsuiteApprovalSubmittedEvent} from './netsuite-approval.events';
import {NetsuiteContactInvitationEvent} from './netsuite-invitation.event';

export const janveyOrderConfirmationHandler=new EmailEventListener('order-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(event=>event.fromState==='ArrangingPayment'&&['PaymentAuthorized','PaymentSettled'].includes(event.toState)&&!!event.order.customer)
    .loadData(async({event,injector})=>{
        const entityHydrator=injector.get(EntityHydrator);
        await entityHydrator.hydrate(event.ctx,event.order,{relations:['lines.featuredAsset','shippingLines.shippingMethod']});
        transformOrderLineAssetUrls(event.ctx,event.order,injector);
        return {shippingLines:shippingLinesWithMethod(event.order)};
    })
    .setRecipient(event=>event.order.customer!.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setSubject('Order confirmation for #{{ order.code }}')
    .setTemplateVars(event=>({order:event.order,shippingLines:event.data.shippingLines}));

const approvalRequestedHandler=new EmailEventListener('netsuite-approval-requested')
    .on(NetsuiteApprovalRequestedEvent)
    .setRecipient(event=>event.recipient)
    .setFrom('{{ fromAddress }}')
    .setSubject('Order #{{ order.code }} is waiting for approval')
    .setTemplateVars(event=>({
        order:event.order,
        requesterName:event.requesterName,
        accountName:event.accountName,
        approvalUrl:`${process.env.STOREFRONT_URL??'http://localhost:3001'}/account/approvals`,
    }));

const approvalSubmittedHandler=new EmailEventListener('netsuite-approval-submitted')
    .on(NetsuiteApprovalSubmittedEvent)
    .setRecipient(event=>event.recipient)
    .setFrom('{{ fromAddress }}')
    .setSubject('Order #{{ order.code }} was submitted for approval')
    .setTemplateVars(event=>({
        order:event.order,
        accountName:event.accountName,
        orderUrl:`${process.env.STOREFRONT_URL??'http://localhost:3001'}/account/orders/${event.order.code}`,
    }));

const approvalDecisionHandler=new EmailEventListener('netsuite-approval-decision')
    .on(NetsuiteApprovalDecisionEvent)
    .setRecipient(event=>event.recipient)
    .setFrom('{{ fromAddress }}')
    .setSubject('Order #{{ order.code }} was {{ decision }}')
    .setTemplateVars(event=>({
        order:event.order,
        decision:event.decision,
        actorName:event.actorName,
        comment:event.comment,
        orderUrl:`${process.env.STOREFRONT_URL??'http://localhost:3001'}/account/orders/${event.order.code}`,
    }));

const contactInvitationHandler=new EmailEventListener('netsuite-contact-invitation')
    .on(NetsuiteContactInvitationEvent)
    .setRecipient(event=>event.recipient)
    .setFrom('{{ fromAddress }}')
    .setSubject('Your {{ accountName }} purchasing account invitation')
    .setTemplateVars(event=>({
        contactName:event.contactName,accountName:event.accountName,expiresAt:event.expiresAt,
        invitationUrl:`${process.env.STOREFRONT_URL??'http://localhost:3001'}/account-invitation?token=${encodeURIComponent(event.token)}`,
    }));

export const netsuiteEmailHandlers=[approvalRequestedHandler,approvalSubmittedHandler,approvalDecisionHandler,contactInvitationHandler];
