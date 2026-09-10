import { NetsuiteWebStoreItem } from './types';

export type MapSkipReason = 'missing_internalid' | 'missing_itemid' | 'missing_recordtype';

export interface MappedItem {
    netsuiteInternalId: string;
    sku: string;
    recordType: string;
    imageToken: string | null;
    facets: { manufacturer: string | null; netsuiteClass: string | null };
    identity: {
        price: number;
        enabled: boolean;
        customFields: {
            netsuiteInternalId: string;
            netsuiteRecordType: string;
            purchasable: boolean;
            mpn: string | null;
            upc: string | null;
            countryOfManufacture: string | null;
            weight: number | null;
            packLength: number | null;
            packWidth: number | null;
            packHeight: number | null;
            palletQuantity: number | null;
            packSize: string | null;
        };
    };
    content: {
        name: string;
        slug: string;
        description: string;
        customFields: {
            salesDescription: string | null;
            storeDescription: string | null;
            featuredDescription: string | null;
            sdsUrl: string | null;
            literatureUrl: string | null;
            videoUrl: string | null;
        };
    };
}

export type MapOutcome =
    | { ok: true; item: MappedItem }
    | { ok: false; reason: MapSkipReason; raw: NetsuiteWebStoreItem };

function text(value: unknown): string | null {
    return typeof value === 'string' ? value.trim() || null : null;
}

/** Reject malformed, negative and fractional-cent prices; never round money. */
export function priceInCents(value: unknown): number | null {
    const price = text(value);
    if (!price || !/^\d+(?:\.\d{1,2})?$/.test(price)) return null;
    const [whole, fraction = ''] = price.split('.');
    const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
    // Vendure's default Money strategy stores a signed 32-bit integer.
    return cents <= BigInt(2147483647) ? Number(cents) : null;
}

function measurement(value: unknown, integer = false): number | null {
    const raw = text(value);
    if (!raw || !/^\d+(?:\.\d+)?$/.test(raw)) return null;
    const result = Number(raw);
    if (!Number.isFinite(result) || (integer && (!Number.isSafeInteger(result) || result > 2147483647))) return null;
    return result;
}

export function mapItem(raw: NetsuiteWebStoreItem): MapOutcome {
    const id = text(raw.internalid);
    if (!id) return {ok: false, reason: 'missing_internalid', raw};
    const sku = text(raw.itemid);
    if (!sku) return {ok: false, reason: 'missing_itemid', raw};
    const recordType = text(raw.recordType);
    if (!recordType) return {ok: false, reason: 'missing_recordtype', raw};
    const name = text(raw.displayname) || sku;
    const slugBase = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
    const cents = priceInCents(raw.onlineprice);
    return {ok: true, item: {
        netsuiteInternalId: id, sku, recordType,
        imageToken: text(raw.custitem_janvey_jm_images),
        facets: {manufacturer: text(raw.manufacturer), netsuiteClass: text(raw.class)},
        identity: {
            // Zero is a schema placeholder only. Unpriced variants MUST remain
            // disabled and unpurchasable when the orchestrator writes them.
            price: cents ?? 0,
            enabled: cents !== null,
            customFields: {
                netsuiteInternalId: id, netsuiteRecordType: recordType,
                purchasable: cents !== null,
                mpn: text(raw.mpn), upc: text(raw.upccode),
                countryOfManufacture: text(raw.countryofmanufacture),
                weight: measurement(raw.weight),
                packLength: measurement(raw.custitem_packship_itm_pack_length),
                packWidth: measurement(raw.custitem_packship_itm_pack_width),
                packHeight: measurement(raw.custitem_packship_itm_pack_height),
                palletQuantity: measurement(raw.custitem_pallet_qqty, true),
                packSize: text(raw.custitem7),
            },
        },
        // The future orchestrator must omit this entire block for syncLocked products.
        content: {
            name, slug: text(raw.urlcomponent) || `${slugBase}-${id}`,
            description: text(raw.storedetaileddescription) || '',
            customFields: {
                salesDescription: text(raw.salesdescription), storeDescription: text(raw.storedescription),
                featuredDescription: text(raw.featureddescription),
                sdsUrl: text(raw.custitem8), literatureUrl: text(raw.custitem9), videoUrl: text(raw.custitem10),
            },
        },
    }};
}

export function mapItems(raw: NetsuiteWebStoreItem[]): {
    mapped: MappedItem[];
    skipped: Array<{reason: MapSkipReason; raw: NetsuiteWebStoreItem}>;
} {
    const mapped: MappedItem[] = [];
    const skipped: Array<{reason: MapSkipReason; raw: NetsuiteWebStoreItem}> = [];
    for (const row of raw) {
        const outcome = mapItem(row);
        if (outcome.ok) mapped.push(outcome.item);
        else skipped.push({reason: outcome.reason, raw: outcome.raw});
    }
    return {mapped, skipped};
}
