import {EmailEventListener} from '@vendure/email-plugin';

import {NetsuiteApprovalDecisionEvent,NetsuiteApprovalRequestedEvent} from './netsuite-approval.events';
import {NetsuiteContactInvitationEvent} from './netsuite-invitation.event';

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

export const netsuiteEmailHandlers=[approvalRequestedHandler,approvalDecisionHandler,contactInvitationHandler];
