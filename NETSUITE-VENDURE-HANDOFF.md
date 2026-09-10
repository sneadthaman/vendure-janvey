# NetSuite → Vendure Integration — Status & Handoff

Last updated: 2026-09-09

## Context

Exploring Vendure (open-source, TypeScript/NestJS headless commerce) as a
potential custom-built alternative/complement to the existing Axim Commerce
B2B storefront, both integrating with NetSuite as the ERP. This doc covers
the Vendure proof-of-concept only — the Axim/NetSuite integration (DCKAP,
order sync, etc.) is a separate, already-working system and is not affected
by any of this.

Goal of the current phase: prove NetSuite item data (specifically, items
flagged "Display in Web Store") can be pulled into Vendure reliably, before
deciding whether to build this out further.

## Project layout

- Monorepo root: `C:/Users/sjanv/Documents/Developer/vendure/janvey-shop`
  (local, NOT in Dropbox — moved intentionally; Dropbox-synced folders
  caused file-lock and WSL2/Docker I/O problems)
- Actual Vendure server app: `apps/server` (NOT `apps/backend` — the docs
  and early instructions in this thread said `apps/backend`, that was
  wrong; the real folder is `apps/server`)
- Plugin: `apps/server/src/plugins/netsuite-sync/`
  - `netsuite-sync.plugin.ts` — registers `NetsuiteService` as a provider,
    implements `OnApplicationBootstrap`, currently fetches items and
    console.logs count + first item on every server start
  - `services/netsuite.service.ts` — the actual NetSuite client (OAuth 1.0a
    signed requests, pagination). NOTE: there is also a stray *empty* file
    at `apps/server/src/plugins/netsuite-sync/netsuite.service.ts` (not in
    services/) — leave it alone, it's unused, the real one is in
    `services/`.
- Environment: Docker Desktop (WSL2 backend) running local Postgres.
  `.env` lives in `apps/server/.env`, gitignored — if reconstructing on a
  new machine, check for a committed `.env.example` first, then cross-
  reference `vendure-config.ts`'s `process.env.` references for the
  authoritative variable list.
- Local dev quirk: WSL2 can eat a lot of RAM over time. Fixed with a
  `.wslconfig` file in the Windows user folder capping memory (see below,
  not project-specific, just noting it's already been dealt with once).

## NetSuite side

- New RESTlet built specifically for this (kept separate from the
  existing Axim item/history RESTlets, per explicit decision — standard
  fields only, no new custom fields created for this purpose).
- File: `netsuite-web-store-items-restlet.js` (also referred to as
  `vendure-netsuite-web-store-items-restlet.js` in the NetSuite File
  Cabinet — filename in NetSuite may differ slightly from the local copy,
  same content).
- Deployed under the same Role/Integration/Audience as the existing item
  RESTlets, so it reuses the same OAuth 1.0a TBA credentials — no new
  NetSuite integration record or tokens were created.
- Filter: `isonline` (Display in Web Store) = T.
- Search type used: generic `search.Type.ITEM` (spans all item subtypes).
- **Known gotcha (fixed):** `search.create()` mutates the array passed as
  its `columns` option in place, replacing string field names with
  internal Column objects. The original script read row keys from that
  same mutated array, causing every field to collapse into one bad key
  (`"search.Column"`). Fixed by reading field names from the search's own
  `itemSearch.columns` list and calling `result.getValue(column)` /
  `result.getText(column)` with the column object directly, instead of
  re-using the original array. **If this bug ever reappears (all fields
  collapsing to one key), this is the cause.**
- **Fields confirmed NOT available as search columns via generic
  `search.Type.ITEM`** (all threw `SSS_INVALID_SRCH_COL` and were
  removed): `pagetitle`, `metataghtml`, `searchkeywords`. If any of these
  are needed later, the fallback is `record.load()` per item instead of
  search (slower, but can read fields search can't).
- **getValue() vs getText():** `class` and `countryofmanufacture` are
  list/record-type fields in this NetSuite account, so they're read with
  `getText()` to get readable names, not internal IDs. `manufacturer` is
  stored as free text in this account (not a list field) — confirmed by
  testing, `getText()` returned null for it, `getValue()` returns the
  correct string (e.g. "Ossian Inc"). This is account-specific
  configuration, not a NetSuite universal — don't assume it holds if this
  is ever pointed at a different NetSuite account.
- Pagination: supports `limit`/`offset` query params, same convention
  Axim requested on the existing history endpoints.
- Auth debugging note: an `INVALID_LOGIN_ATTEMPT` 401 was hit once and
  turned out to be simply because the NetSuite env vars hadn't been added
  to `.env` yet on a machine — not a code or NetSuite config issue.
  NetSuite's Login Audit Trail (Setup > Users/Roles > View Login Audit
  Trail, Detail column) is the fastest way to get the *real* reason
  behind any future 401, since the API's error response is generic.

### Current confirmed field list (as of last successful test)

Standard fields: `internalid`, `itemid` (→ Axim SKU equivalent),
`displayname`, `salesdescription`, `storedescription`,
`storedetaileddescription`, `urlcomponent`, `featureddescription`,
`weight`, `manufacturer`, `mpn`, `countryofmanufacture`, `upccode`,
`class` (→ intended to map to Vendure product categories)

Custom fields: `custitem_janvey_jm_images`,
`custitem_packship_itm_pack_height`, `custitem_packship_itm_pack_length`,
`custitem_packship_itm_pack_width`, `custitem10` (video link),
`custitem7` (attribute pack size), `custitem9` (literature link),
`custitem8` (SDS link), `custitem_pallet_qqty` (yes, "qqty" typo is
intentional/correct, matches the actual NetSuite field id)

**Not yet verified as working:** the custom fields above were added to
the RESTlet's column list but not yet individually confirmed error-free
one by one the way the standard fields were — worth re-checking the next
full response for any `SSS_INVALID_SRCH_COL` on these before assuming
they're all clean.

Data currently scoped to NetSuite side: only ~100 items are flagged
"Display in Web Store" right now (deliberately trimmed down from 2,178 for
faster testing/iteration — not the final production item set).

## Vendure side

- `netsuite.service.ts` (in `apps/server/src/plugins/netsuite-sync/services/`)
  exports `NetsuiteService` with `fetchWebStoreItems()`, which pages
  through the RESTlet and returns the full combined item list.
- Auth: OAuth 1.0a TBA, HMAC-SHA256, using `oauth-1.0a` + `crypto-js`
  packages. Realm (account ID) appended manually to the Authorization
  header since the `oauth-1.0a` library doesn't handle NetSuite's realm
  convention natively.
- `NetsuiteWebStoreItem` TypeScript interface needs to be updated to match
  the final field list above (currently still reflects an earlier,
  smaller field set as of the last file generated in this thread — this
  is one of the first things to fix in the next session).
- Currently wired into `onApplicationBootstrap()` purely for testing —
  fetches and console.logs on every server start. This is NOT the
  intended long-term trigger mechanism.
- This service has NOT yet been used to create or update any Vendure
  `Product`/`ProductVariant` records. All work so far is fetch + log only.

## Decisions already made (don't re-litigate these)

- Vendure Core (GPLv3, self-hosted, not distributed) chosen over Medusa —
  plugin-first architecture seen as the best fit for wrapping the existing
  NetSuite RESTlet pattern.
- This RESTlet is intentionally separate from Axim's existing item
  RESTlets, but reuses the same NetSuite Role/Integration/OAuth
  credentials.
- No new NetSuite custom fields were created for this — only existing
  standard + existing custom fields are used.
- `class`/`countryofmanufacture` return text names; `manufacturer`
  returns free text (not via getText).
- Codex (in VS Code) has been used as the "worker" for actually editing
  project files, with instructions relayed from this chat. That pattern
  can continue.

## Open decisions for next session

1. **Field mapping into Vendure's data model** — specifically:
   - Does `custitem_janvey_jm_images` become a Vendure product Asset (and
     if so, how — is it a URL, a NetSuite file ID, something else)?
   - Do the three pack-dimension fields (`custitem_packship_itm_pack_*`)
     become Vendure custom fields on Product/ProductVariant, or something
     else?
   - Does `class` map to a Vendure `Collection`? One-to-one, or does class
     hierarchy need to become nested collections?
   - Video/literature/SDS links (`custitem10`/`custitem9`/`custitem8`) —
     custom fields, or a different Vendure construct?
2. **Sync direction/logic** — create-if-missing vs. update-existing, keyed
   on `itemid` (SKU) presumably, matching the "SKU must match NetSuite
   Item Number" rule already established for the Axim integration.
3. **Trigger mechanism** — replace `onApplicationBootstrap` with one of:
   manual admin UI action, custom GraphQL mutation, or scheduled job.
4. Still need to individually verify the custom fields (`custitem10`,
   `custitem7`, `custitem9`, `custitem8`, `custitem_pallet_qqty`, the
   three pack-dimension fields, `custitem_janvey_jm_images`) don't throw
   `SSS_INVALID_SRCH_COL` — not yet confirmed clean.

## Immediate next step

Update `netsuite.service.ts`'s `NetsuiteWebStoreItem` interface to match
the final field list (remove `metataghtml`/`searchkeywords` if still
present, confirm all custom fields are listed), then decide the field
mapping (#1 above) before writing any product-creation logic.
