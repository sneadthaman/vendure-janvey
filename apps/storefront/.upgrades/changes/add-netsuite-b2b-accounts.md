---
type: minor
areas:
  - account
  - b2b
  - checkout
  - products
  - platform.vendure
---

## Intent

Add staff-linked NetSuite business accounts, customer-specific catalog prices, authoritative ship-to selection, and an audited order-approval experience.

## Invariants

- Guest and unlinked users continue through the standard checkout with public Online Prices.
- Linked contacts use prices scoped to their shared NetSuite account and choose only imported NetSuite ship-to addresses.
- Contacts requiring approval submit without payment; account approvers can modify, approve, reject, or cancel those requests.
- Customer-specific data is fetched with the authenticated Vendure token and is never placed in shared page caches.

## Integration guidance

Keep the B2B feature's GraphQL operations, server actions, account pages, and message files together. Preserve the public cached catalog response plus per-request authenticated price overlay so one account's pricing cannot enter another account's cache.

## Verification

- Verify linked and unlinked checkout flows, account-specific listing and detail prices, and immutable NetSuite address cards.
- Submit a requester cart and exercise approver edits, approval, rejection, cancellation, and audit history.
- Confirm guest product and checkout prices remain public and tax-exclusive.
