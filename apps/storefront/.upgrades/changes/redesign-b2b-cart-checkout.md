---
type: minor
areas:
  - cart
  - checkout
  - b2b
  - orders
---

## Intent

Turn the generic cart and checkout into a Janvey business purchasing flow with visible NetSuite account context, approval expectations, approved delivery locations, and a transparent net-price, shipping, tax, and order-total breakdown.

## Invariants

- Product and cart prices remain tax-exclusive until checkout.
- Customer-specific prices, approved NetSuite ship-to addresses, account tax, and approval requirements remain authoritative.
- Guest cart lines are repriced against the linked NetSuite account when authentication or invitation acceptance makes customer pricing available.
- Existing cart mutations, checkout transitions, payment handling, and approval submission behavior remain unchanged.
- Promotions and guest checkout remain available wherever the channel already allows them.

## Integration guidance

Preserve the separate pre-tax and tax-inclusive order fields when adapting the visual presentation. The checkout summary uses `taxSummary` for the explicit tax line and continues to use `totalWithTax` for the final payable total.

## Verification

- Run upgrade validation, storefront tests, lint, type checking, and a production build.
- Verify a linked direct-purchase account and an approval-required account.
- Verify taxable and exempt accounts show the expected tax line after selecting an address.
- Verify quantity changes, removal, promotion codes, shipping selection, payment, approval submission, and mobile layouts.
