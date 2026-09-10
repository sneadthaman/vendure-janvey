# NetSuite brief review: handoff to Claude

Date: 2026-09-09

## Purpose and scope

Codex reviewed `apps/server/src/plugins/netsuite-sync/CODEX-BRIEF.md` against the current workspace. This report records discrepancies to resolve before implementing the mapper. No implementation changes were made during this review; only this report was created. No new build or live RESTlet request was run for this review.

Repository root: `C:/Users/sjanv/Documents/Developer/vendure/janvey-shop`.
All paths below are relative to that root. The backend is `apps/server`, not `apps/backend`.

## Findings

### 1. The root service is no longer empty

The brief instructs deletion of `apps/server/src/plugins/netsuite-sync/netsuite.service.ts` only after verifying that it is empty and unreferenced. It is currently 3,918 bytes and contains a complete OAuth/HTTP client plus an expanded item interface.

The plugin imports `./services/netsuite.service`, so the active client remains `apps/server/src/plugins/netsuite-sync/services/netsuite.service.ts`. That client still declares the original seven-field item interface locally.

The root copy adds descriptive, classification, logistics, media, and document fields. These are substantive user edits, not an empty placeholder. Do not delete this file based on the brief's stale description. Reconcile its additions with shared types and the active client first, then explicitly resolve what should happen to the duplicate.

### 2. Shared types and constants already exist

`apps/server/src/plugins/netsuite-sync/types.ts` already contains the expanded item interface, item response envelope, image map, image file, and image response types. Extend or reconcile this file rather than replacing it blindly.

`apps/server/src/plugins/netsuite-sync/constants.ts` already exports:

```ts
export const NETSUITE_SYNC_PLUGIN_OPTIONS = Symbol('NETSUITE_SYNC_PLUGIN_OPTIONS');
export const loggerCtx = 'NetsuiteSyncPlugin';
```

The brief labels both files as NEW, which is outdated. A job queue name is not currently defined; the orchestrator remains outside the current task.

### 3. PluginInitOptions is missing from the updated types

`netsuite-sync.plugin.ts` still imports `PluginInitOptions` from `./types` and uses it for `static options` and `static init(options)`.

The current `types.ts` no longer exports that interface. This is a source-level inconsistency expected to cause a TypeScript missing-export error. A fresh compiler run was not performed during this review, so earlier successful builds do not validate these latest edits.

Resolve the options contract deliberately: restore the required interface or revise the plugin/options provider consistently. Do not remove unrelated plugin initialization behavior incidentally.

### 4. Nullability and response envelopes disagree

The brief says all NetSuite response fields are `string | null`. In shared `types.ts`, `internalid`, `itemid`, and `recordType` are non-nullable strings. Both service-local interfaces also use non-nullable strings.

Agree whether identity fields are guaranteed by the RESTlet or must be validated/rejected by the mapper. Missing identity must not silently produce a sync key, SKU, or duplicate product.

The shared item response envelope is:

```ts
{
    success: boolean;
    message: string;
    items: NetsuiteWebStoreItem[];
    hasMore: boolean;
    remainingUsage?: number;
}
```

Both HTTP clients instead declare `count`, `offset`, `limit`, and `items`, and terminate pagination when `items.length < 100`. They do not consume `hasMore`.

Confirm the deployed RESTlet's actual envelope and pagination contract before unifying these types. In particular, a short page must not terminate retrieval if the RESTlet can return `hasMore: true`. This review did not establish whether that occurs in the deployed script.

### 5. Supplied custom fields are not registered

`apps/server/src/custom-fields.ts` exists and exports `customFields`. However, `apps/server/src/vendure-config.ts` still has:

```ts
customFields: {},
```

The supplied definitions have not yet been connected to Vendure configuration. Follow the brief's import-and-spread instruction when implementing this step.

The backend currently has `dbConnectionOptions.synchronize: false`. Registering persistent custom fields also requires considering the database migration; a configuration edit alone does not add database columns. The brief's target structure does not list migration files, so clarify migration scope before creating an unlisted file. Do not enable schema synchronization as a workaround.

### 6. Bootstrap behavior is still test scaffolding

The plugin currently fetches and logs items inline from `onApplicationBootstrap()`, without the `NETSUITE_SYNC_ON_BOOT` gate, and uses `console.log`/`console.error`. The clients use NestJS Logger and their own local logger context.

These differ from the brief's intended shared Vendure Logger convention and queued long-running sync. Do not interpret them as authorization to build the orchestrator now: the brief explicitly defers that work until the mapper's output shape is agreed.

## Decisions requested from Claude

1. Reconcile the populated root service with the active `services/` client and approve the duplicate's disposition.
2. Restore or revise `PluginInitOptions` consistently with the plugin's current registration.
3. Settle raw identity-field nullability and the real response/pagination contract.
4. Confirm the mapper's create/update output shape, including how absent price and `syncLocked` are represented.
5. Include a migration plan for the supplied custom fields and clarify authorization for any files outside the brief's target structure.

## Constraints to preserve

- Sync identity is `netsuiteInternalId`, never SKU; one Product has one ProductVariant.
- Parse decimal prices once into integer minor units. Null price means not purchasable, never an implicit zero price.
- Keep the mapper pure: no DI, database, HTTP, or RequestContext.
- Class and manufacturer become facets; no direct Collection assignments.
- Honor `syncLocked`; disable absent synced products rather than deleting them.
- Import images using the supplied File Cabinet URLs; do not invent hashes or field IDs.
- Do not modify `.env`, add dependencies, or touch production NetSuite/Axim records.
- Do not implement `netsuite-sync.service.ts` yet.

## Workspace caution

The workspace already contains uncommitted startup fixes and user-authored NetSuite changes. Preserve them. Older handoff documents describing the root service as empty, or reporting unresolved authentication, are historical and must not override the current files or live user instructions.
