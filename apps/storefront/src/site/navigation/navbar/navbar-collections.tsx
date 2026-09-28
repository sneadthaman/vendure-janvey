import {getRouteLocale} from '@/platform/i18n/server';
import {cacheLife, cacheTag} from 'next/cache';
import {getTopCollections} from '@/features/collections/data';
import {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuContent,
    NavigationMenuLink,
    NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import {NavigationLink} from '@/site/navigation/navigation-link';
import {getTranslations} from 'next-intl/server';

export async function NavbarCollections() {
    "use cache";
    cacheLife('days');

    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Navigation'});
    cacheTag(`navbar-collections-${locale}`);

    const collections = (await getTopCollections(locale)).filter(collection=>collection.slug!=='featured-products');

    return (
        <NavigationMenu>
            <NavigationMenuList>
                <NavigationMenuItem>
                    <NavigationMenuTrigger className="bg-transparent px-3 text-sm font-bold text-slate-900">{t('products')}</NavigationMenuTrigger>
                    <NavigationMenuContent className="w-[720px] p-5">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-5">{collections.map(collection=><div key={collection.slug}><NavigationMenuLink render={<NavigationLink href={`/collection/${collection.slug}`} className="font-bold text-slate-950" />}>{collection.name}</NavigationMenuLink><div className="mt-1 grid gap-0.5">{collection.children?.slice(0,4).map(child=><NavigationMenuLink key={child.slug} render={<NavigationLink href={`/collection/${child.slug}`} className="text-sm text-slate-600" />}>{child.name}</NavigationMenuLink>)}</div></div>)}</div>
                    </NavigationMenuContent>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
    );
}
