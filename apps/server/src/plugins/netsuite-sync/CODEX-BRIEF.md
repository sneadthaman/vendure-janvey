# Codex Brief — netsuite-sync plugin

## Current implementation note (2026-09-09)

The user has asked Codex to take over technical direction. The sections below
are historical design context where they conflict with this update:

- The populated duplicate root client has been reconciled and deleted. The
  only client is `services/netsuite.service.ts`, importing shared root types.
- Identity fields remain non-nullable in the type contract but are validated
  at runtime. The mapper returns typed outcomes and never logs.
- The live item envelope was verified as count/offset/limit/items. It does
  not currently include recordType or onlineprice. The local RESTlet now
  includes result.recordType and needs deployment before a live mapping run.
- The mapper returns separate identity/content blocks. An absent or invalid
  price produces a schema placeholder of zero AND enabled=false AND
  purchasable=false. A valid explicit zero price remains distinct.
- Supplied custom fields are registered, and the generated additive migration
  was reviewed and applied to local PostgreSQL with synchronize still false.
- The mapper intentionally awaits its orchestrator; it is imported by tests
  only. Migration files are discovered by path. Config imports the custom
  fields; neither must be imported from the plugin itself.
- No orchestrator or asset importer has been created. Existing bootstrap
  fetch/log scaffolding remains unchanged for now.

See `NETSUITE-IMPLEMENTATION-REPORT.md` at the repository root for verification
and remaining work. Do not apply the stale empty-file or null-price wording
below over these decisions.

Read this before touching anything in `apps/server/src/plugins/netsuite-sync/`.
It defines the target structure, the decisions that are already settled, and
the traps in this codebase. Instructions in this session come from the user,
relayed from a planning thread — if something here contradicts a live
instruction, say so rather than silently picking one.

---

## Ground rules

- **Ask before creating a file not listed under "Target structure" below.**
  The structure is deliberate, not incidental.
- **Do not refactor `netsuite.service.ts` beyond what is asked.** It works.
  It is a dumb HTTP client and must stay one.
- **Do not add npm dependencies without asking.** OAuth is already handled by
  `oauth-1.0a` + `crypto-js`.
- **Do not invent NetSuite field ids.** Every field id in this project has
  been verified against the live account. If you need one that is not in
  `types.ts`, stop and ask.
- **Do not touch `.env`** or commit anything containing credentials.
- If a NetSuite behavior seems wrong, say so — do not code around it silently.
  Several things in this account are non-standard and are documented below.

---

## Context

Vendure (TypeScript/NestJS headless commerce) B2B storefront, syncing product
data from NetSuite via custom RESTlets. This is a proof-of-concept being
evaluated against an existing Axim Commerce storefront. The Axim/NetSuite
integration is a **separate, already-working production system** — nothing in
this repo affects it, and no NetSuite record used by Axim may be modified.

Monorepo root: `C:/Users/sjanv/Documents/Developer/vendure/janvey-shop`
Server app: `apps/server` — **not** `apps/backend`. Older notes say
`apps/backend`; they are wrong.

---

## Target structure

```
apps/server/src/plugins/netsuite-sync/
├── netsuite-sync.plugin.ts         # exists — registers providers, bootstrap
├── types.ts                        # NEW — all shared interfaces
├── constants.ts                    # NEW — loggerCtx, job queue name, tokens
├── netsuite.mapper.ts              # NEW — pure functions, NO DI
└── services/
    ├── netsuite.service.ts         # exists — RESTlet HTTP client
    ├── netsuite-asset.service.ts   # NEW — image map + Asset import
    └── netsuite-sync.service.ts    # NEW — orchestrator
```

**There is a stray empty `netsuite.service.ts` at the plugin root** (not in
`services/`). Delete it. The real one is `services/netsuite.service.ts`.
Verify it is empty and unreferenced before deleting.

### Why the mapper is not a service

`netsuite.mapper.ts` exports plain functions: `NetsuiteWebStoreItem` in,
Vendure create/update input out. No `@Injectable()`, no constructor injection,
no database access, no `RequestContext`. It is the only unit-testable piece in
the plugin and it must stay that way. If you find yourself needing a service
inside the mapper, the logic belongs in the orchestrator instead.

### Separation of concerns

| File | Owns | Must not |
|---|---|---|
| `netsuite.service.ts` | HTTP + OAuth + pagination against RESTlets | Know about Vendure entities |
| `netsuite.mapper.ts` | Field translation, parsing, null handling | Touch DB or DI |
| `netsuite-asset.service.ts` | Image download, `AssetService` import | Create Products |
| `netsuite-sync.service.ts` | Orchestration, facets, upsert, reconciliation | Do HTTP directly |

---

## Settled decisions — do not re-litigate

1. **Sync key is `netsuiteInternalId`, never SKU.** Item numbers can be
   renamed in NetSuite; internal ids cannot. Keying on SKU silently creates
   duplicates and orphans.
2. **1 Product : 1 ProductVariant.** NetSuite items are flat.
3. **Prices are integer minor units (cents) end to end.** Never floats.
   NetSuite returns decimal strings; convert once in the mapper.
4. **A null price means not purchasable.** It must never coerce to `0`.
   Set `purchasable: false` and let the storefront hide or block it.
5. **`class` and `manufacturer` become Facets, not direct Collection
   assignment.** The navigation tree is hand-built by a merchandiser;
   Collections use facet-value filters so membership self-maintains.
   Do not write code that assigns products to Collections directly.
6. **Un-flagged items are disabled, never deleted.** The reconciliation pass
   sets `enabled = false` on any Vendure product whose `netsuiteInternalId`
   is absent from the current fetch.
7. **`syncLocked` is honored.** When true on a Product, the sync updates
   identity and logistics fields but leaves `name`, `slug`, `description`,
   and all descriptive custom fields untouched.
8. **Images are imported, not hotlinked.** Download once via
   `AssetService`, key idempotency on `Asset.customFields.netsuiteFileName`.
9. **Weight is always pounds** in this account. No unit normalization.

---

## Known traps

**`search.create()` mutates its `columns` array in place**, replacing string
field names with Column objects. Reading row keys from the original array
collapses every field into one bad key (`"search.Column"`). Read field names
from the search's own `.columns` list instead. If all fields collapse to one
key, this is why.

**`getValue()` vs `getText()`** — account-specific:
- `class`, `countryofmanufacture` → list fields, use `getText()`
- `manufacturer` → free text in this account, `getText()` returns null,
  use `getValue()`

**These fields do not exist as search columns** on generic `search.Type.ITEM`
and throw `SSS_INVALID_SRCH_COL`: `pagetitle`, `metataghtml`,
`searchkeywords`. They are intentionally absent from `types.ts`.

**The `pricing` search join is an inner join.** Items with no price row vanish
from results entirely. Use a left join or you will silently lose products
instead of seeing them as unpriced.

**`custitem_pallet_qqty`** — the doubled "q" is correct and matches the real
NetSuite field id. Do not "fix" it.

**Image tokens** are opaque and always resolve to `${token}_01.jpg`. The
public URL's `h=` hash is **not derivable** — it must come from the `url`
column of a File Cabinet search. Do not attempt to construct these URLs.

**401 `INVALID_LOGIN_ATTEMPT`** is generic and usually means missing `.env`
vars, not a code problem. The real reason is in NetSuite's Login Audit Trail.

---

## Conventions

- TypeScript strict mode. No `any` in exported signatures.
- All NetSuite response fields are `string | null` — coerce in the mapper,
  never trust a field to be present.
- Log through Vendure's `Logger` with a shared `loggerCtx` from
  `constants.ts`, not `console.log`.
- Long-running sync work goes through `JobQueueService`, chunked. Do not run
  a 2,178-item sync inline in a mutation or on bootstrap.
- The existing `onApplicationBootstrap` fetch-and-log is **temporary test
  scaffolding**. When replacing it, gate any bootstrap trigger behind
  `process.env.NETSUITE_SYNC_ON_BOOT === 'true'`.

---

## Current task

1. Add `types.ts` and `constants.ts` at plugin root.
2. Delete the stray empty root-level `netsuite.service.ts`.
3. Add the custom field definitions to `vendure-config.ts` (provided
   separately as `custom-fields.ts` — import and spread, do not inline).
4. Write `netsuite.mapper.ts`. Pure functions only. Start here — nothing
   downstream can be written correctly until its output shape is settled.

Do not write `netsuite-sync.service.ts` yet. The orchestrator depends on the
mapper's shape being agreed first.
