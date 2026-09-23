'use server';

import {mutate} from '@/platform/vendure/api';
import {AcceptNetsuiteInvitationMutation} from '../graphql';

export async function acceptNetsuiteInvitationAction(_state:{error?:string;accountName?:string}|undefined,formData:FormData){
    const token=String(formData.get('token')||'');
    try{
        const result=await mutate(AcceptNetsuiteInvitationMutation,{token},{useAuthToken:true});
        return {accountName:result.data.acceptNetsuiteInvitation.accountName};
    }catch(error){
        return {error:error instanceof Error?error.message:'Could not accept this invitation.'};
    }
}
