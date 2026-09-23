import type {Metadata} from 'next';
import {Suspense} from 'react';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {getActiveCustomer} from '@/features/account/customer';
import {Link} from '@/platform/i18n/navigation';
import {query} from '@/platform/vendure/api';
import {NetsuiteInvitationQuery} from '../graphql';
import {InvitationForm} from './invitation-form';

export const metadata:Metadata={title:'Purchasing account invitation'};

export default function InvitationPage({searchParams}:{searchParams:Promise<{token?:string}>}){
    return <Suspense fallback={<InvitationCard><p>Loading invitation...</p></InvitationCard>}><InvitationContent searchParams={searchParams}/></Suspense>;
}

async function InvitationContent({searchParams}:{searchParams:Promise<{token?:string}>}){
    const token=(await searchParams).token;
    if(!token)return <InvitationCard><p>This invitation link is incomplete.</p></InvitationCard>;
    try{
        const [{data},customer]=await Promise.all([query(NetsuiteInvitationQuery,{token}),getActiveCustomer()]);
        const invitation=data.netsuiteInvitation;
        const returnPath=`/account-invitation?token=${encodeURIComponent(token)}`;
        return <InvitationCard><div className="space-y-4"><p>You have been invited to access <strong>{invitation.accountName}</strong>.</p><p className="text-sm text-muted-foreground">This invitation belongs to {invitation.emailHint} and expires {new Date(invitation.expiresAt).toLocaleString()}.</p>{!invitation.available?<p className="text-destructive">This invitation is expired, revoked, or already used.</p>:customer?<InvitationForm token={token}/>:<div className="grid gap-2"><Link href={`/sign-in?redirectTo=${encodeURIComponent(returnPath)}`}><Button className="w-full">Sign in to accept</Button></Link><Link href={`/register?redirectTo=${encodeURIComponent(returnPath)}`}><Button variant="outline" className="w-full">Create an account</Button></Link></div>}</div></InvitationCard>;
    }catch(error){return <InvitationCard><p className="text-destructive">{error instanceof Error?error.message:'Invitation not found.'}</p></InvitationCard>;}
}

function InvitationCard({children}:{children:React.ReactNode}){return <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4"><Card className="w-full"><CardHeader><CardTitle>Purchasing account invitation</CardTitle></CardHeader><CardContent>{children}</CardContent></Card></div>;}
