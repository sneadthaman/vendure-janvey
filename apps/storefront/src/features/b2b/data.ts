import {getActiveCustomer} from '@/features/account/customer';
import {query} from '@/platform/vendure/api';
import {readFragment} from '@/platform/vendure/graphql';
import {ActiveNetsuiteAccountQuery,ActiveNetsuitePricesQuery,ApprovalFields,MyApprovalOrdersQuery,PendingApprovalOrdersQuery} from './graphql';

export async function getActiveNetsuiteAccount(){
    const customer=await getActiveCustomer();
    if(!customer)return null;
    return (await query(ActiveNetsuiteAccountQuery,{}, {useAuthToken:true})).data.activeNetsuiteAccount;
}

export async function getActiveNetsuitePriceMap(skus:string[]){
    const customer=await getActiveCustomer();
    if(!customer||skus.length===0)return {} as Record<string,number>;
    const result=await query(ActiveNetsuitePricesQuery,{skus:[...new Set(skus)]},{useAuthToken:true});
    return Object.fromEntries(result.data.activeNetsuitePrices.filter(item=>item.purchasable&&item.price!==null).map(item=>[item.sku,item.price!])) as Record<string,number>;
}

export async function getApprovalOrders(){
    const [mine,pending]=await Promise.all([
        query(MyApprovalOrdersQuery,{}, {useAuthToken:true}),
        query(PendingApprovalOrdersQuery,{}, {useAuthToken:true}).catch(()=>null),
    ]);
    return {
        mine:mine.data.myNetsuiteApprovalOrders.map(item=>readFragment(ApprovalFields,item)),
        pending:(pending?.data.pendingNetsuiteApprovalOrders??[]).map(item=>readFragment(ApprovalFields,item)),
    };
}
