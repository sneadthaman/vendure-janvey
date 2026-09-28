import Image from 'next/image';
import {Suspense} from 'react';
import {getTranslations} from 'next-intl/server';
import {getRouteLocale} from '@/platform/i18n/server';
import {NavigationLink} from '@/site/navigation/navigation-link';
import {NavbarCollections} from '@/site/navigation/navbar/navbar-collections';
import {NavbarCart} from '@/site/navigation/navbar/navbar-cart';
import {NavbarUser} from '@/site/navigation/navbar/navbar-user';
import {MobileNavWrapper} from '@/site/navigation/navbar/mobile-nav-wrapper';
import {SearchInput} from '@/site/navigation/search-input';
import {NavbarUserSkeleton} from '@/site/navigation/skeletons/navbar-user-skeleton';
import {SearchInputSkeleton} from '@/site/navigation/skeletons/search-input-skeleton';

async function DesktopNavigation() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Navigation'});

    return <nav className="hidden items-center gap-1 md:flex">
        <Suspense><NavbarCollections/></Suspense>
        <NavigationLink href="/sss-brand" className="rounded-md px-3 py-2 text-sm font-bold text-[#bc520e] hover:bg-orange-50">{t('sssBrand')}</NavigationLink>
        <NavigationLink href="/search" className="hidden rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 xl:block">{t('shopAll')}</NavigationLink>
    </nav>;
}

export function Navbar() {
    return (
        <header className="fixed inset-x-0 top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur-md">
            <div className="container mx-auto px-4">
                <div className="flex h-20 items-center gap-4 lg:gap-7">
                    <div className="flex shrink-0 items-center gap-3">
                        <Suspense>
                            <MobileNavWrapper />
                        </Suspense>
                        <NavigationLink href="/" className="block">
                            <Image src="/images/brand/janvey.png" alt="Janvey" width={250} height={86} priority className="h-10 w-auto" />
                        </NavigationLink>
                    </div>
                    <Suspense><DesktopNavigation/></Suspense>
                    <div className="ml-auto flex min-w-0 items-center gap-2 lg:flex-1">
                        <div className="hidden min-w-0 flex-1 lg:flex lg:justify-end">
                            <Suspense fallback={<SearchInputSkeleton />}>
                                <SearchInput/>
                            </Suspense>
                        </div>
                        <Suspense>
                            <NavbarCart/>
                        </Suspense>
                        <Suspense fallback={<NavbarUserSkeleton />}>
                            <NavbarUser/>
                        </Suspense>
                    </div>
                </div>
            </div>
        </header>
    );
}
