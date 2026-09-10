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

export async function NavbarCollections() {
    "use cache";
    cacheLife('days');

    const locale = await getRouteLocale();
    cacheTag(`navbar-collections-${locale}`);

    const collections = await getTopCollections(locale);

    return (
        <NavigationMenu>
            <NavigationMenuList>
                {collections.map((collection) => (
                    <NavigationMenuItem key={collection.slug}>
                        <NavigationMenuTrigger className="bg-transparent px-2 text-xs lg:px-3 xl:text-sm">{collection.name}</NavigationMenuTrigger>
                        <NavigationMenuContent className="min-w-72 p-3">
                            <NavigationMenuLink render={<NavigationLink href={`/collection/${collection.slug}`} className="font-semibold" />}>Shop all {collection.name}</NavigationMenuLink>
                            <div className="mt-1 grid gap-1">
                                {collection.children?.map(child=><NavigationMenuLink key={child.slug} render={<NavigationLink href={`/collection/${child.slug}`} />}>{child.name}</NavigationMenuLink>)}
                            </div>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                ))}
            </NavigationMenuList>
        </NavigationMenu>
    );
}
