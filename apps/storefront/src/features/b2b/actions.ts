'use server';

import {mutate} from '@/platform/vendure/api';
import {redirect} from '@/platform/i18n/navigation';
import {getLocale} from 'next-intl/server';
import {revalidatePath,updateTag} from 'next/cache';
import {ApproveOrderMutation,CancelApprovalOrderMutation,ModifyPendingOrderMutation,RejectOrderMutation,SelectNetsuiteShipToMutation,SubmitOrderForApprovalMutation} from './graphql';

export async function selectNetsuiteShipTo(addressId:string){
    await mutate(SelectNetsuiteShipToMutation,{addressId},{useAuthToken:true});
    const locale=await getLocale();revalidatePath(`/${locale}/checkout`);updateTag('active-order');
}

export async function submitOrderForApproval(addressId?:string){
    const result=await mutate(SubmitOrderForApprovalMutation,{addressId:addressId||null},{useAuthToken:true});
    updateTag('cart');updateTag('active-order');
    const locale=await getLocale();
    redirect({href:`/account/approvals?submitted=${result.data.submitOrderForApproval.order.code}`,locale});
}

export async function resolveApproval(formData:FormData){
    const id=String(formData.get('id')??'');
    const action=String(formData.get('action')??'');
    const comment=String(formData.get('comment')??'').trim()||null;
    if(action==='approve')await mutate(ApproveOrderMutation,{id,comment},{useAuthToken:true});
    else if(action==='reject')await mutate(RejectOrderMutation,{id,comment},{useAuthToken:true});
    else if(action==='cancel')await mutate(CancelApprovalOrderMutation,{id,comment},{useAuthToken:true});
    else throw new Error('Unknown approval action.');
    const locale=await getLocale();revalidatePath(`/${locale}/account/approvals`);
}

export async function modifyApproval(formData:FormData){
    const id=String(formData.get('id')??'');
    const lineIds=formData.getAll('lineId').map(String);
    const quantities=formData.getAll('quantity').map(value=>Number(value));
    if(lineIds.length!==quantities.length||quantities.some(value=>!Number.isInteger(value)||value<0))throw new Error('Every quantity must be a non-negative whole number.');
    await mutate(ModifyPendingOrderMutation,{id,input:{
        lines:lineIds.map((orderLineId,index)=>({orderLineId,quantity:quantities[index]})),
        comment:String(formData.get('comment')??'').trim()||null,
    }},{useAuthToken:true});
    const locale=await getLocale();revalidatePath(`/${locale}/account/approvals`);
}
