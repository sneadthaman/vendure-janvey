---
type: minor
areas:
  - products
  - site
---

## Intent

Replace the generic product detail page with a Janvey B2B purchasing layout. Product information is organized into Details, Specs, Regulatory, and Additional Information tabs backed by the existing NetSuite custom fields.

## Invariants

- Product price and stock continue to come from the active Vendure variant and the configured NetSuite pricing strategy.
- Authenticated product pricing is fetched per request and is never stored in the public product metadata cache.
- Add-to-cart still uses the existing server action and now accepts the customer-selected quantity.
- External document links render only for valid HTTP or HTTPS URLs.
- A missing SDS, literature link, video, or specification produces an explicit empty state instead of a broken link.

## Integration guidance

Product detail queries now include public NetSuite product and variant custom fields. Downstream GraphQL schemas must expose those configured public fields.

NetSuite SDS values may be either public URLs or filename references. Filename references are displayed for support follow-up until the integration provides a resolvable document URL.

## Verification

- Run `npm run upgrade:validate -w storefront`.
- Run storefront tests, lint, type checking, and a production build.
- Open a product with literature or SDS data and verify all four tabs, quantity controls, and document links.
