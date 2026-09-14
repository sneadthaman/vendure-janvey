import { CustomFields, LanguageCode } from '@vendure/core';

/**
 * Custom field definitions for the NetSuite sync.
 *
 * Import into vendure-config.ts:
 *
 *   import { customFields } from './custom-fields';
 *   export const config: VendureConfig = {
 *     ...
 *     customFields,
 *   };
 *
 * NOTES
 *
 * - Fields marked `readonly: true` are owned by the sync. The admin UI shows
 *   them but won't let anyone edit them, which prevents a merchandiser from
 *   making a change that the next sync silently reverts.
 *
 * - Descriptive text fields are NOT readonly, because merchandising them is
 *   the point. See `syncLocked` below for how that interacts with the sync.
 *
 * - Plain `string`/`text` used rather than `localeString`/`localeText`
 *   throughout. Single-language catalog, and it keeps the sync code from
 *   having to build translation arrays. If this ever goes multilingual,
 *   these become localeString/localeText and the sync writes translations.
 *
 * - Facets (manufacturer, NetSuite class) are NOT defined here. Facets and
 *   FacetValues are database records, not config — the sync creates them via
 *   FacetService/FacetValueService on first encounter.
 */
export const customFields: CustomFields = {

  Collection: [
    {
      name: 'netsuiteClassKey',
      type: 'string',
      nullable: true,
      unique: true,
      readonly: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'NetSuite Category Key' }],
      ui: { tab: 'NetSuite' },
    },
    {
      name: 'showInNavigation',
      type: 'boolean',
      defaultValue: true,
      nullable: false,
      public: true,
      label: [{ languageCode: LanguageCode.en, value: 'Show in navigation' }],
      ui: { tab: 'Navigation' },
    },
  ],

  // -------------------------------------------------------------------
  // Product
  // -------------------------------------------------------------------
  Product: [
    {
      name: 'netsuiteInternalId',
      type: 'string',
      nullable: true,
      unique: true,
      readonly: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'NetSuite Internal ID' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'Immutable NetSuite record ID. This is the sync key — never the SKU, ' +
               'because item numbers can be renamed in NetSuite.'
      }],
      ui: { tab: 'NetSuite' },
    },
    {
      name: 'netsuiteLastSyncedAt',
      type: 'datetime',
      nullable: true,
      readonly: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'Last Synced' }],
      ui: { tab: 'NetSuite' },
    },
    {
      // When true, the sync updates identity/logistics fields but leaves
      // name, slug, and all descriptive copy alone. Set this on any product
      // that has been hand-merchandised so NetSuite can't overwrite the work.
      name: 'syncLocked',
      type: 'boolean',
      defaultValue: false,
      nullable: false,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'Lock content from sync' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'Prevents the NetSuite sync from overwriting name, slug, and ' +
               'description fields on this product.'
      }],
      ui: { tab: 'NetSuite' },
    },

    // --- Descriptive copy -------------------------------------------------
    // Product.description (built-in) receives storedetaileddescription.
    // These three carry the rest of NetSuite's description fields.
    {
      name: 'salesDescription',
      type: 'text',
      nullable: true,
      label: [{ languageCode: LanguageCode.en, value: 'Sales Description' }],
      ui: { tab: 'Content' },
    },
    {
      name: 'storeDescription',
      type: 'text',
      nullable: true,
      label: [{ languageCode: LanguageCode.en, value: 'Short Description' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'Teaser copy for listing tiles and search results.'
      }],
      ui: { tab: 'Content' },
    },
    {
      name: 'featuredDescription',
      type: 'text',
      nullable: true,
      label: [{ languageCode: LanguageCode.en, value: 'Featured Description' }],
      ui: { tab: 'Content' },
    },

    // --- Document + media links ------------------------------------------
    {
      name: 'sdsUrl',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.en, value: 'SDS Link' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'Safety Data Sheet. Surface this prominently — it is a ' +
               'compliance document, not marketing collateral.'
      }],
      ui: { tab: 'Documents' },
    },
    {
      name: 'literatureUrl',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.en, value: 'Literature Link' }],
      ui: { tab: 'Documents' },
    },
    {
      name: 'videoUrl',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.en, value: 'Video Link' }],
      ui: { tab: 'Documents' },
    },

    // --- Merchandising ----------------------------------------------------
    {
      // Global sort weight, higher floats to the top. NOT per-collection —
      // see the caveat in the accompanying notes. Use for "push these brands"
      // ordering across the catalog.
      name: 'featuredRank',
      type: 'int',
      defaultValue: 0,
      nullable: false,
      label: [{ languageCode: LanguageCode.en, value: 'Featured Rank' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'Higher values sort first. 0 is the default. Applies globally, ' +
               'not per collection.'
      }],
      ui: { tab: 'Merchandising' },
    },
  ],

  // -------------------------------------------------------------------
  // ProductVariant
  // -------------------------------------------------------------------
  // 1 Product : 1 ProductVariant. `sku` (built-in) receives NetSuite itemid.
  ProductVariant: [
    {
      name: 'netsuiteInternalId',
      type: 'string',
      nullable: true,
      readonly: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'NetSuite Internal ID' }],
      ui: { tab: 'NetSuite' },
    },
    {
      name: 'netsuiteRecordType',
      type: 'string',
      nullable: true,
      readonly: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'NetSuite Record Type' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'inventoryitem, noninventoryitem, kititem, assemblyitem, etc. ' +
               'Kept so matrix parents and non-sellable types can be filtered.'
      }],
      ui: { tab: 'NetSuite' },
    },

    // --- Identifiers ------------------------------------------------------
    {
      name: 'mpn',
      type: 'string',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'MPN' }],
      ui: { tab: 'Identifiers' },
    },
    {
      name: 'upc',
      type: 'string',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'UPC' }],
      ui: { tab: 'Identifiers' },
    },
    {
      name: 'countryOfManufacture',
      type: 'string',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Country of Manufacture' }],
      ui: { tab: 'Identifiers' },
    },

    // --- Logistics --------------------------------------------------------
    // CONFIRM UNITS before writing the sync. NetSuite `weight` respects the
    // item's weight unit (lb/oz/kg/g) — pull `weightunit` into the RESTlet
    // and normalize, or these numbers will be inconsistent across items.
    {
      name: 'weight',
      type: 'float',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Weight (lb)' }],
      ui: { tab: 'Logistics' },
    },
    {
      name: 'packLength',
      type: 'float',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Pack Length (in)' }],
      ui: { tab: 'Logistics' },
    },
    {
      name: 'packWidth',
      type: 'float',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Pack Width (in)' }],
      ui: { tab: 'Logistics' },
    },
    {
      name: 'packHeight',
      type: 'float',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Pack Height (in)' }],
      ui: { tab: 'Logistics' },
    },
    {
      name: 'palletQuantity',
      type: 'int',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Pallet Quantity' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'From custitem_pallet_qqty. Used for LTL freight math.'
      }],
      ui: { tab: 'Logistics' },
    },
    {
      name: 'packSize',
      type: 'string',
      nullable: true,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Pack Size' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'From custitem7. Display string, e.g. "12/case".'
      }],
      ui: { tab: 'Logistics' },
    },

    // --- Pricing ----------------------------------------------------------
    {
      // The built-in `price` holds the Online Price base, synced from NetSuite.
      // Real prices come live from the pricing RESTlet per logged-in customer.
      // This flag lets the storefront hide or block items NetSuite says are
      // unpriced, rather than showing them at $0.
      name: 'purchasable',
      type: 'boolean',
      defaultValue: true,
      nullable: false,
      readonly: true,
      label: [{ languageCode: LanguageCode.en, value: 'Purchasable' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'False when NetSuite returned no price. Never let a null price ' +
               'coerce to zero.'
      }],
      ui: { tab: 'NetSuite' },
    },
  ],

  // -------------------------------------------------------------------
  // Asset
  // -------------------------------------------------------------------
  Asset: [
    {
      name: 'netsuiteSourceFingerprint',
      type: 'string',
      nullable: true,
      readonly: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'NetSuite source version' }],
      ui: { tab: 'NetSuite' },
    },
    {
      name: 'netsuiteFileName',
      type: 'string',
      nullable: true,
      unique: true,
      readonly: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'NetSuite File Name' }],
      description: [{
        languageCode: LanguageCode.en,
        value: 'e.g. "ungwc25u_01.jpg". Makes image import idempotent — if an ' +
               'Asset with this name exists, skip the download.'
      }],
      ui: { tab: 'NetSuite' },
    },
  ],
};
