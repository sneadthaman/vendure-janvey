---
type: patch
areas:
  - products
  - cart
---

## Intent

Display NetSuite Online Prices without adding tax while customers browse products and review their cart. Calculate and display applicable tax during checkout.

## Invariants

- Product cards and product details display Vendure's tax-exclusive `price`.
- Cart lines, discounts, shipping, subtotal, and total remain tax-exclusive.
- Checkout, confirmation, and account order views retain tax-inclusive finalized totals.
- The cart tells customers that their applicable tax is calculated at checkout.

## Integration guidance

Preserve the distinction between browsing/cart net-price fields and checkout/order tax-inclusive fields. Do not replace checkout totals with net totals when integrating later storefront changes.

## Verification

- Confirm a variant with a 7315-cent Online Price displays `$73.15` in search, product detail, and cart views.
- Set a checkout shipping address and confirm the configured Vendure tax zone determines checkout tax.
- Run storefront type checking, lint, tests, upgrade validation, and the production build.
