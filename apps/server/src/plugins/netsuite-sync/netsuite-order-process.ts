import {Injector, Order, OrderPlacedStrategy, OrderProcess, OrderState, RequestContext} from '@vendure/core';
import {AsyncLocalStorage} from 'node:async_hooks';
import {NetsuitePricingService} from './services/netsuite-pricing.service';

declare module '@vendure/core' {
    interface CustomOrderStates {
        PendingApproval: never;
        ApprovalEditing: never;
        Approved: never;
        ApprovalRejected: never;
        ApprovalCancelled: never;
    }
}

type ApprovalState='PendingApproval'|'ApprovalEditing'|'Approved'|'ApprovalRejected'|'ApprovalCancelled';
const approvalStates=new Set<OrderState>(['PendingApproval','ApprovalEditing','Approved','ApprovalRejected','ApprovalCancelled']);
const authorized=new AsyncLocalStorage<ReadonlySet<string>>();
let pricing:NetsuitePricingService;

function key(orderId:Order['id'],from:OrderState,to:OrderState){return `${orderId}:${from}:${to}`;}

export async function withAuthorizedOrderTransition<T>(ctx:RequestContext,order:Order,to:OrderState,work:()=>Promise<T>):Promise<T>{
    const transitionKey=key(order.id,order.state,to);
    const keys=new Set(authorized.getStore()??[]);
    keys.add(transitionKey);
    return authorized.run(keys,work);
}

export const netsuiteApprovalOrderProcess:OrderProcess<ApprovalState>={
    transitions:{
        AddingItems:{to:['PendingApproval']},
        PendingApproval:{to:['ApprovalEditing','Approved','ApprovalRejected','ApprovalCancelled']},
        ApprovalEditing:{to:['AddingItems']},
        Approved:{to:['ApprovalCancelled']},
        ApprovalRejected:{to:[]},
        ApprovalCancelled:{to:[]},
    },
    init(injector){pricing=injector.get(NetsuitePricingService);},
    async onTransitionStart(from,to,{ctx,order}){
        if(from==='AddingItems'&&to==='ArrangingPayment'&&order.customerId){
            const contact=await pricing.contactForCustomer(ctx,order.customerId);
            if(contact?.requiresApproval)return 'This contact must submit the order for account approval.';
        }
        if(!approvalStates.has(from)&&!approvalStates.has(to))return;
        if(!authorized.getStore()?.has(key(order.id,from,to))){
            return 'Approval order transitions must use the protected approval workflow.';
        }
    },
};

export class NetsuiteOrderPlacedStrategy implements OrderPlacedStrategy {
    init(_injector:Injector){}
    shouldSetAsPlaced(_ctx:RequestContext,from:OrderState,to:OrderState,_order:Order){
        if(from==='AddingItems'&&to==='PendingApproval')return true;
        return from==='ArrangingPayment'&&(to==='PaymentAuthorized'||to==='PaymentSettled');
    }
}
