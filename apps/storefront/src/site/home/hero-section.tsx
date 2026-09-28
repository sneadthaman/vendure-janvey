import Image from 'next/image';
import {ArrowRight, Search, ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Link} from '@/platform/i18n/navigation';
import {getTranslations} from 'next-intl/server';
import {getRouteLocale} from '@/platform/i18n/server';

export async function HeroSection() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Hero'});

    return (
        <section className="bg-[#f4f5f7] py-6 lg:py-10">
            <div className="container mx-auto px-4">
                <div className="grid overflow-hidden rounded-2xl border bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="flex flex-col justify-center px-7 py-12 sm:px-12 lg:px-14 lg:py-16">
                        <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#ed721c]">{t('eyebrow')}</p>
                        <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">{t('title')}</h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{t('subtitle')}</p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button render={<Link href="/search" />} nativeButton={false} size="lg" className="bg-[#0d3158] px-6 hover:bg-[#174a78]"><Search className="size-4"/>{t('shopNow')}</Button>
                            <Button render={<Link href="/sss-brand" />} nativeButton={false} variant="outline" size="lg" className="border-slate-300 px-6">{t('shopSss')}<ArrowRight className="size-4"/></Button>
                        </div>
                        <div className="mt-8 flex items-center gap-3 border-t pt-5 text-sm font-medium text-slate-600"><ShieldCheck className="size-5 text-[#ed721c]"/>{t('accountPricing')}</div>
                    </div>
                    <div className="relative min-h-80 lg:min-h-[500px]">
                        <Image src="/images/brand/facility-walk.jpg" alt="Janvey team walking through the warehouse" fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw"/>
                        <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-transparent"/>
                        <div className="absolute bottom-5 right-5 rounded-lg bg-white/95 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur">{t('photoCaption')}</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
