import {ResultOf} from '@/platform/vendure/graphql';
import {ProductCard} from './components/product-card';
import {Pagination} from './components/pagination';
import {SortDropdown} from '@/features/search/sort-dropdown';
import {SearchProductsQuery} from '@/features/search/graphql';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {getActiveNetsuitePriceMap} from '@/features/b2b';
import {readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from './graphql';

interface ProductGridProps {
    productDataPromise: Promise<{
        data: ResultOf<typeof SearchProductsQuery>;
        token?: string;
    }>;
    currentPage: number;
    take: number;
}

export async function ProductGrid({productDataPromise, currentPage, take}: ProductGridProps) {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Product'});
    const result = await productDataPromise;

    const searchResult = result.data.search;
    const priceMap=await getActiveNetsuitePriceMap(searchResult.items.map(item=>readFragment(ProductCardFragment,item).sku));
    const totalPages = Math.ceil(searchResult.totalItems / take);

    if (!searchResult.items.length) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('noProductsFound')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {t('productCount', {count: searchResult.totalItems})}
                </p>
                <SortDropdown/>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResult.items.map((product, i) => (
                    <ProductCard key={'product-grid-item' + i} product={product} priceOverride={priceMap[readFragment(ProductCardFragment,product).sku]}/>
                ))}
            </div>

            {totalPages > 1 && (
                <Pagination currentPage={currentPage} totalPages={totalPages}/>
            )}
        </div>
    );
}
