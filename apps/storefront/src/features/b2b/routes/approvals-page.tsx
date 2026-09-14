import {getTranslations} from 'next-intl/server';
import {Suspense} from 'react';
import {Price} from '@/features/pricing/price';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {getActiveNetsuiteAccount,getApprovalOrders} from '../data';
import {modifyApproval,resolveApproval} from '../actions';

// Approval data is session-bound and must be rendered at request time.
export const instant=false;

export default function ApprovalOrdersPage({searchParams}:PageProps<'/[locale]/account/approvals'>){
    return <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-muted"/>}><ApprovalOrdersContent searchParams={searchParams}/></Suspense>;
}

async function ApprovalOrdersContent({searchParams}:Pick<PageProps<'/[locale]/account/approvals'>,'searchParams'>){
    const t=await getTranslations('B2B');
    const account=await getActiveNetsuiteAccount();
    if(!account)return <Card><CardHeader><CardTitle>{t('notLinkedTitle')}</CardTitle></CardHeader><CardContent>{t('notLinkedBody')}</CardContent></Card>;
    const {mine,pending}=await getApprovalOrders();
    const params=await searchParams;
    const submitted=Array.isArray(params.submitted)?params.submitted[0]:params.submitted;
    return <div className="space-y-8">
        <div><h1 className="text-3xl font-bold">{t('approvals')}</h1><p className="text-muted-foreground">{account.companyName}</p></div>
        {submitted&&<p role="status" className="rounded-md border border-green-600 bg-green-50 p-3 text-green-900">{t('submitted',{code:submitted})}</p>}
        {account.canApproveOrders&&<section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('waitingForMe')}</h2>
            {pending.length===0?<p className="text-muted-foreground">{t('nonePending')}</p>:pending.map(approval=><Card key={approval.id}>
                <CardHeader><CardTitle>#{approval.order.code}</CardTitle><p>{approval.requester?.firstName} {approval.requester?.lastName} · <Price value={approval.order.totalWithTax} currencyCode={approval.order.currencyCode}/></p></CardHeader>
                <CardContent className="space-y-5">
                    <form action={modifyApproval} className="space-y-3">
                        <input type="hidden" name="id" value={approval.id}/>
                        {approval.order.lines.map(line=><div key={line.id} className="grid grid-cols-[1fr_6rem] items-center gap-3">
                            <label htmlFor={`quantity-${approval.id}-${line.id}`}>{line.productVariant.name} <span className="text-muted-foreground">({line.productVariant.sku})</span></label>
                            <input type="hidden" name="lineId" value={line.id}/>
                            <Input id={`quantity-${approval.id}-${line.id}`} name="quantity" type="number" min="0" step="1" defaultValue={line.quantity}/>
                        </div>)}
                        <Input name="comment" placeholder={t('commentOptional')}/>
                        <Button type="submit" variant="outline">{t('saveChanges')}</Button>
                    </form>
                    <form action={resolveApproval} className="flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={approval.id}/><Input name="comment" placeholder={t('decisionComment')} className="min-w-64 flex-1"/>
                        <Button name="action" value="approve">{t('approve')}</Button>
                        <Button name="action" value="reject" variant="secondary">{t('reject')}</Button>
                        <Button name="action" value="cancel" variant="destructive">{t('cancel')}</Button>
                    </form>
                    <Audit events={approval.events} label={t('auditHistory',{count:approval.events.length})}/>
                </CardContent>
            </Card>)}
        </section>}
        <section className="space-y-4"><h2 className="text-xl font-semibold">{t('myRequests')}</h2>
            {mine.length===0?<p className="text-muted-foreground">{t('noneRequested')}</p>:mine.map(approval=><Card key={approval.id}>
                <CardHeader><CardTitle>#{approval.order.code}</CardTitle><p className="capitalize">{approval.status} · <Price value={approval.order.totalWithTax} currencyCode={approval.order.currencyCode}/></p></CardHeader>
                <CardContent className="space-y-3">
                    {approval.status==='pending'&&<form action={resolveApproval}><input type="hidden" name="id" value={approval.id}/><Button name="action" value="cancel" variant="outline">{t('cancelRequest')}</Button></form>}
                    <Audit events={approval.events} label={t('auditHistory',{count:approval.events.length})}/>
                </CardContent>
            </Card>)}
        </section>
    </div>;
}

function Audit({events,label}:{events:Array<{id:string;createdAt:string;action:string;comment?:string|null;actorCustomer?:{firstName:string;lastName:string}|null}>;label:string}){
    return <details><summary className="cursor-pointer font-medium">{label}</summary><ol className="mt-2 space-y-1 text-sm text-muted-foreground">{events.map(event=><li key={event.id}>{new Date(event.createdAt).toLocaleString()} · {event.action.replaceAll('_',' ')}{event.actorCustomer?` · ${event.actorCustomer.firstName} ${event.actorCustomer.lastName}`:''}{event.comment?` · ${event.comment}`:''}</li>)}</ol></details>;
}
