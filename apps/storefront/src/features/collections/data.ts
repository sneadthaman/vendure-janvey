import {cacheLife, cacheTag} from 'next/cache';
import {query} from '@/platform/vendure/api';
import {GetTopCollectionsQuery} from './graphql';

export async function getTopCollections(locale: string) {
    'use cache';
    cacheLife('days');
    cacheTag(`collections-${locale}`);

    const result = await query(GetTopCollectionsQuery, undefined, {languageCode: locale});
    return result.data.collections.items
        .filter(collection => collection.customFields?.showInNavigation !== false)
        .map(collection => ({
            ...collection,
            children:(collection.children||[]).filter(child => child.customFields?.showInNavigation !== false),
        }));
}
