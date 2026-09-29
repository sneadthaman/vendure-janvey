import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Check, ShoppingBag, ClipboardList, MailCheck, MapPin, ShieldCheck} from 'lucide-react';
import { Link } from '@/platform/i18n/navigation';
import Image from 'next/image';
import {Separator} from '@/components/ui/separator';
import {Price} from '@/features/pricing/price';
import {notFound} from 'next/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {query} from '@/platform/vendure/api';
import {graphql} from '@/platform/vendure/graphql';

const GetOrderByCodeQuery = graphql(`
    query GetOrderByCode($code: String!) {
        orderByCode(code: $code) {
            id
            code
            state
            subTotal
            shipping
            totalWithTax
            currencyCode
            taxSummary {
                taxTotal
            }
            lines {
                id
                productVariant {
                    id
                    name
                    product {
                        id
                        name
                        slug
                        featuredAsset {
                            id
                            preview
                        }
                    }
                }
                quantity
                linePrice
                linePriceWithTax
            }
            shippingAddress {
                fullName
                streetLine1
                streetLine2
                city
                province
                postalCode
                country
            }
        }
    }
`);

interface OrderConfirmationProps {
    paramsPromise: Promise<{ locale: string; code: string }>;
}

export async function OrderConfirmation({paramsPromise}: OrderConfirmationProps) {
    const {code} = await paramsPromise;
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'OrderConfirmation'});

    const {data} = await query(GetOrderByCodeQuery, {code}, {useAuthToken: true});
    const order = data.orderByCode;

    if (!order) {
        notFound();
    }

    const taxTotal = order.taxSummary.reduce((total, taxLine) => total + taxLine.taxTotal, 0);

    return (
        <main className="bg-slate-50/70">
        <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="mx-auto max-w-4xl">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <div className="rounded-full bg-emerald-600 p-5 shadow-lg shadow-emerald-600/20">
                            <Check className="h-10 w-10 text-white" strokeWidth={3} />
                        </div>
                    </div>
                    <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[#bc520e]">{t('eyebrow')}</p>
                    <h1 className="mb-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{t('orderConfirmed')}</h1>
                    <p className="text-slate-600">
                        {t('thankYou')}{' '}
                        <span className="font-semibold text-foreground">{order.code}</span>
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                        {t('emailConfirmation')}
                    </p>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><MailCheck className="mb-3 size-5 text-[#174a78]"/><p className="font-semibold text-slate-950">{t('confirmationSent')}</p><p className="mt-1 text-sm text-slate-600">{t('confirmationSentBody')}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><ShieldCheck className="mb-3 size-5 text-[#174a78]"/><p className="font-semibold text-slate-950">{t('accountRecorded')}</p><p className="mt-1 text-sm text-slate-600">{t('accountRecordedBody')}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><MapPin className="mb-3 size-5 text-[#174a78]"/><p className="font-semibold text-slate-950">{t('fulfillmentNext')}</p><p className="mt-1 text-sm text-slate-600">{t('fulfillmentNextBody')}</p></div>
                </div>

                <Card className="mb-6 overflow-hidden border-slate-200 shadow-sm">
                    <CardHeader className="bg-[#0d3158] text-white">
                        <CardTitle>{t('orderSummary')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {order.lines.map((line) => (
                            <div key={line.id} className="flex gap-4 items-center">
                                {line.productVariant.product.featuredAsset && (
                                    <div className="flex-shrink-0">
                                        <Image
                                            src={line.productVariant.product.featuredAsset.preview}
                                            alt={line.productVariant.name}
                                            width={80}
                                            height={80}
                                            className="rounded-lg object-cover h-20 w-20 object-center"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium">{line.productVariant.product.name}</p>
                                    {line.productVariant.name !== line.productVariant.product.name && (
                                        <p className="text-sm text-muted-foreground">
                                            {line.productVariant.name}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">{t('qty', {quantity: line.quantity})}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">
                                        <Price value={line.linePrice} currencyCode={order.currencyCode}/>
                                    </p>
                                </div>
                            </div>
                        ))}

                        <Separator/>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">{t('subtotal')}</span><Price value={order.subTotal} currencyCode={order.currencyCode}/></div>
                            <div className="flex justify-between"><span className="text-slate-500">{t('shipping')}</span><Price value={order.shipping} currencyCode={order.currencyCode}/></div>
                            <div className="flex justify-between"><span className="text-slate-500">{t('tax')}</span><Price value={taxTotal} currencyCode={order.currencyCode}/></div>
                        </div>

                        <Separator/>

                        <div className="flex justify-between items-baseline font-bold text-lg">
                            <span>{t('total')}</span>
                            <span className="text-xl">
                                <Price value={order.totalWithTax} currencyCode={order.currencyCode}/>
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {order.shippingAddress && (
                    <Card className="mb-8 border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle>{t('shippingAddress')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="font-medium">{order.shippingAddress.fullName}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {order.shippingAddress.streetLine1}
                                {order.shippingAddress.streetLine2 && `, ${order.shippingAddress.streetLine2}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {order.shippingAddress.city}, {order.shippingAddress.province}{' '}
                                {order.shippingAddress.postalCode}
                            </p>
                            <p className="text-sm text-muted-foreground">{order.shippingAddress.country}</p>
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button nativeButton={false} render={<Link href="/" />} className="flex-1" size="lg">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        {t('continueShopping')}
                    </Button>
                    <Button nativeButton={false} render={<Link href="/account/orders" />} variant="outline" className="flex-1" size="lg">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        {t('viewOrders')}
                    </Button>
                </div>
            </div>
        </div>
        </main>
    );
}
