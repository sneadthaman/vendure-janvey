# Codex handoff

Updated: 2026-09-23

## Resume point

The NetSuite catalog and B2B customer foundation are implemented. The latest completed phase is secure invitation-based onboarding for NetSuite contacts. The working tree was clean at commit `82e8f2e` (`feat: add NetSuite contact invitations`), and `main` was pushed to `git@github.com:sneadthaman/vendure-janvey.git`.

Read `NETSUITE-IMPLEMENTATION-REPORT.md` for detailed implementation history and live fixture evidence. Treat this file as the short operational handoff.

## Architecture and boundaries

- Monorepo root: `janvey-shop`
- Vendure backend: `apps/server`
- Next.js storefront: `apps/storefront`
- NetSuite plugin: `apps/server/src/plugins/netsuite-sync`
- SuiteScript RESTlets: `netsuite`
- NetSuite is currently a read-only source for catalog, customers, contacts, addresses, pricing, and tax metadata.
- The **Catalog > NetSuite sync** control imports catalog data. Vendure's **Rebuild Search Index** only rebuilds the local search index.
- Vendure requires one ProductVariant under every Product. Each NetSuite item is represented as one Product with one implementation-required variant; there are no customer-facing option combinations.
- Prices are tax-exclusive. Tax is applied during checkout from the linked NetSuite account's authoritative tax-item rate.

## Completed customer integration

- Shared NetSuite companies are stored as `NetsuiteAccount` records.
- Human Vendure customers link to immutable NetSuite contacts through `NetsuiteContactLink`.
- Only active customer masters with `custentity_web_customer` enabled are eligible.
- Customer-specific prices are resolved live from NetSuite.
- Account addresses, default billing/shipping behavior, tax rates, approval roles, and order approval workflow are implemented.
- Customer/contact eligibility is refreshed nightly by scheduled task `netsuite-customer-refresh` at 2:00 AM server time unless `NETSUITE_CUSTOMER_REFRESH_CRON` overrides it.
- Removed or inactive contacts are suspended without deleting customer/order history.
- Local customer inventory was cleaned to real NetSuite fixtures `712` and `725`.

## Invitation onboarding

Staff use **Customers > NetSuite customers** to invite a contact by selecting an imported account and entering the immutable NetSuite contact ID. The backend reads the current contact email and name from NetSuite; staff cannot substitute an arbitrary recipient.

Security and lifecycle rules:

- 32 random bytes produce a 64-character token.
- Only its SHA-256 hash is stored.
- Default lifetime is seven days; `NETSUITE_INVITATION_TTL_HOURS` overrides it.
- Sending another invitation revokes earlier pending invitations for the same account/contact.
- The recipient uses `/account-invitation?token=...` and signs in or registers through the existing storefront flow.
- Acceptance requires an authenticated, email-verified Vendure customer whose normalized email matches the invitation.
- Acceptance rechecks the live NetSuite account, contact, contact activity, and email.
- Approval flags and the chosen default ship-to are copied to the new contact link in the transaction.
- Used, expired, revoked, and replayed tokens are rejected.

The database migration is `apps/server/src/migrations/1789590000000-netsuite-contact-invitations.ts`. The local development database has this migration applied.

## Live validation completed

An end-to-end local test used an unused active contact under customer `712`:

1. Created a temporary verified Vendure customer.
2. Sent the invitation through Admin GraphQL.
3. Confirmed the development EmailPlugin rendered the email and link.
4. Previewed the token through the public Shop API.
5. Logged in and accepted it.
6. Confirmed `PROF MAINTENANCE OF LI` became active with `requiresApproval=true`.
7. Confirmed replay was rejected.
8. Removed the temporary customer link and invitation; the temporary customer was soft-deleted through Vendure.

Final checks passed:

- full Vendure server, worker, and Dashboard build
- storefront production build
- storefront lint and TypeScript checks
- storefront upgrade validation
- 23 storefront tests
- 5 customer RESTlet contract tests
- 5 image RESTlet contract tests
- API health endpoint returned HTTP 200

The previously attempted `scripts/netsuite-pricing-restlet.test.cjs` command is stale; no such test file exists.

## Local operation

- Docker/PostgreSQL must be running. Local PostgreSQL is configured through `apps/server/.env` and has previously used port `6543`.
- Do not start or kill duplicate development processes. Check existing ports/processes first because the user commonly leaves `npm run dev` running.
- Backend-only commands are `npm run dev:server -w server` and `npm run dev:worker -w server`.
- Storefront normally runs at `http://localhost:3001`.
- Never copy environment secrets into documentation, logs, commits, or chat.

## Next work

The invitation implementation works locally, but production email delivery still needs a real SMTP/email transport configuration. The current EmailPlugin development mode writes messages to the local development mailbox.

Before choosing another phase, confirm the user's priority. Likely choices are:

1. Configure and verify production invitation email delivery.
2. Improve the staff invitation UI so contacts can be selected from imported/live contact data instead of manually entering a NetSuite contact ID.
3. Finish a deployment/release checklist for the customer integration.
4. Begin the next commerce phase, such as inventory synchronization or sending approved orders to NetSuite. Any NetSuite write path needs a separate, explicit design and staged validation because all current RESTlets are read-only.

## New-chat startup checklist

1. Read this file and `NETSUITE-IMPLEMENTATION-REPORT.md`.
2. Run `git status --short` and `git log -3 --oneline` before editing.
3. Check Docker and existing dev processes without launching duplicates.
4. Verify current API health and applied migrations if backend work continues.
5. Keep `.env`, `.local`, rendered development emails, downloaded product images, and credentials out of Git.
