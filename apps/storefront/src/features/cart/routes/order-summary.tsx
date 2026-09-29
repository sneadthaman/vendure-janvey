import { Link } from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Building2, CheckCircle2, Lock} from 'lucide-react';
import {Price} from '@/features/pricing/price';
import {getTranslations} from 'next-intl/server';

type ActiveOrder = {
    id: string;
    currencyCode: string;
    subTotal: number;
    shipping: number;
    total: number;
    discounts?: Array<{
        description: string;
        amount: number;
    }> | null;
};

type NetsuiteAccount = {
    companyName: string;
    requiresApproval: boolean;
} | null;

export async function OrderSummary({activeOrder, netsuiteAccount}: { activeOrder: ActiveOrder; netsuiteAccount: NetsuiteAccount }) {
    const t = await getTranslations('Cart');
    return (
        <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#0d3158] px-6 py-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-200">{t('purchaseSummary')}</p>
                <h2 className="mt-1 text-xl font-bold">{t('orderSummary')}</h2>
            </div>

            <div className="p-6">
            {netsuiteAccount && (
                <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                        <Building2 className="mt-0.5 size-5 shrink-0 text-[#174a78]"/>
                        <div>
                            <p className="font-semibold text-slate-950">{netsuiteAccount.companyName}</p>
                            <p className="mt-1 text-sm leading-5 text-slate-600">
                                {netsuiteAccount.requiresApproval ? t('approvalRequired') : t('accountReady')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('subtotal')}</span>
                    <span>
                        <Price value={activeOrder.subTotal} currencyCode={activeOrder.currencyCode}/>
                    </span>
                </div>
                {activeOrder.discounts && activeOrder.discounts.length > 0 && (
                    <>
                        {activeOrder.discounts.map((discount, index) => (
                            <div key={index} className="flex justify-between text-sm text-green-600">
                                <span>{discount.description}</span>
                                <span>
                                    <Price value={discount.amount} currencyCode={activeOrder.currencyCode}/>
                                </span>
                            </div>
                        ))}
                    </>
                )}
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('shipping')}</span>
                    <span>
                        {activeOrder.shipping > 0
                            ? <Price value={activeOrder.shipping} currencyCode={activeOrder.currencyCode}/>
                            : t('calculatedAtCheckout')}
                    </span>
                </div>
            </div>

            <div className="mb-4 border-t pt-4">
                <div className="flex justify-between items-baseline text-lg font-bold">
                    <span>{t('estimatedTotal')}</span>
                    <span className="text-2xl">
                        <Price value={activeOrder.total} currencyCode={activeOrder.currencyCode}/>
                    </span>
                </div>
            </div>

            <div className="mb-5 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600"/>
                <span>{t('taxCalculatedAtCheckout')}</span>
            </div>

            <Button render={<Link href="/checkout" />} nativeButton={false} className="h-12 w-full bg-[#bc520e] text-base font-semibold hover:bg-[#9f430a]" size="lg">{t('proceedToCheckout')}</Button>

            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>{t('secureCheckout')}</span>
            </div>

            <Button render={<Link href="/" />} nativeButton={false} variant="outline" className="w-full mt-3">{t('continueShopping')}</Button>
            </div>
        </div>
    );
}
