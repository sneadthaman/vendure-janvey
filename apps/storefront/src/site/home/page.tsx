import type {Metadata} from "next";
import {Suspense} from "react";
import {getRouteLocale} from "@/platform/i18n/server";
import {HeroSection} from "@/site/home/hero-section";
import {CategoryShowcase} from '@/site/home/category-showcase';
import {SssBrandSpotlight} from '@/site/home/sss-brand-spotlight';
import {FeaturedProducts} from '@/features/products/featured-products';
import {SITE_NAME, SITE_URL, buildCanonicalUrl} from "@/config/metadata";
import {BadgeDollarSign, ClipboardCheck, Headset, Truck} from "lucide-react";
import {getTranslations} from 'next-intl/server';
import {toOgLocale} from '@/platform/i18n/locale-utils';

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});
    const ogLocale = toOgLocale(locale);

    return {
        title: {
            absolute: `${SITE_NAME} - ${t('pageTitle')}`,
        },
        description: t('description'),
        alternates: {
            canonical: buildCanonicalUrl("/"),
        },
        openGraph: {
            title: `${SITE_NAME} - ${t('pageTitle')}`,
            description: t('ogDescription'),
            type: "website",
            locale: ogLocale,
            url: SITE_URL,
        },
    };
}

const featureKeys = [
    {icon: Truck, key: 'reliableFulfillment'},
    {icon: BadgeDollarSign, key: 'accountPricing'},
    {icon: ClipboardCheck, key: 'purchasingControl'},
    {icon: Headset, key: 'customerSupport'},
] as const;

export default async function Home() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});

    return (
        <div className="min-h-screen bg-white pt-20">
            <HeroSection/>
            <Suspense fallback={<div className="h-96 bg-white"/>}>
                <CategoryShowcase/>
            </Suspense>
            <Suspense fallback={<div className="h-96 bg-[#fff7ed]"/>}>
                <SssBrandSpotlight/>
            </Suspense>
            <Suspense>
                <FeaturedProducts/>
            </Suspense>

            <section className="border-t bg-[#f4f5f7] py-14 md:py-18">
                <div className="container mx-auto px-4">
                    <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                        {t('whyShopWithUs')}
                    </h2>
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                        {featureKeys.map((feature) => (
                            <div
                                key={feature.key}
                                className="rounded-xl border bg-white p-6 shadow-sm"
                            >
                                <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-[#fff0e5]">
                                    <feature.icon className="size-5 text-[#d65c0e]" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-950">{t(`features.${feature.key}.title`)}</h3>
                                <p className="mt-2 leading-relaxed text-slate-600">{t(`features.${feature.key}.description`)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
