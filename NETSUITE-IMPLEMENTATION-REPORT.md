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

## B2B customer accounts and order approval (implemented locally, 2026-09-14)

The current B2B foundation models a NetSuite customer as one shared `netsuite_account` and each human login as one Vendure Customer linked through `netsuite_contact_link`. Staff create, refresh, link, unlink, and configure those relationships in **Customers > NetSuite customers** in the Vendure Dashboard. A link stores the immutable NetSuite customer and contact identities, contact-level `requiresApproval` and `canApproveOrders` flags, and that contact's own default ship-to selection.

Only Customer Master records with `custentity_web_customer` enabled are eligible for web use. Staff use the existing NetSuite Saved Search **Web Customers** (`customsearch_web_customers`, internal ID `2119`) to find the customer internal ID, then paste that ID into the Dashboard import control. Import loads the individual Customer Master record and enforces `custentity_web_customer` directly, so staff cannot bypass the rule by entering an unflagged customer ID. Customer-name searches through NetSuite's `N/search` API returned HTTP 403 for the token-authenticated role despite the configured audience and unrestricted deployment, so the integration deliberately does not depend on that API.

NetSuite account addresses are imported into `netsuite_account_address` with immutable NetSuite address IDs. Linked contacts can choose only one of their account's active ship-to addresses during checkout. The selected address is copied to the Vendure order as its checkout-time snapshot; storefront users cannot edit the NetSuite-managed address fields.

Customer-specific prices are requested by shared NetSuite account ID and kept in a request-context cache key that includes that ID and the requested SKUs. Guests retain the public Online Price. The read-only diagnostic verified the required contract:

| Customer | Item | Customer price | Public base price | Source |
| --- | --- | ---: | ---: | --- |
| NetSuite `725` | `MAJ R04032` / internal ID `5644` | 51,548 cents | 60,139 cents | `customer_specific_item_pricing` |

Approval-required contacts submit a checked-out cart into `PendingApproval`. It cannot move into payment and is not export-eligible. Account approvers receive a login-safe email, can view only their own account's requests, change permitted quantities or lines, change the permitted ship-to, comment, approve, reject, or cancel. Each action is audited with actor, timestamp, comment, and totals. Quantity changes use Vendure's supported `AddingItems` operation inside one protected database transaction, then return to `PendingApproval` after authoritative repricing and tax recalculation. Direct purchasers retain the normal checkout state progression.

The migration `1789131094210-netsuite-b2b-foundation.ts` creates account, address, contact-link, customer-sync-run, approval, and approval-event storage. It preserves existing legacy customer links when upgrading, restores the legacy field on downgrade, and changes existing shipping methods to the address-aware shipping tax calculator.

### B2B live verification

The live local end-to-end workflow completed against the running Vendure API and worker:

- guest catalog price and authenticated account price were kept separate;
- a non-approval contact reached `ArrangingPayment` normally;
- an approval-required contact could not bypass to payment;
- two contacts shared one account with different default ship-to addresses;
- selecting a fixture ship-to on customer `725` copied that address to the order while retaining customer `725`'s authoritative default bill-to address for tax-zone selection;
- a requester submitted an order, an approver modified quantity, the order repriced and recalculated tax, then the approver approved it;
- a second request was rejected with an audited reason;
- self-approval and cross-account access were denied;
- export eligibility was `false` before approval and `true` only after approval, repricing, and tax validation;
- request, approval, and rejection emails were rendered by the Vendure email worker; every configured approver received the request notification;
- the final verified taxable example had 7,315-cent merchandise net / 8,778 gross and 500-cent shipping net / 600 gross, using the account bill-to tax zone.

Backend TypeScript checking, B2B policy and RESTlet contract tests, NetSuite client tests, dashboard/server/worker production build, storefront tests, lint, type checking, upgrade validation, and storefront production build all passed. Local HTTP checks returned 200 for the server health endpoint, dashboard, account approvals page, and checkout page.

### Required NetSuite deployment and tax-parity follow-up

`netsuite/vendure-netsuite-customers-restlet.js` is deployed under the existing token-based authentication integration and configured in the local environment. A live read-only call for customer `725` confirmed contract version 1, 20 stable addresses, 37 contacts, `taxable=true`, and the discovered `taxitem`, `resalenumber`, and `vatregnumber` fields. Staff import then created or refreshed the shared `SACHEM CENTRAL SCHOOLS` account with those 20 active addresses and no linked test contacts. Its active tax item is `28` / `Exempt Suffolk`; this demonstrates why address- and account-specific tax parity must be measured instead of inferred from a fixed rate. Run `node scripts/netsuite-b2b-diagnostic.cjs --verbose` only when the full field-discovery payload is needed.

The Vendure tax-zone strategy now uses the order billing address, not its shipping address. For a linked NetSuite contact, selecting a ship-to sets that fulfillment address and also sets the account's active NetSuite default billing address on the order. This preserves NetSuite as the address authority and applies its bill-to tax basis. Imported exempt accounts continue to receive zero line and shipping tax. Exact NetSuite tax parity is deliberately not claimed yet: it needs one representative web-enabled taxable account and one representative web-enabled exempt account, each with NetSuite totals for the same catalog items and shipping method. Compare those cases with `scripts/netsuite-b2b-diagnostic.cjs` before treating the configuration as production tax parity. If SuiteTax, nexus, tax-code selection, or rounding differs, the next phase should add a read-only NetSuite tax-quote diagnostic rather than guessing at a fixed rate.

The current local Vendure tax data is still scaffold data: its Americas standard rate is 20%. It does not match customer `712`'s NetSuite tax item `5` / Nassau County and must not be treated as tax-parity configuration. The customer RESTlet now includes a diagnostic-only read of the linked `SALES_TAX_ITEM` record and discovers rate-related fields at runtime. Deploy that RESTlet revision, then run `node scripts/netsuite-b2b-diagnostic.cjs 712 "KCC 1804" --verbose` to capture the real rate contract before creating a managed Vendure tax mapping.

The deployed diagnostic confirmed that tax item `5` has a `rate` of 8.625%. The additive `NetsuiteAccountTaxRate` migration is applied, and refreshing customer `712` persisted `taxRate=8.625`. Linked taxable order lines now use the refreshed account rate and shipping copies the line rate; missing or invalid rate data blocks checkout safely. This confirms the tax-item rate contract and bill-to selection, but a web-enabled exempt customer remains necessary for final dual-case parity verification.

Sachem Central Schools (`725`) provides the zero-tax counterpart. NetSuite reports `taxable=T` and tax item `28` / `Exempt Suffolk`, whose authoritative rate is 0.00%. Its exact customer-specific price for item `5644` / `MAJ R04032` remains 51,548 cents against a 60,139-cent base price. The refreshed local approval workflow confirmed a zero-tax order: 7,315-cent merchandise net and gross, plus 500-cent shipping net and gross. The source taxability metadata is retained while its assigned NetSuite tax item determines the effective zero rate.

Prof Maintenance (`712`) provides the taxable counterpart. Its live workflow used `KCC 1804` (NetSuite item `1968`): the guest price was 7,688 cents, the account price was 6,590 cents, and the persisted 8.625% tax item produced a 7,158-cent line gross and 543-cent shipping gross from 500 cents net. The workflow also verified requester submission, approver modification, approval, rejection, notification generation, and export ineligibility before approval.

Two historical NetSuite sales-order PDFs now provide the expected tax outcomes. They are reference evidence, not final live-parity proof, because the PDFs do not include immutable customer or ship-to address IDs:

| Case | NetSuite order | Customer / ship-to | Lines | Merchandise subtotal | Shipping | Tax | Total |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| Taxable | `SO310021` | PROF MAINTENANCE OF LI / PMLI At Mather Hospital | 2 × `SSS 37033` at $69.57 | $139.14 | $0.00 shown | $12.00 at 8.625% | $151.14 |
| Exempt | `SO310066` | NYU LANGONE HOSPITAL / NYU Langone Patchogue ASC | 2 × `KCC 1804` ($53.76), 2 × `BRY 72975` ($75.34) | $129.10 | $0.00 shown | $0.00 | $129.10 |

`KCC 1804` and `BRY 72975` exist in the imported online catalog (NetSuite IDs `1968` and `1351`). `SSS 37033` is not an online-catalog item, so that taxable order cannot be replayed in Vendure as written. Customer `712` (PROF MAINTENANCE OF LI) is web-enabled and was refreshed successfully with six active addresses, including exactly one active default billing address and one default shipping address. A live read-only check returned its `KCC 1804` contract price as 6,590 cents against a 7,688-cent base price, sourced from `customer_price_level`; its NetSuite tax item is `5` / `Nassau County`. Customer `649` (NYU) correctly remains ineligible for import because it is not marked `custentity_web_customer`; it must be marked as a web customer, or another web-enabled exempt customer must be supplied, before its exempt order can be replayed in Vendure. A taxable order containing an online-catalog item would provide the strongest final replay case.

### Customer lifecycle hardening (2026-09-23)

The additive `NetsuiteCustomerEligibility1789500000000` migration records NetSuite account activity, web-customer eligibility, contact-link activity, and the reason an account or contact was suspended. Customer pricing, checkout addresses, tax handling, and approval operations now require both an eligible account and an active contact link. An ineligible account can no longer be selected for a new staff link.

Refreshing an eligible account reconciles contact links that carry an immutable NetSuite contact ID. Removed or inactive contacts are suspended without deleting their Vendure customer or order history and are restored automatically if NetSuite makes them active again. Account-level links without a NetSuite contact ID remain active by design. Refresh also clears a contact's default ship-to when the referenced NetSuite address is no longer active.

The migration was applied locally and both real fixtures were refreshed from the deployed customer RESTlet. Customer `712` remained active and web-enabled with six active addresses; customer `725` remained active and web-enabled with 20 active addresses. Live read-only diagnostics reconfirmed `712` / `KCC 1804` at 6,590 cents against 7,688 cents public and `725` / `MAJ R04032` at 51,548 cents against 60,139 cents public. The server, worker, and Dashboard production build passed, along with nine B2B policy and lifecycle tests.

Imported customer accounts are refreshed by the Vendure scheduler under task ID `netsuite-customer-refresh`. It runs sequentially at 2:00 AM in the server process timezone by default, prevents overlapping runs, and isolates failures so one invalid customer does not stop later accounts. Set `NETSUITE_CUSTOMER_REFRESH_CRON` to override the five-field cron expression. Each attempted account continues to write its normal customer sync report, and the task is visible and manually runnable from Vendure's standard **Settings > Scheduled tasks** page.

The registered task reported its next run at `2026-09-24T06:00:00Z`, which is 2:00 AM Eastern Daylight Time. A manual worker execution attempted exactly the two retained real accounts and completed both with zero failures or skipped records. Six `Outside District` accounts created by earlier workflow tests were audited first: none had orders or approvals. Their test customers and users were deleted through Vendure, then their remaining integration links, synthetic accounts, and cascading addresses were removed in one guarded transaction. The local account inventory now contains only NetSuite customers `712` and `725`.
