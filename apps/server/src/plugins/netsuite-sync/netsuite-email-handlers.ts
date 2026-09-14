import {EmailEventListener} from '@vendure/email-plugin';

import {NetsuiteApprovalDecisionEvent,NetsuiteApprovalRequestedEvent} from './netsuite-approval.events';

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

export const netsuiteEmailHandlers=[approvalRequestedHandler,approvalDecisionHandler];
