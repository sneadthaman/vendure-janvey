import Image from 'next/image';
import {ArrowRight} from 'lucide-react';
import {getRouteLocale} from '@/platform/i18n/server';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {getActiveNetsuitePriceMap} from '@/features/b2b';
import {ProductCard} from '@/features/products';
import {ProductCardFragment} from '@/features/products/graphql';
import {SearchProductsQuery} from '@/features/search/graphql';
import {query} from '@/platform/vendure/api';
import {readFragment} from '@/platform/vendure/graphql';
import {Link} from '@/platform/i18n/navigation';
import {getTranslations} from 'next-intl/server';

export async function SssBrandSpotlight() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});
    const currencyCode = await getActiveCurrencyCode();
    const result = await query(SearchProductsQuery, {input:{term:'SSS',take:24,skip:0,groupByProduct:true}}, {languageCode:locale,currencyCode});
    const products = result.data.search.items.filter(item => readFragment(ProductCardFragment,item).productAsset).slice(0,4);
    const priceBySku = await getActiveNetsuitePriceMap(products.map(item => readFragment(ProductCardFragment,item).sku));

    return (
        <section className="bg-[#fff7ed] py-14 md:py-18">
            <div className="container mx-auto px-4">
                <div className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
                    <div className="max-w-2xl"><Image src="/images/brand/triple-s.png" alt="Triple S" width={356} height={89} className="h-auto w-56"/><h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{t('sssBrand.title')}</h2><p className="mt-3 text-lg leading-8 text-slate-600">{t('sssBrand.description')}</p></div>
                    <Link href="/sss-brand" className="inline-flex items-center gap-2 font-semibold text-[#a8490c] hover:underline">{t('sssBrand.shopAll')}<ArrowRight className="size-4"/></Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map((product,index) => {const item=readFragment(ProductCardFragment,product);return <ProductCard key={item.productId} product={product} preload={index===0} priceOverride={priceBySku[item.sku]}/>;})}</div>
            </div>
        </section>
    );
}
