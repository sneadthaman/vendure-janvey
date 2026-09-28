---
type: patch
areas:
  - site
  - products
  - search
---

## Intent

Replace the generic starter storefront with a Janvey-branded, commerce-focused homepage and a dedicated SSS Brand shopping destination.

## Invariants

- Homepage categories and product cards continue to use live Vendure collection and search data.
- Signed-in customers continue to receive NetSuite-specific prices on displayed products.
- Search, account, cart, collection, locale, and mobile navigation behavior remains available.
- The SSS Brand page constrains product discovery to the SSS catalog term while preserving normal filters, sorting, and pagination.

## Integration guidance

Preserve downstream branding and homepage composition when adopting this change. Replace the supplied Janvey and Triple S assets only with approved equivalents at the same public paths, or update all image references together. Keep the forced SSS search term when customizing the brand-page presentation.

## Verification

- Run upgrade validation, storefront tests, lint, type checking, and the production build.
- Review the homepage, navigation, category cards, product cards, SSS Brand page, and mobile layout against a running Vendure API.
- Verify signed-in customer pricing still appears in homepage and SSS product cards.
