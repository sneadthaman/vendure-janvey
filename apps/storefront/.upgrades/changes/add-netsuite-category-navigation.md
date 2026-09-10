---
type: minor
areas:
  - collections
  - platform.vendure
  - products
  - site
  - tooling
---

## Intent

Replace demo catalog navigation with a NetSuite-backed category hierarchy and a staff-managed featured assortment.

## Invariants

- Only Collections marked for navigation appear in the header, mobile menu, and footer.
- Parent categories expose their visible child categories.
- The homepage reads from the Featured Products Collection.
- Product and cart prices remain tax-exclusive.

## Integration guidance

Preserve the nested Collection query and visibility filtering when integrating navigation changes. Keep category presentation editable in Vendure and avoid hard-coded product membership in the storefront.

## Verification

- Verify six desktop parent menus and matching mobile accordions.
- Verify parent pages link to child categories and return the expected NetSuite products.
- Verify the homepage carousel contains the eight seeded Featured Products.
