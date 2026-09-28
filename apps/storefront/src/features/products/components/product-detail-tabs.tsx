'use client';

import {BookOpen, CirclePlay, ExternalLink, FileCheck2, FileText} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';

interface ProductSpecification {
    label: string;
    value: string;
}

interface ProductDetailTabsProps {
    description: string;
    storeDescription?: string | null;
    specifications: ProductSpecification[];
    sdsUrl?: string | null;
    sdsReference?: string | null;
    literatureUrl?: string | null;
    videoUrl?: string | null;
}

function ResourceLink({href, icon: Icon, title, description}: {href: string; icon: typeof FileText; title: string; description: string}) {
    return <a href={href} target="_blank" rel="noreferrer" className="group flex items-start gap-4 rounded-xl border bg-white p-5 transition hover:border-[#ed721c] hover:shadow-sm">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#d65c0e]"><Icon className="size-5"/></span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-bold text-slate-950">{title}<ExternalLink className="size-4 text-slate-400 transition group-hover:text-[#d65c0e]"/></span><span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span></span>
    </a>;
}

export function ProductDetailTabs({description, storeDescription, specifications, sdsUrl, sdsReference, literatureUrl, videoUrl}: ProductDetailTabsProps) {
    const t = useTranslations('Product');
    const hasAdditionalInformation = Boolean(literatureUrl || videoUrl);

    return <section className="border-y bg-white py-12 md:py-16">
        <div className="container mx-auto px-4">
            <Tabs defaultValue="details" className="gap-0">
                <div className="overflow-x-auto border-b">
                    <TabsList variant="line" className="h-auto min-w-max gap-7 p-0 md:gap-10">
                        <TabsTrigger value="details" className="h-12 px-0 text-base font-bold">{t('tabs.details')}</TabsTrigger>
                        <TabsTrigger value="specs" className="h-12 px-0 text-base font-bold">{t('tabs.specs')}</TabsTrigger>
                        <TabsTrigger value="regulatory" className="h-12 px-0 text-base font-bold">{t('tabs.regulatory')}</TabsTrigger>
                        <TabsTrigger value="additional" className="h-12 px-0 text-base font-bold">{t('tabs.additional')}</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="details" className="max-w-4xl py-8 md:py-10">
                    <h2 className="text-2xl font-bold text-slate-950">{t('tabs.detailsHeading')}</h2>
                    {storeDescription && <div className="mt-5 text-lg leading-8 text-slate-700" dangerouslySetInnerHTML={{__html: storeDescription}}/>}
                    {description ? <div className="mt-5 space-y-4 leading-7 text-slate-600 [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-4 [&_strong]:text-slate-900" dangerouslySetInnerHTML={{__html: description}}/> : !storeDescription && <p className="mt-4 text-slate-600">{t('tabs.noDetails')}</p>}
                </TabsContent>

                <TabsContent value="specs" className="max-w-4xl py-8 md:py-10">
                    <h2 className="text-2xl font-bold text-slate-950">{t('tabs.specsHeading')}</h2>
                    {specifications.length ? <dl className="mt-6 overflow-hidden rounded-xl border">{specifications.map((item, index) => <div key={`${item.label}-${index}`} className="grid gap-1 border-b px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(180px,0.45fr)_1fr] sm:gap-6 even:bg-slate-50"><dt className="font-semibold text-slate-700">{item.label}</dt><dd className="text-slate-950">{item.value}</dd></div>)}</dl> : <p className="mt-4 text-slate-600">{t('tabs.noSpecs')}</p>}
                </TabsContent>

                <TabsContent value="regulatory" className="max-w-4xl py-8 md:py-10">
                    <h2 className="text-2xl font-bold text-slate-950">{t('tabs.regulatoryHeading')}</h2>
                    <p className="mt-3 text-slate-600">{t('tabs.regulatoryDescription')}</p>
                    <div className="mt-6">{sdsUrl ? <ResourceLink href={sdsUrl} icon={FileCheck2} title={t('tabs.sdsTitle')} description={t('tabs.sdsDescription')}/> : sdsReference ? <div className="rounded-xl border bg-slate-50 p-6 text-slate-700"><FileCheck2 className="mb-3 size-6 text-[#d65c0e]"/><p className="font-semibold text-slate-950">{t('tabs.sdsAvailable')}</p><p className="mt-2 text-sm leading-6">{t('tabs.sdsReference', {reference: sdsReference})}</p></div> : <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-slate-600"><FileCheck2 className="mb-3 size-6 text-slate-400"/>{t('tabs.noSds')}</div>}</div>
                </TabsContent>

                <TabsContent value="additional" className="max-w-4xl py-8 md:py-10">
                    <h2 className="text-2xl font-bold text-slate-950">{t('tabs.additionalHeading')}</h2>
                    {hasAdditionalInformation ? <div className="mt-6 grid gap-4 md:grid-cols-2">{literatureUrl && <ResourceLink href={literatureUrl} icon={BookOpen} title={t('tabs.literatureTitle')} description={t('tabs.literatureDescription')}/>} {videoUrl && <ResourceLink href={videoUrl} icon={CirclePlay} title={t('tabs.videoTitle')} description={t('tabs.videoDescription')}/>}</div> : <div className="mt-6 rounded-xl border border-dashed bg-slate-50 p-6 text-slate-600"><FileText className="mb-3 size-6 text-slate-400"/>{t('tabs.noAdditional')}</div>}
                </TabsContent>
            </Tabs>
        </div>
    </section>;
}
