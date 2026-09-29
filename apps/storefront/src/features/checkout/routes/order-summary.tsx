'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Building2, ChevronDown, ShieldCheck, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { OrderLine } from './types';
import { useCheckout } from './checkout-provider';
import { Price } from '@/features/pricing/price';
import {useTranslations} from 'next-intl';

function OrderSummaryContent({ order, t }: { order: ReturnType<typeof useCheckout>['order']; t: ReturnType<typeof useTranslations<'Checkout'>> }) {
  const taxTotal = order.taxSummary.reduce((total, taxLine) => total + taxLine.taxTotal, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {order.lines.map((line: OrderLine) => (
          <div key={line.id} className="flex gap-3">
            {line.productVariant.product.featuredAsset ? (
              <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted">
                <Image
                  src={line.productVariant.product.featuredAsset.preview}
                  alt={line.productVariant.name}
                  width={56}
                  height={56}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2">
                {line.productVariant.product.name}
              </p>
              {line.productVariant.name !== line.productVariant.product.name && (
                <p className="text-xs text-muted-foreground">
                  {line.productVariant.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('qty', {quantity: line.quantity})}
              </p>
            </div>
            <div className="text-sm font-medium">
              <Price value={line.linePrice} currencyCode={order.currencyCode} />
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('subtotal')}</span>
          <span>
            <Price value={order.subTotal} currencyCode={order.currencyCode} />
          </span>
        </div>

        {order.discounts && order.discounts.length > 0 && (
          <>
            {order.discounts.map((discount, index: number) => (
              <div key={index} className="flex justify-between text-sm text-green-600">
                <span>{discount.description}</span>
                <span>
                  <Price value={discount.amount} currencyCode={order.currencyCode} />
                </span>
              </div>
            ))}
          </>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('shipping')}</span>
          <span>
            {order.shipping > 0
              ? <Price value={order.shipping} currencyCode={order.currencyCode} />
              : t('toBeCalculated')}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('tax')}</span>
          <span>
            {order.shippingAddress
              ? <Price value={taxTotal} currencyCode={order.currencyCode} />
              : t('calculatedAfterAddress')}
          </span>
        </div>
      </div>

      <Separator />

      <div className="flex justify-between font-bold text-lg">
        <span>{t('total')}</span>
        <span>
          <Price value={order.totalWithTax} currencyCode={order.currencyCode} />
        </span>
      </div>
    </div>
  );
}

export default function OrderSummary() {
  const t = useTranslations('Checkout');
  const { order, netsuiteAccount } = useCheckout();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile: Collapsible summary */}
      <div className="lg:hidden">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    {t('orderSummary')} ({order.lines.length} {order.lines.length === 1 ? t('item') : t('items')})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">
                      <Price value={order.totalWithTax} currencyCode={order.currencyCode} />
                    </span>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <OrderSummaryContent order={order} t={t} />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {/* Desktop: Always visible sticky summary */}
      <div className="hidden lg:block">
        <Card className="sticky top-24 overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="bg-[#0d3158] text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-200">{t('purchaseSummary')}</p>
            <CardTitle className="text-xl">{t('orderSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {netsuiteAccount && (
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-5 shrink-0 text-[#174a78]"/>
                  <div>
                    <p className="font-semibold text-slate-950">{netsuiteAccount.companyName}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{t('accountPricingApplied')}</p>
                  </div>
                </div>
              </div>
            )}
            <OrderSummaryContent order={order} t={t} />
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600"/>
              <span>{netsuiteAccount?.requiresApproval ? t('approvalSummary') : t('checkoutAssurance')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
