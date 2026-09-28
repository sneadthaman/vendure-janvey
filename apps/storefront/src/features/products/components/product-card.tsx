import Image from 'next/image';
import {FragmentOf, readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';
import {Price} from '@/features/pricing/price';
import {Suspense} from "react";
import { Link } from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';

interface ProductCardProps {
    product: FragmentOf<typeof ProductCardFragment>;
    preload?: boolean;
    priceOverride?: number;
}

export function ProductCard({product: productProp, preload, priceOverride}: ProductCardProps) {
    const t = useTranslations('Product');
    const product = readFragment(ProductCardFragment, productProp);
    const isSssBrand = product.sku.trim().toUpperCase().startsWith('SSS ');

    return (
        <Link
            href={`/product/${product.slug}`}
            className="group block overflow-hidden rounded-lg border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
        >
            <div className="relative aspect-square overflow-hidden bg-white">
                {isSssBrand&&<span className="absolute left-3 top-3 z-10 rounded bg-[#ed721c] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">SSS Brand</span>}
                {product.productAsset ? (
                    <Image
                        src={product.productAsset.preview}
                        alt={product.productName}
                        fill
                        preload={preload}
                        className="object-contain p-5 transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {t('noImage')}
                    </div>
                )}
            </div>
            <div className="space-y-2 border-t bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{product.sku}</p>
                <h3 className="line-clamp-2 min-h-11 font-semibold leading-snug text-slate-900 transition-colors group-hover:text-[#0d3158]">
                    {product.productName}
                </h3>
                <Suspense fallback={<div className="h-8 w-36 rounded bg-muted"></div>}>
                    <p className="text-lg font-bold tracking-tight text-slate-950">
                        {priceOverride!==undefined?<Price value={priceOverride} currencyCode={product.currencyCode}/>:product.price.__typename === 'PriceRange' ? (
                            product.price.min !== product.price.max ? (
                                <>
                                    <span className="text-xs font-normal text-muted-foreground mr-1">{t('from')}</span>
                                    <Price value={product.price.min} currencyCode={product.currencyCode}/>
                                </>
                            ) : (
                                <Price value={product.price.min} currencyCode={product.currencyCode}/>
                            )
                        ) : product.price.__typename === 'SinglePrice' ? (
                            <Price value={product.price.value} currencyCode={product.currencyCode}/>
                        ) : null}
                    </p>
                </Suspense>
            </div>
        </Link>
    );
}
