import {getRouteLocale} from '@/platform/i18n/server';
import {cacheLife, cacheTag} from 'next/cache';
import {getTopCollections} from '@/features/collections/data';
import Image from 'next/image';
import {NavigationLink} from '@/site/navigation/navigation-link';
import {getTranslations} from 'next-intl/server';

const COPYRIGHT_YEAR = 2026;

async function Copyright() {
    'use cache';
    cacheLife('days');
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Footer'});
    return <div>&copy; {COPYRIGHT_YEAR} {t('copyright')}</div>;
}

export async function Footer() {
    'use cache';
    cacheLife('days');
    const locale = await getRouteLocale();
    cacheTag(`footer-${locale}`);
    const t = await getTranslations({locale, namespace: 'Footer'});
    const collections = (await getTopCollections(locale)).filter(collection=>collection.slug!=='featured-products');

    return <footer className="mt-auto border-t bg-[#0d3158] text-white">
        <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-1 gap-9 md:grid-cols-4">
                <div><NavigationLink href="/" className="mb-4 inline-block rounded-md bg-white px-3 py-2"><Image src="/images/brand/janvey.png" alt="Janvey" width={250} height={86} className="h-9 w-auto"/></NavigationLink><p className="text-balance text-sm leading-relaxed text-blue-100">{t('description')}</p></div>
                <div><p className="mb-4 text-sm font-bold">{t('categories')}</p><ul className="space-y-2 text-sm text-blue-100">{collections.slice(0,6).map(collection=><li key={collection.id}><NavigationLink href={`/collection/${collection.slug}`} className="transition-colors hover:text-white">{collection.name}</NavigationLink></li>)}</ul></div>
                <div><p className="mb-4 text-sm font-bold">{t('customer')}</p><ul className="space-y-2 text-sm text-blue-100"><li><NavigationLink href="/search" className="hover:text-white">{t('shopAll')}</NavigationLink></li><li><NavigationLink href="/account/orders" className="hover:text-white">{t('orders')}</NavigationLink></li><li><NavigationLink href="/account/profile" className="hover:text-white">{t('account')}</NavigationLink></li></ul></div>
                <div><p className="mb-4 text-sm font-bold">{t('featuredBrand')}</p><NavigationLink href="/sss-brand" className="inline-block rounded-lg bg-white p-3"><Image src="/images/brand/triple-s.png" alt="Triple S" width={356} height={89} className="h-auto w-48"/></NavigationLink><p className="mt-3 text-sm leading-relaxed text-blue-100">{t('sssDescription')}</p></div>
            </div>
            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/20 pt-8 text-sm text-blue-100 md:flex-row"><Copyright/><span>{t('serviceLine')}</span></div>
        </div>
    </footer>;
}
