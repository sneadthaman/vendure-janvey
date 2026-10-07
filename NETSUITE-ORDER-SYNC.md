# NetSuite Sales Order Sync

## Current implementation

Vendure captures an order for export only after its final business decision:

- a direct-purchase order enters `PaymentAuthorized` or `PaymentSettled`; or
- an approval order enters `Approved` after final customer pricing and tax validation.

Submitting an order to `PendingApproval` does not export it. Rejected and cancelled orders do not export.

Each eligible order gets one `netsuite_order_export` record. Its external ID is `VENDURE-<Vendure order code>`, which is unique in the local database and is also checked by the NetSuite RESTlet before a Sales Order is created. Retried jobs therefore return the existing NetSuite transaction instead of creating a duplicate.

The export payload uses immutable IDs already maintained by the integration:

- NetSuite Customer internal ID from `netsuite_account`;
- NetSuite Contact internal ID from `netsuite_contact_link`;
- selected ship-to and default bill-to addressbook internal IDs;
- NetSuite Item internal ID from each Product Variant; and
- customer-specific unit prices stored on the completed Vendure order.

Discounted lines and order surcharges currently fail closed because no matching NetSuite mapping has been approved. NetSuite calculates tax when it saves the Sales Order. Vendure stores both totals and marks the export `exported_with_mismatch` if NetSuite's total differs.

Staff can view and retry incomplete exports at **Sales > NetSuite order exports** in the Vendure Dashboard. The SuperAdmin-only `reconcileNetsuiteOrderExport(orderId: ID!)` mutation captures and queues an eligible completed order that predates the listener or was missed during an outage.

## Safety modes

Order export defaults to disabled. Configure these variables in `apps/server/.env`:

```dotenv
NETSUITE_ORDERS_RESTLET_URL=
NETSUITE_ORDER_EXPORT_MODE=disabled
NETSUITE_ORDER_SHIPPING_METHOD_ID=
```

`NETSUITE_ORDER_EXPORT_MODE` accepts:

- `disabled`: capture eligible orders locally without calling NetSuite;
- `dry-run`: authenticate to the RESTlet and validate the customer, contact, addresses, items, shipping mapping, and payload totals without saving a transaction; or
- `live`: create or return the idempotent NetSuite Sales Order.

Always begin with `dry-run`. Change to `live` only after a representative taxable and exempt order pass and the resulting NetSuite totals and defaults have been reviewed.

Changing to `live` does not automatically submit records that were validated in dry-run mode. A staff member must explicitly choose **Export now** for each validated record. Startup recovery resumes only records whose stored payload shows that a live attempt was already in progress; this prevents an environment change from promoting a backlog of dry runs into Sales Orders.

## NetSuite deployment

Deploy `netsuite/vendure-netsuite-sales-order-restlet.js` as a new RESTlet under the existing token-based integration. Do not replace a read-only catalog, pricing, image, or customer deployment with this script.

An authenticated `GET` request is read-only and lists the active Shipping Item names and numeric internal IDs available to the integration role. The Vendure client uses `POST` only for dry-run validation and live export.

The deployment role needs enough access to read Customers, Contacts, Items, and customer addressbook entries and to create Sales Orders. It also needs access to the selected Shipping Item. Keep the deployment audience limited to the integration role.

The current contract lets the Customer record supply its normal NetSuite defaults for terms, price level, sales representative, location, department, class, and Sales Order form. If any of those fields are mandatory or must be fixed for web orders, add an explicit internal-ID mapping before live mode.

The initial storefront shipping policy uses NetSuite Shipping Item `3836` / **Our Truck**. It carries a zero shipping charge. Migration `1789690000000-our-truck-shipping.ts` renames the original standard method to Our Truck, changes its rate to zero, and retires the scaffolded Express Shipping choice until explicit carrier mappings are designed.

## Local database

Migration `1789680000000-netsuite-order-exports.ts` creates the durable export ledger. The normal server bootstrap runs pending migrations before starting Vendure. Restarting the backend after pulling this change applies it automatically.

## Verification sequence

1. Deploy the Sales Order RESTlet and set its URL.
2. Set the NetSuite Shipping Item internal ID used for the current Vendure shipping charge.
3. Set export mode to `dry-run` and restart the backend.
4. Complete one direct order and approve one approval-required order.
5. Confirm both rows show `validated` in **Sales > NetSuite order exports** and that the pending approval did not create an export row before approval.
6. Confirm the desired NetSuite form, terms, location, department, class, sales representative, and shipping behavior.
7. Enable `live` for one controlled order and compare customer, contact, addresses, items, prices, shipping, tax, and total in NetSuite.
8. Test retrying the same export and confirm the original Sales Order internal ID and transaction number are returned.

Use `NETSUITE-LIVE-ORDER-EXPORT-RUNBOOK.md` for the first controlled live order, including the exact candidate, stop conditions, recovery rules, and rollback to dry-run.

The first live order completed on October 7, 2026 as NetSuite transaction `SO310591` / internal ID `204855`. Its idempotent recovery also verified the lost-or-invalid-response procedure: search the external ID first, correct the response contract, and only then retry so the existing transaction is returned.
