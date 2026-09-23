'use client';

import {useActionState} from 'react';
import {Button} from '@/components/ui/button';
import {acceptNetsuiteInvitationAction} from './invitation-actions';

export function InvitationForm({token}:{token:string}){
    const [state,action,pending]=useActionState(acceptNetsuiteInvitationAction,undefined);
    if(state?.accountName)return <p className="rounded bg-green-50 p-4 text-green-800">Invitation accepted. You now have access to {state.accountName}.</p>;
    return <form action={action} className="space-y-3"><input type="hidden" name="token" value={token}/>{state?.error&&<p className="text-sm text-destructive">{state.error}</p>}<Button disabled={pending} type="submit" className="w-full">{pending?'Accepting...':'Accept invitation'}</Button></form>;
}
