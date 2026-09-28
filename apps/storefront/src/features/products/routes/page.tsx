import type { Metadata } from 'next';
import { Link } from '@/platform/i18n/navigation';
import { query } from '@/platform/vendure/api';
import {GetProductDetailQuery} from '@/features/products/graphql';
import { ProductImageCarousel } from '@/features/products/components/product-image-carousel';
import { ProductInfo } from '@/features/products/components/product-info';
import {getDisplayOptionGroups} from '@/features/products/product-options';
import { RelatedProducts } from '@/features/products/components/related-products';
import {ProductDetailTabs} from '@/features/products/components/product-detail-tabs';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { notFound } from 'next/navigation';
import { cacheLife, cacheTag } from 'next/cache';
import {BadgeDollarSign, Building2, Headset} from 'lucide-react';
import { routing } from '@/platform/i18n/routing';
import {
    SITE_NAME,
    truncateDescription,
    buildCanonicalUrl,
    buildOgImages,
} from '@/config/metadata';
import {getTranslations} from 'next-intl/server';
import {toOgLocale} from '@/platform/i18n/locale-utils';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {getRouteLocale} from '@/platform/i18n/server';

function externalResource(value: unknown): {url?: string; reference?: string} {
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? {url: url.toString()} : {};
    } catch {
        const reference = value.trim();
        return /^[a-z0-9_.() -]{1,200}$/i.test(reference) ? {reference} : {};
    }
}

async function getProductMetadataData(slug: string, currencyCode: string) {
    'use cache';
    cacheLife('hours');

    const locale = await getRouteLocale();
    cacheTag(`product-${slug}-${locale}-${currencyCode}`);
    cacheTag('products');

    return await query(GetProductDetailQuery, {slug}, {languageCode: locale, currencyCode});
}

async function getProductData(slug: string, currencyCode: string, locale: string) {
    // Customer pricing is request-specific. Never place this authenticated
    // query inside a public cache scope.
    return query(GetProductDetailQuery, {slug}, {languageCode: locale, currencyCode, useAuthToken: true});
}

export async function generateMetadata({
    params,
}: PageProps<'/[locale]/product/[slug]'>): Promise<Metadata> {
    const { slug } = await params;
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const result = await getProductMetadataData(slug, currencyCode);
    const product = result.data.product;

    const t = await getTranslations({locale, namespace: 'Product'});

    if (!product) {
        return {
            title: t('notFound'),
        };
    }

    const description = truncateDescription(product.description);
    const fallbackDescription = t('shopProductAt', {name: product.name, siteName: SITE_NAME});
    const ogImage = product.assets?.[0]?.preview;
    const ogLocale = toOgLocale(locale);
    const productPath = `/product/${product.slug}`;

    return {
        title: product.name,
        description: description || fallbackDescription,
        alternates: {
            canonical: buildCanonicalUrl(`/${locale}${productPath}`),
            languages: Object.fromEntries(
                routing.locales.map((l) => [l, buildCanonicalUrl(`/${l}${productPath}`)])
            ),
        },
        openGraph: {
            title: product.name,
            description: description || fallbackDescription,
            type: 'website',
            locale: ogLocale,
            url: buildCanonicalUrl(`/${locale}${productPath}`),
            images: buildOgImages(ogImage, product.name),
        },
        twitter: {
            card: 'summary_large_image',
            title: product.name,
            description: description || fallbackDescription,
            images: ogImage ? [ogImage] : undefined,
        },
    };
}

export default async function ProductDetailPage({
    params,
    searchParams,
}: PageProps<'/[locale]/product/[slug]'>) {
    const { slug } = await params;
    const searchParamsResolved = await searchParams;
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const t = await getTranslations({locale, namespace: 'Product'});

    const result = await getProductData(slug, currencyCode, locale);

    const product = result.data.product;

    if (!product) {
        notFound();
    }

    // Get the primary collection (prefer deepest nested / most specific)
    const primaryCollection = product.collections?.find(c => c.parent?.id) ?? product.collections?.[0];

    // Hide options that belong to a shared option group but have no variant on
    // this product (Vendure 3.6 shared/global option groups).
    const productForDisplay = {...product, optionGroups: getDisplayOptionGroups(product)};
    const variant = product.variants[0];
    const variantFields = variant?.customFields;
    const productFields = product.customFields;
    const sds = externalResource(productFields?.sdsUrl);
    const literature = externalResource(productFields?.literatureUrl);
    const video = externalResource(productFields?.videoUrl);
    const manufacturer = product.facetValues.find(value => value.facet.code === 'netsuite-manufacturer')?.name;
    const dimensions = variantFields?.packLength != null && variantFields.packWidth != null && variantFields.packHeight != null
        ? `${variantFields.packLength} × ${variantFields.packWidth} × ${variantFields.packHeight} ${t('specLabels.inches')}`
        : undefined;
    const specifications = [
        manufacturer && {label: t('specLabels.manufacturer'), value: manufacturer},
        variant?.sku && {label: t('specLabels.sku'), value: variant.sku},
        variantFields?.mpn && {label: t('specLabels.mpn'), value: variantFields.mpn},
        variantFields?.upc && {label: t('specLabels.upc'), value: variantFields.upc},
        variantFields?.packSize && {label: t('specLabels.packSize'), value: variantFields.packSize},
        variantFields?.weight != null && {label: t('specLabels.weight'), value: `${variantFields.weight} ${t('specLabels.pounds')}`},
        dimensions && {label: t('specLabels.dimensions'), value: dimensions},
        variantFields?.palletQuantity != null && {label: t('specLabels.palletQuantity'), value: String(variantFields.palletQuantity)},
        variantFields?.countryOfManufacture && {label: t('specLabels.countryOfManufacture'), value: variantFields.countryOfManufacture},
    ].filter((item): item is {label: string; value: string} => Boolean(item));

    return (
        <>
            <div className="mt-20 bg-[#f7f8fa]">
                <div className="container mx-auto px-4 py-8 md:py-10">
                {/* Breadcrumb Navigation */}
                <Breadcrumb className="mb-6">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink render={<Link href="/" />}>{t('home')}</BreadcrumbLink>
                        </BreadcrumbItem>
                        {primaryCollection && (
                            <>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbLink render={<Link href={`/collection/${primaryCollection.slug}`} />}>
                                        {primaryCollection.name}
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                            </>
                        )}
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{product.name}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:gap-12">
                    {/* Left Column: Image Carousel */}
                    <div className="lg:sticky lg:top-20 lg:self-start">
                        <ProductImageCarousel images={product.assets} />
                    </div>

                    {/* Right Column: Product Info */}
                    <div>
                        <ProductInfo product={productForDisplay} searchParams={searchParamsResolved} currencyCode={currencyCode} manufacturer={manufacturer} summary={productFields?.storeDescription || productFields?.salesDescription} />
                    </div>
                </div>
                </div>
            </div>

            <section className="border-t bg-[#0d3158] py-6 text-white">
                <div className="container mx-auto px-4">
                    <div className="grid gap-5 md:grid-cols-3 md:gap-8">
                        <div className="flex items-center gap-3"><BadgeDollarSign className="size-6 shrink-0 text-orange-300"/><span><strong className="block text-sm">{t('service.accountPricing.title')}</strong><span className="text-sm text-blue-100">{t('service.accountPricing.description')}</span></span></div>
                        <div className="flex items-center gap-3"><Building2 className="size-6 shrink-0 text-orange-300"/><span><strong className="block text-sm">{t('service.businessPurchasing.title')}</strong><span className="text-sm text-blue-100">{t('service.businessPurchasing.description')}</span></span></div>
                        <div className="flex items-center gap-3"><Headset className="size-6 shrink-0 text-orange-300"/><span><strong className="block text-sm">{t('service.support.title')}</strong><span className="text-sm text-blue-100">{t('service.support.description')}</span></span></div>
                    </div>
                </div>
            </section>

            <ProductDetailTabs
                description={product.description}
                storeDescription={productFields?.storeDescription}
                specifications={specifications}
                sdsUrl={sds.url}
                sdsReference={sds.reference}
                literatureUrl={literature.url}
                videoUrl={video.url}
            />

            {primaryCollection && (
                <RelatedProducts
                    collectionSlug={primaryCollection.slug}
                    currentProductId={product.id}
                />
            )}
        </>
    );
}
