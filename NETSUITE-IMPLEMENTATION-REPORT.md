# NetSuite catalog and category implementation report

Date: 2026-09-10

## Current result

The Vendure catalog now imports the complete 99-item NetSuite web catalog and organizes it into a staff-editable Collection hierarchy. A successful full catalog sync refreshes category memberships automatically. Staff can refresh only the category memberships from **Catalog > NetSuite sync > Refresh category memberships** without calling NetSuite again.

Vendure's **Rebuild Search Index** action has a different purpose. It rebuilds Vendure's local search index from the current database. It does not fetch products, prices, images, or classes from NetSuite. Use **Sync full catalog** for NetSuite imports and use **Rebuild Search Index** only when the local search index needs rebuilding.

NetSuite remains read-only. No customer pricing, tax, order, inventory, scheduled-sync, or NetSuite write behavior was added in this phase.

## Catalog model

Each NetSuite item is represented by one Vendure Product and one optionless ProductVariant. Vendure requires the underlying variant because SKU, price, availability, tax category, and order lines belong to ProductVariant. The storefront presents these records as simple products with no variant selector.

Prices remain tax-exclusive in product cards, product pages, the cart, and the pre-checkout order summary. Vendure calculates tax during checkout using the customer's address and tax zone. One NetSuite item has no valid Online Price; its variant is disabled and unavailable rather than being sold for zero.

## Category hierarchy

The exact NetSuite class value is stored as the stable `netsuiteClassKey`. Customer-facing names, slugs, descriptions, parent placement, visibility, and navigation settings remain editable in Vendure. Refreshes update membership filters without overwriting existing presentation changes.

| Parent Collection | Child Collections | Classified products |
| --- | --- | ---: |
| Cleaning Chemicals | Air Care; Cleaners & Polishes; Disinfectants & Sanitizers; Floor Cleaners & Maintenance; Floor Strippers & Finishes; Hand Care | 39 |
| Paper, Liners & Disposables | Bags & Can Liners; Towels, Tissue & Accessories | 36 |
| Cleaning Tools & Supplies | Cleaning Tools; Floor Pads & Abrasives; Mops & Accessories | 10 |
| Equipment & Material Handling | Battery Equipment; Corded Equipment; Carts & Trucks | 10 |
| Ice & Winter Care | Ice Melt | 3 |
| Office Supplies | Office Supplies | 1 |

The six counts total 99 products. Public storefront search returns 98 because the single unpriced variant is disabled.

If NetSuite introduces a class that is not in the 16-class mapping, refresh creates a private child Collection under **Needs Classification**. The sync run reports it in `categoriesPendingReview` and its issue list. A staff member can edit and move that Collection in Vendure; later membership refreshes preserve that placement. Once it has been moved out of **Needs Classification**, it is no longer reported as pending review.

The migration `1789061000000-netsuite-collections.ts` adds two Collection custom fields:

- `netsuiteClassKey`: private, read-only through the API, nullable, and unique. It binds a Collection to an exact NetSuite class or an internal managed key.
- `showInNavigation`: public boolean used by the storefront to decide whether a Collection appears in navigation.

The migration was reviewed and applied to local PostgreSQL with schema synchronization still disabled.

## Featured Products and demo data

**Featured Products** is a public Collection with `showInNavigation=false`. It was initially seeded from NetSuite IDs `1654`, `11813`, `1351`, `1970`, `2433`, `5284`, `5909`, and `4149`. Sync does not rewrite an existing Featured Products filter, so staff can add, remove, or reorder products in Vendure without losing those changes.

The nine demo Collection branches are private and hidden from navigation. All 54 demo products are disabled. They were retained in the database and were not deleted.

The homepage carousel now reads `featured-products`; it no longer depends on the demo Electronics Collection.

## Storefront behavior

The storefront queries only top-level Collections marked for navigation and filters hidden children as well.

- Desktop navigation displays the six parents as dropdowns with a parent-page link and child links.
- Mobile navigation displays the six parents as accordions with the same destinations.
- The footer lists the six visible parents.
- A parent Collection page displays links to its children above its combined product results.
- Featured Products stays off the navigation while remaining available to the homepage carousel.

The generated gql.tada schema now points to the local Shop API so the new public Collection field is represented in `graphql-env.d.ts`. The storefront upgrade note is in `.upgrades/changes/add-netsuite-category-navigation.md`.

## Sync implementation

The category definitions live in `apps/server/src/plugins/netsuite-sync/collection-taxonomy.ts`. `NetsuiteCollectionService` performs an idempotent refresh:

1. Ensure the six managed parents and the private Needs Classification Collection exist.
2. Match the current `netsuite-class` FacetValues to the 16 stable class keys.
3. Create missing leaf Collections and refresh their facet filters.
4. Derive each managed parent's combined filter from the leaves currently placed beneath it.
5. Report products with no NetSuite class and unknown classes still awaiting review.
6. Ensure Featured Products exists without changing it after creation.
7. Keep demo Collections hidden and demo products disabled.
8. Queue Vendure Collection-filter recalculation.

The full catalog worker runs this refresh after item reconciliation. The SuperAdmin-only `refreshNetsuiteCollections` mutation provides the dashboard's category-only action and rejects the request while a catalog sync is active.

Sync runs record `collectionsCreated`, `collectionsRefreshed`, `categoriesPendingReview`, `unclassifiedProducts`, `categoryFailures`, and `demoProductsDisabled` alongside the existing product and image counters.

## Live verification

Full sync run 9 completed against the deployed NetSuite RESTlets:

- 99 fetched, processed, and updated
- 0 failed, skipped, created, or disabled during reconciliation
- missing-product reconciliation performed
- 22 managed membership filters refreshed: 16 leaves and 6 parents
- 0 unknown classes pending review
- 0 unclassified products
- 0 category failures
- 68 existing product images reused
- 4 nonfatal source-image warnings; prior images were retained where available

The database audit after run 9 reported:

- 99 NetSuite products and 99 variants
- 98 enabled variants and 1 disabled/unpurchasable variant
- 16 NetSuite class values and 16 class Collections
- parent membership counts of 39, 36, 10, 10, 3, and 1
- 1 Featured Products Collection with 8 members
- 1 private Needs Classification Collection with 0 members
- 54 demo products, 0 enabled

One Vendure search-index rebuild completed successfully. Shop API verification returned the expected parent and leaf counts, eight featured items, 98 searchable products, and zero results for the demo product search `Laptop`.

Headless Chrome verified the live local applications:

- six desktop parent dropdowns and the Cleaning Chemicals children
- six mobile category accordions and an expanded Cleaning Chemicals section
- six child links and 39 product results on the Cleaning Chemicals parent page
- eight NetSuite products in the homepage Featured Products carousel
- all six parent links in the footer
- NetSuite products, imported images, and tax-exclusive prices in storefront search and product views
- the authenticated dashboard category-refresh control and run 9 category counters

Screenshots are stored locally under `.local/` and intentionally ignored by Git:

- `.local/storefront-categories-desktop.png`
- `.local/storefront-categories-mobile.png`
- `.local/storefront-category-parent.png`
- `.local/netsuite-dashboard.png`

## Automated verification

All final checks passed:

- 27 NetSuite mapper, client, asset, RESTlet, sync, and taxonomy tests
- 23 storefront architecture and upgrade-protocol tests
- storefront ESLint
- storefront Next.js route generation and TypeScript check
- storefront upgrade metadata validation
- backend dashboard/server/worker production build
- storefront Next.js production build, including 57 generated pages
- Git whitespace validation

## Known limitations

Production image refresh still depends on a local File Cabinet export because the token-authenticated NetSuite role cannot enumerate the discontinued SuiteCommerce Web Hosting Files tree. The local archive supplies 68 product images. Two requested image names are absent and two `.jpg` files contain invalid JPEG data, producing the four nonfatal warnings in run 9.

The sync remains manual by design. Customer-specific pricing, customer tax data, inventory, order submission, and a schedule are future phases.
