# Production operations

This runbook defines the provider-independent deployment and recovery contract for Janvey Shop.
Choose a hosting provider only after it can meet every persistence and process requirement below.

## Runtime topology

Deploy the following from one tested Git revision:

1. Vendure API from `node apps/server/dist/index.js`.
2. Vendure worker from `node apps/server/dist/index-worker.js`.
3. Next.js storefront from the `apps/storefront` production build.
4. PostgreSQL with automated backups and point-in-time recovery where available.
5. Durable filesystem or object storage mounted at `ASSET_UPLOAD_DIR`.

The API and worker use the same backend image. Build it from the repository root:

```shell
docker build -f apps/server/Dockerfile -t janvey-shop-server:<git-sha> .
```

The image starts the API by default. Override its command for the worker:

```shell
node apps/server/dist/index-worker.js
```

Expose the API port configured by `PORT` or `VENDURE_SERVER_PORT` and the worker health port configured
by `VENDURE_WORKER_HEALTH_PORT` (default `3020`). Do not expose the worker health port publicly.

## Health checks and deployment order

- `GET /health` proves that the API process is alive.
- `GET /ready` runs `SELECT 1` and returns success only when PostgreSQL is reachable.
- `GET http://<worker>:3020/health` proves that the worker and job queue process started.

Deploy the API first because it runs pending database migrations before accepting traffic. Wait for
`/ready`, then deploy the worker from the same revision, then the storefront. Never run two different
application revisions against the database during a migration.

## Persistent data

PostgreSQL and `ASSET_UPLOAD_DIR` are the two authoritative local data stores. Container filesystems
are disposable. `ASSET_UPLOAD_DIR` must be an absolute path on a persistent volume, and
`ASSET_URL_PREFIX` must be the public URL ending in `/assets/`. Configure the storefront build with
the same public base in `NEXT_PUBLIC_VENDURE_ASSET_URL`.

NetSuite product-image source archives are import inputs, not substitutes for the Vendure asset
store. If production catalog refresh still uses a local archive, mount it separately and set
`NETSUITE_IMAGE_DIRECTORY`; include that archive in the backup policy.

## Environment inventory

Populate the contracts in `apps/server/.env.example` and `apps/storefront/.env.example` through the
hosting platform's secret and configuration system. Do not copy either development `.env` file.

Before enabling traffic, verify at minimum:

- production URLs, CORS origins, cookie secret, and administrator credentials;
- PostgreSQL connection and schema;
- persistent asset path and public asset URL;
- Microsoft Graph sender configuration and mailbox restriction;
- all NetSuite credentials and RESTlet URLs;
- Our Truck shipping mapping;
- customer refresh schedule;
- storefront Shop API, site, asset, channel, and revalidation settings.

Keep `NETSUITE_ORDER_EXPORT_MODE=dry-run` through initial production validation. Change it to `live`
only after a controlled order passes the existing live-export runbook.

## Dependency security gate

Run `npm audit --omit=dev` for every release candidate. The October 7, 2026 audit has no critical
production advisories after upgrading Next.js to `16.3.6`, Nodemailer to `10.0.16`, and applying
compatible lockfile updates. It still reports 25 high and 6 moderate advisories, primarily through
Vendure's pinned Apollo/GraphQL, Dashboard build-tool, and Sharp dependency tree. Do not use
`npm audit fix --force`: npm currently proposes incompatible Vendure downgrades. Reassess these
findings against a Vendure-supported upgrade or upstream patch before approving production launch.

## Backup policy

Use managed PostgreSQL point-in-time recovery when available. Also create a portable database dump
and asset snapshot before every release that includes migrations, and at least daily thereafter.
Encrypt backups, store them outside the application host, restrict access, and retain enough history
to recover from delayed data corruption.

Example logical backup using environment-provided PostgreSQL credentials:

```shell
pg_dump --format=custom --no-owner --file=janvey-shop.dump "$DATABASE_URL"
```

Snapshot or archive the complete `ASSET_UPLOAD_DIR` at the same release boundary. Record the Git
revision, database backup identifier, asset snapshot identifier, and timestamp together.

Test a restore into an isolated environment at least quarterly. An untested backup is not recovery
evidence.

## Restore procedure

1. Block storefront traffic and stop the worker.
2. Set `NETSUITE_ORDER_EXPORT_MODE=disabled` and `EMAIL_TRANSPORT=file` in the isolated recovery
   environment. This prevents order replay and customer email while data is inspected.
3. Restore PostgreSQL into an empty database:

   ```shell
   pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" janvey-shop.dump
   ```

4. Restore the matching asset snapshot to `ASSET_UPLOAD_DIR`.
5. Deploy the exact recorded Git revision. Start the API and wait for `/ready`; then start the worker.
6. Run `node scripts/netsuite-db-verify.cjs` from a trusted operations environment and compare catalog,
   payment-method, and order-export ledger counts with the backup record.
7. Inspect every `pending`, `validated`, or `failed` NetSuite export. Restored dry runs and incomplete
   live attempts must not be retried until their NetSuite external IDs have been checked.
8. Verify Dashboard login, storefront sign-in, customer pricing, one taxable account, one exempt
   account, assets, checkout, approval visibility, and email rendering without sending externally.
9. Re-enable email and progress order export through `dry-run` before restoring `live` mode.
10. Reopen traffic only after recording the restore evidence and approver.

## Release evidence

For each production release retain:

- Git revision and image digest;
- successful server and storefront builds;
- migration and `/ready` result;
- worker health result;
- database backup and asset snapshot identifiers;
- focused integration-test result;
- production dependency audit and any accepted-risk record;
- order-export mode before and after release;
- rollback or restore decision owner.
