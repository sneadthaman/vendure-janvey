import {ID} from '@vendure/common/lib/shared-types';

interface ContactPolicy {accountId:ID;customerId:ID;canApproveOrders:boolean;}
interface ApprovalPolicy {accountId:ID;requesterCustomerId:ID|null;}
const same=(left:ID|null|undefined,right:ID|null|undefined)=>String(left)===String(right);

export function assertApprovalAccount(contact:ContactPolicy,approval:ApprovalPolicy){
    if(!same(contact.accountId,approval.accountId))throw new Error('Pending order was not found for this account.');
}

export function assertCanViewApproval(contact:ContactPolicy,approval:ApprovalPolicy){
    assertApprovalAccount(contact,approval);
    if(!same(contact.customerId,approval.requesterCustomerId)&&!contact.canApproveOrders)throw new Error('This contact cannot view the approval order.');
}

export function assertCanDecideApproval(contact:ContactPolicy,approval:ApprovalPolicy){
    assertApprovalAccount(contact,approval);
    if(!contact.canApproveOrders)throw new Error('This contact is not an order approver.');
    if(same(contact.customerId,approval.requesterCustomerId))throw new Error('A requester cannot approve or reject their own order.');
}
