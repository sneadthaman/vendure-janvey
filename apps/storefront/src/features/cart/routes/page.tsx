import type {Metadata} from 'next';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {Cart} from "@/features/cart/routes/cart";
import {Suspense} from "react";
import {CartSkeleton} from "@/features/cart/components/cart-skeleton";
import {noIndexRobots} from '@/config/metadata';

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Cart'});
    return {
        title: t('title'),
        robots: noIndexRobots(),
    };
}

export default async function CartPage() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Cart'});

    return (
        <main className="bg-slate-50/70">
            <div className="container mx-auto px-4 py-10 md:py-14">
                <div className="mb-8 max-w-3xl">
                    <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[#bc520e]">{t('eyebrow')}</p>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{t('title')}</h1>
                    <p className="mt-3 text-base leading-7 text-slate-600">{t('description')}</p>
                </div>

                <Suspense fallback={<CartSkeleton />}>
                    <Cart/>
                </Suspense>
            </div>
        </main>
    );
}
