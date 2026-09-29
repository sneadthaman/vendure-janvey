import type {Metadata} from 'next';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {query} from '@/platform/vendure/api';
import {GetActiveOrderForCheckoutQuery, GetEligiblePaymentMethodsQuery, GetEligibleShippingMethodsQuery} from '@/features/checkout/graphql';
import {GetCustomerAddressesQuery} from '@/features/account/graphql';
import {redirect} from '@/platform/i18n/navigation';
import CheckoutFlow from './checkout-flow';
import {CheckoutProvider} from './checkout-provider';
import {noIndexRobots} from '@/config/metadata';
import {getActiveCustomer} from '@/features/account/customer';
import {getAvailableCountriesCached} from '@/features/checkout/countries';
import {getActiveNetsuiteAccount} from '@/features/b2b';
import {BadgeDollarSign, Building2, MapPin, ShieldCheck} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Checkout'});
    return {
        title: t('pageTitle'),
        robots: noIndexRobots(),
    };
}

export default async function CheckoutPage() {
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const t = await getTranslations({locale, namespace: 'Checkout'});
    const customer = await getActiveCustomer();
    const isGuest = !customer;

    const [orderRes, addressesRes, countries, shippingMethodsRes, paymentMethodsRes,netsuiteAccount] =
        await Promise.all([
            query(GetActiveOrderForCheckoutQuery, {}, {useAuthToken: true, currencyCode}),
            isGuest
                ? Promise.resolve({ data: { activeCustomer: null } })
                : query(GetCustomerAddressesQuery, {}, {useAuthToken: true}),
            getAvailableCountriesCached(locale),
            query(GetEligibleShippingMethodsQuery, {}, {useAuthToken: true, currencyCode}),
            query(GetEligiblePaymentMethodsQuery, {}, {useAuthToken: true, currencyCode}),
            isGuest?Promise.resolve(null):getActiveNetsuiteAccount(),
        ]);

    const activeOrder = orderRes.data.activeOrder;

    if (!activeOrder || activeOrder.lines.length === 0) {
        return redirect({href: '/cart', locale});
    }

    if (activeOrder.state !== 'AddingItems' && activeOrder.state !== 'ArrangingPayment') {
        return redirect({href: `/order-confirmation/${activeOrder.code}`, locale});
    }

    const addresses = addressesRes.data.activeCustomer?.addresses || [];
    const shippingMethods = shippingMethodsRes.data.eligibleShippingMethods || [];
    const paymentMethods =
        paymentMethodsRes.data.eligiblePaymentMethods?.filter((m) => m.isEligible) || [];

    return (
        <main className="bg-slate-50/70">
        <div className="container mx-auto px-4 py-10 md:py-14">
            <div className="mb-8 max-w-4xl">
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[#bc520e]">{t('eyebrow')}</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{t('pageTitle')}</h1>
                <p className="mt-3 text-base leading-7 text-slate-600">{t('pageDescription')}</p>
            </div>

            {netsuiteAccount && (
                <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#174a78]"><Building2 className="size-5"/></span>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#bc520e]">{t('purchasingFor')}</p>
                                <p className="mt-1 text-lg font-bold text-slate-950">{netsuiteAccount.companyName}</p>
                                <p className="mt-1 text-sm text-slate-600">{netsuiteAccount.requiresApproval ? t('approvalAccount') : t('directPurchaseAccount')}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs font-semibold text-slate-600">
                            <span className="rounded-lg bg-slate-50 px-3 py-2"><BadgeDollarSign className="mx-auto mb-1 size-4 text-[#174a78]"/>{t('accountPricing')}</span>
                            <span className="rounded-lg bg-slate-50 px-3 py-2"><MapPin className="mx-auto mb-1 size-4 text-[#174a78]"/>{t('approvedLocations')}</span>
                            <span className="rounded-lg bg-slate-50 px-3 py-2"><ShieldCheck className="mx-auto mb-1 size-4 text-[#174a78]"/>{t('verifiedTax')}</span>
                        </div>
                    </div>
                </div>
            )}
            <CheckoutProvider
                order={activeOrder}
                addresses={addresses}
                countries={countries}
                shippingMethods={shippingMethods}
                paymentMethods={paymentMethods}
                isGuest={isGuest}
                netsuiteAccount={netsuiteAccount}
            >
                <CheckoutFlow/>
            </CheckoutProvider>
        </div>
        </main>
    );
}
