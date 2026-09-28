import Image from 'next/image';
import {ArrowRight, PackageOpen} from 'lucide-react';
import {getRouteLocale} from '@/platform/i18n/server';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {getTopCollections} from '@/features/collections/data';
import {GetCollectionProductsQuery} from '@/features/collections/graphql';
import {ProductCardFragment} from '@/features/products/graphql';
import {query} from '@/platform/vendure/api';
import {readFragment} from '@/platform/vendure/graphql';
import {Link} from '@/platform/i18n/navigation';
import {getTranslations} from 'next-intl/server';

export async function CategoryShowcase() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});
    const currencyCode = await getActiveCurrencyCode();
    const collections = (await getTopCollections(locale)).filter(collection => collection.slug !== 'featured-products');
    const categories = await Promise.all(collections.map(async collection => {
        const result = await query(GetCollectionProductsQuery, {slug: collection.slug,input: {collectionSlug: collection.slug, take: 24, skip: 0, groupByProduct: true}}, {languageCode: locale, currencyCode});
        const product = result.data.search.items.map(item => readFragment(ProductCardFragment, item)).find(item => item.productAsset);
        return {...collection, image: product?.productAsset?.preview};
    }));

    return (
        <section className="bg-white py-14 md:py-18">
            <div className="container mx-auto px-4">
                <div className="mb-8 flex items-end justify-between gap-4">
                    <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#ed721c]">{t('categories.eyebrow')}</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t('categories.title')}</h2></div>
                    <Link href="/search" className="hidden items-center gap-2 text-sm font-semibold text-[#0d3158] hover:underline sm:flex">{t('categories.viewAll')}<ArrowRight className="size-4"/></Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map(category => (
                        <Link key={category.id} href={`/collection/${category.slug}`} className="group grid min-h-48 grid-cols-[1fr_0.9fr] overflow-hidden rounded-xl border bg-[#f6f7f8] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                            <div className="flex flex-col justify-between p-6"><h3 className="text-xl font-bold leading-tight text-slate-950">{category.name}</h3><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0d3158]">{t('categories.shopCategory')}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1"/></span></div>
                            <div className="relative m-3 ml-0 overflow-hidden rounded-lg bg-white">
                                {category.image?<Image src={category.image} alt="" fill className="object-contain p-3 transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 40vw, 220px"/>:<div className="flex h-full items-center justify-center"><PackageOpen className="size-12 text-slate-300"/></div>}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
