/**
 * Shape of a single row returned by the web-store items RESTlet.
 *
 * Every value arrives as a string (or null) because NetSuite search results
 * are stringly-typed — numeric coercion happens in the mapper, not here.
 * Keeping the raw shape honest makes it obvious where parsing is required.
 *
 * Field list matches the RESTlet's column set as of the last confirmed run.
 * `pagetitle`, `metataghtml`, and `searchkeywords` are intentionally absent —
 * they throw SSS_INVALID_SRCH_COL on generic search.Type.ITEM. If any are
 * needed later the fallback is record.load() per item.
 */
export interface NetsuiteWebStoreItem {
  // --- Identity ---------------------------------------------------------
  /** Immutable NetSuite record id. The sync key — maps to Product.customFields.netsuiteInternalId */
  internalid: string;

  /** NetSuite Item Number. Maps to ProductVariant.sku */
  itemid: string;

  /**
   * inventoryitem | noninventoryitem | kititem | assemblyitem | ...
   * Read from result.recordType, not a search column.
   * Used to filter out matrix parents and other non-sellable types.
   */
  recordType: string;

  // --- Content ----------------------------------------------------------
  /** Maps to Product.name (fall back to itemid when null) */
  displayname: string | null;

  /** Maps to Product.slug (slugify displayname when null; needs collision handling) */
  urlcomponent: string | null;

  /** Maps to Product.description */
  storedetaileddescription: string | null;

  /** Maps to Product.customFields.storeDescription */
  storedescription: string | null;

  /** Maps to Product.customFields.salesDescription */
  salesdescription: string | null;

  /** Maps to Product.customFields.featuredDescription */
  featureddescription: string | null;

  // --- Classification (become Facets, not direct Collection assignment) --
  /** getText() — readable name. Private facet, drives Collection filters. */
  class: string | null;

  /** getValue() — free text in this account, NOT a list field. Public facet. */
  manufacturer: string | null;

  // --- Identifiers ------------------------------------------------------
  /** Maps to ProductVariant.customFields.mpn */
  mpn: string | null;

  /** Maps to ProductVariant.customFields.upc */
  upccode: string | null;

  /** getText() — readable country name, not internal id */
  countryofmanufacture: string | null;

  // --- Logistics --------------------------------------------------------
  /** Always pounds in this account — no weightunit normalization needed */
  weight: string | null;

  custitem_packship_itm_pack_length: string | null;
  custitem_packship_itm_pack_width: string | null;
  custitem_packship_itm_pack_height: string | null;

  /** Pallet quantity. The "qqty" spelling matches the real NetSuite field id. */
  custitem_pallet_qqty: string | null;

  /** Pack size display string, e.g. "12/case" */
  custitem7: string | null;

  // --- Media + documents ------------------------------------------------
  /**
   * Opaque File Cabinet token, single value, always resolves to `${token}_01.jpg`.
   * Joined against the image map from the images RESTlet to get an absolute URL.
   */
  custitem_janvey_jm_images: string | null;

  /** SDS link */
  custitem8: string | null;

  /** Literature link */
  custitem9: string | null;

  /** Video link */
  custitem10: string | null;

  // --- Pricing ----------------------------------------------------------
  /**
   * Online Price level, from the `pricing` search join.
   * Decimal string in major units — convert to minor units in the mapper.
   * Null means no Online Price row exists; the product syncs as
   * purchasable: false rather than being priced at zero.
   *
   * NOT YET ADDED to the RESTlet — see notes.
   */
  onlineprice: string | null;
}

/**
 * Response envelope from the web-store items RESTlet.
 */
export interface NetsuiteWebStoreItemsResponse {
  count: number;
  offset: number;
  limit: number;
  total?: number;
  items: NetsuiteWebStoreItem[];
  remainingUsage?: number;
}

/** No plugin options are currently consumed. */
export interface PluginInitOptions {
  accountId?: string;
  consumerKey?: string;
  consumerSecret?: string;
  tokenId?: string;
  tokenSecret?: string;
  itemsUrl?: string;
  pricingUrl?: string;
  imagesUrl?: string;
  customersUrl?: string;
  localImagesPath?: string;
}

export interface NetsuiteCustomerAddress {
  internalId:string|null;
  label:string|null;
  defaultBilling:boolean;
  defaultShipping:boolean;
  addressee:string|null;
  attention:string|null;
  streetLine1:string|null;
  streetLine2:string|null;
  city:string|null;
  province:string|null;
  postalCode:string|null;
  countryCode:string|null;
  phoneNumber:string|null;
}

export interface NetsuiteCustomerContact {
  internalId:string;
  entityId:string|null;
  firstName:string|null;
  lastName:string|null;
  emailAddress:string|null;
  phoneNumber:string|null;
  active:boolean;
}

export interface NetsuiteCustomerCandidate {
  internalId:string;
  entityId:string|null;
  companyName:string|null;
  active:boolean;
}

export interface NetsuiteCustomerSearchResponse {
  success:boolean;
  contractVersion:number;
  candidates:NetsuiteCustomerCandidate[];
  remainingUsage?:number;
}

export interface NetsuiteCustomerResponse {
  success:boolean;
  contractVersion:number;
  customer:{
    internalId:string;
    entityId:string|null;
    companyName:string|null;
    emailAddress:string|null;
    phoneNumber:string|null;
    priceLevelId:string|null;
    priceLevelName:string|null;
    webCustomer:boolean;
    active:boolean;
    taxMetadata:Record<string,{value:unknown;text:unknown}>;
    taxItem:{internalId:string;rateFields?:Record<string,{value:unknown;text:unknown}>;issue?:string}|null;
  };
  addresses:NetsuiteCustomerAddress[];
  contacts:NetsuiteCustomerContact[];
  issues:string[];
  diagnostics?:{
    bodyFields:string[];
    taxFields:string[];
    taxItem?:{internalId:string;rateFields?:Record<string,{value:unknown;text:unknown}>;issue?:string}|null;
    addressbookFields:string[];
    addressFields:string[];
  };
  remainingUsage?:number;
}

/**
 * Response from the images RESTlet: File Cabinet name -> absolute public URL.
 *
 * Fetched once per sync run and held in memory, rather than one file search
 * per item. Keys look like "ungwc25u_01.jpg".
 */
export type NetsuiteImageMap = Record<string, string>;

export interface NetsuiteImageFile {
  name: string;
  url: string;
  internalid: string;
  modified: string;
  size: string;
  availableWithoutLogin: boolean;
  /** Absolute server-local path when importing from an offline File Cabinet export. */
  localPath?: string;
}

export interface NetsuiteImagesResponse {
  success: boolean;
  count: number;
  total: number;
  offset: number;
  limit: number;
  files: NetsuiteImageFile[];
  remainingUsage?: number;
}

export interface NetsuitePrice {
  sku: string;
  internalId: string | null;
  price: number | null;
  basePrice: number | null;
  source: string;
  purchasable: boolean;
}

export interface NetsuitePricesResponse {
  success: boolean;
  message: string;
  currencyCode: string;
  prices: NetsuitePrice[];
  remainingUsage?: number;
}
