import type {Metadata} from 'next';
import Image from 'next/image';
import {Suspense} from 'react';
import {getTranslations} from 'next-intl/server';
import {SearchResults, SearchResultsSkeleton} from '@/features/search';
import {getRouteLocale} from '@/platform/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'SssBrand'});
    return {title: t('pageTitle'), description: t('pageDescription')};
}

export default async function SssBrandPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'SssBrand'});

    return <main className="mt-20 bg-white">
        <section className="border-b bg-[#fff7ed]">
            <div className="container mx-auto grid items-center gap-8 px-4 py-12 lg:grid-cols-[0.65fr_1fr] lg:py-16">
                <Image src="/images/brand/triple-s.png" alt="Triple S" width={356} height={89} className="h-auto w-full max-w-sm" priority/>
                <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#bc520e]">{t('eyebrow')}</p><h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{t('title')}</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{t('description')}</p></div>
            </div>
        </section>
        <section className="container mx-auto px-4 py-12">
            <Suspense fallback={<SearchResultsSkeleton/>}><SearchResults searchParams={searchParams} forcedTerm="SSS"/></Suspense>
        </section>
    </main>;
}
