import Image from 'next/image';
import { Link } from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Minus, Plus, Trash2} from 'lucide-react';
import {Price} from '@/features/pricing/price';
import {removeFromCart, adjustQuantity} from './actions';
import {getTranslations} from 'next-intl/server';

type ActiveOrder = {
    id: string;
    currencyCode: string;
    lines: Array<{
        id: string;
        quantity: number;
        unitPrice: number;
        linePrice: number;
        productVariant: {
            id: string;
            name: string;
            sku: string;
            product: {
                name: string;
                slug: string;
                featuredAsset?: {
                    preview: string;
                } | null;
            };
        };
    }>;
};

export async function CartItems({activeOrder}: { activeOrder: ActiveOrder | null }) {
    const t = await getTranslations('Cart');
    if (!activeOrder || activeOrder.lines.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 shadow-sm lg:col-span-2">
                <div className="mx-auto max-w-lg text-center">
                    <h1 className="text-3xl font-bold mb-4">{t('empty')}</h1>
                    <p className="text-muted-foreground mb-8">
                        {t('emptyMessage')}
                    </p>
                    <Button render={<Link href="/" />} nativeButton={false}>{t('continueShopping')}</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {activeOrder.lines.map((line) => (
                <div
                    key={line.id}
                    className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:p-5"
                >
                    <Link
                        href={`/product/${line.productVariant.product.slug}`}
                        className="flex h-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white sm:h-32 sm:w-32"
                    >
                        {line.productVariant.product.featuredAsset ? (
                            <Image
                                src={line.productVariant.product.featuredAsset.preview}
                                alt={line.productVariant.name}
                                width={120}
                                height={120}
                                className="h-full w-full object-contain p-2"
                            />
                        ) : <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('imageUnavailable')}</span>}
                    </Link>

                    <div className="min-w-0 flex-grow">
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#bc520e]">{t('accountItem')}</p>
                        <Link
                            href={`/product/${line.productVariant.product.slug}`}
                            className="block text-lg font-bold leading-snug text-slate-950 hover:text-[#174a78]"
                        >
                            {line.productVariant.product.name}
                        </Link>
                        {line.productVariant.name !== line.productVariant.product.name && (
                            <p className="text-sm text-muted-foreground mt-1">
                                {line.productVariant.name}
                            </p>
                        )}
                        <p className="mt-2 text-sm text-slate-500">
                            {t('sku', {sku: line.productVariant.sku})}
                        </p>
                        <p className="mt-3 text-sm text-slate-600 sm:hidden">
                            <span className="font-semibold text-slate-950"><Price value={line.unitPrice} currencyCode={activeOrder.currencyCode}/></span> {t('each')}
                        </p>

                        <div className="mt-5 flex items-center gap-3">
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50">
                                <form
                                    action={async () => {
                                        'use server';
                                        await adjustQuantity(line.id, Math.max(1, line.quantity - 1));
                                    }}
                                >
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-lg hover:bg-white"
                                        disabled={line.quantity <= 1}
                                    >
                                        <Minus className="h-4 w-4"/>
                                        <span className="sr-only">{t('decreaseQuantity')}</span>
                                    </Button>
                                </form>

                                <span className="w-10 text-center font-semibold tabular-nums transition-all duration-200">{line.quantity}</span>

                                <form
                                    action={async () => {
                                        'use server';
                                        await adjustQuantity(line.id, line.quantity + 1);
                                    }}
                                >
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-lg hover:bg-white"
                                    >
                                        <Plus className="h-4 w-4"/>
                                        <span className="sr-only">{t('increaseQuantity')}</span>
                                    </Button>
                                </form>
                            </div>

                            <form
                                action={async () => {
                                    'use server';
                                    await removeFromCart(line.id);
                                }}
                            >
                                <Button
                                    type="submit"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                                >
                                    <Trash2 className="h-4 w-4"/>
                                    <span className="sr-only">{t('remove')}</span>
                                </Button>
                            </form>

                            <div className="sm:hidden ml-auto">
                                <p className="font-semibold text-lg">
                                    <Price value={line.linePrice}
                                           currencyCode={activeOrder.currencyCode}/>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('lineTotal')}</p>
                        <p className="mt-1 text-xl font-bold text-slate-950">
                            <Price value={line.linePrice} currencyCode={activeOrder.currencyCode}/>
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            <Price value={line.unitPrice} currencyCode={activeOrder.currencyCode}/> {t('each')}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
