import type {Metadata} from 'next';
import {Suspense} from 'react';
import {noIndexRobots} from '@/config/metadata';
import {AccountNavLinks} from '@/features/account/components/account-nav-links';
import {getActiveNetsuiteAccount} from '@/features/b2b';

export const metadata: Metadata = {
    robots: noIndexRobots(),
};

const baseNavItems = [
    {href: '/account/orders', labelKey: 'orders', icon: 'Package'},
    {href: '/account/addresses', labelKey: 'addresses', icon: 'MapPin'},
    {href: '/account/profile', labelKey: 'profile', icon: 'User'},
];

export default function AccountLayout({children}: LayoutProps<'/[locale]/account'>) {
    return (
        <div className="container mx-auto px-4 py-30">
            <Suspense fallback={<div className="h-10 md:hidden"/>}>
                <AccountNavigation layout="horizontal"/>
            </Suspense>
            <div className="flex gap-8">
                <aside className="hidden md:block w-64 shrink-0">
                    <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-muted"/>}>
                        <AccountNavigation layout="vertical"/>
                    </Suspense>
                </aside>
                <main className="flex-1 min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}

async function AccountNavigation({layout}:{layout:'horizontal'|'vertical'}) {
    const netsuiteAccount=await getActiveNetsuiteAccount();
    const navItems=netsuiteAccount?[{href:'/account/approvals',labelKey:'approvals',icon:'ShieldCheck'},...baseNavItems]:baseNavItems;
    return <div className={layout==='horizontal'?'md:hidden mb-6':undefined}><AccountNavLinks items={navItems} layout={layout} /></div>;
}
