# NetSuite Live Sales Order Export Runbook

This runbook promotes one dry-run-validated Vendure order into one NetSuite Sales Order. It is deliberately scoped to a single order for the first live test.

## Current checkpoint

As of October 6, 2026, the local export ledger contains:

| Ledger ID | Vendure external ID | Status | Expected total | NetSuite transaction |
| --- | --- | --- | ---: | --- |
| 1 | `VENDURE-91P6EP5AU9SNZKWS` | `validated` | $243.97 | none |
| 2 | `VENDURE-QRN5BYULCNMFNXRM` | `cancelled` | $39.90 | none |
| 3 | `VENDURE-Z8AUTBCU8XM1L8NW` | `validated` | $31.33 | none |

Use ledger **3**, order `Z8AUTBCU8XM1L8NW`, for the first live export. It exercises the completed Test Ecommerce approval workflow. Leave ledger 1 validated and ledger 2 cancelled.

The application now requires an explicit retry to promote a validated dry run after live mode is enabled. Starting in live mode does not submit old validated, failed dry-run, or unattempted records. A previously attempted live export can resume after a restart.

## Before enabling live mode

1. Redeploy [`netsuite/vendure-netsuite-sales-order-restlet.js`](netsuite/vendure-netsuite-sales-order-restlet.js) to script `2320`, deployment `1`. The updated RESTlet verifies that the configured Shipping Item is active during dry-run validation.
2. Run `node scripts/netsuite-order-export-smoke.cjs 3`. It refuses to run unless local export mode is `dry-run`, confirms Shipping Item `3836` is active, proves that an invalid Shipping Item is rejected, and validates the saved candidate payload without creating a transaction.
3. Keep `NETSUITE_ORDER_EXPORT_MODE=dry-run` and `NETSUITE_ORDER_SHIPPING_METHOD_ID=3836` while performing the remaining checks.
4. Open **Sales > NetSuite order exports** in the Vendure Dashboard. Confirm order `Z8AUTBCU8XM1L8NW` is `validated`, has no NetSuite internal ID or transaction number, and has an expected total of $31.33.
5. In NetSuite, search Sales Orders for external ID `VENDURE-Z8AUTBCU8XM1L8NW`. The result must be empty. Also confirm that external IDs for ledger 1 and ledger 2 have no Sales Orders.
6. Confirm Test Ecommerce customer `4359`, the requester contact, selected ship-to, default bill-to, and all order items are active. Confirm the order should use Our Truck with a $0.00 shipping charge.
7. Confirm the current application build contains the live-startup safeguard and passes the focused order-export tests.

The script `2320` redeployment and smoke verification passed on October 6, 2026. NetSuite returned `dryRun=true`, `internalId=null`, and `transactionId=null` for ledger 3.

Do not continue if the candidate already exists in NetSuite, the Dashboard row is not validated, the expected total differs, or the shipping item is absent.

## Submit exactly one order

1. Set `NETSUITE_ORDER_EXPORT_MODE=live` in the server environment.
2. Restart the Vendure server and worker so they load the new mode.
3. Open **Sales > NetSuite order exports** and confirm the configuration banner says **Mode: live**. Confirm both validated rows remain validated; no Sales Order should be submitted merely by restarting.
4. On `Z8AUTBCU8XM1L8NW` only, click **Export now** once.
5. Wait for the row to reach a terminal state:
   - `exported`: NetSuite created or found the Sales Order and its total matches Vendure.
   - `exported_with_mismatch`: NetSuite created the Sales Order, but its saved total differs. Do not retry it.
   - `failed`: inspect the error and follow the recovery section before retrying.
6. Record the NetSuite transaction number and internal ID displayed by the Dashboard.
7. Open the Sales Order in NetSuite and verify:
   - external ID is `VENDURE-Z8AUTBCU8XM1L8NW`;
   - customer is Test Ecommerce (`4359`);
   - the requester contact and customer addresses are correct;
   - every item, quantity, and custom unit price matches Vendure;
   - shipping method is Our Truck (`3836`) and shipping is $0.00;
   - NetSuite calculated tax is correct for the customer and addresses;
   - saved total is $31.33;
   - there is exactly one Sales Order with this external ID.
8. Confirm ledger 1 is still `validated` and ledger 2 is still `cancelled`.
9. Return `NETSUITE_ORDER_EXPORT_MODE` to `dry-run` and restart the server and worker until the broader live-export release is approved.

## Recovery rules

- If Vendure reports `exported_with_mismatch`, treat the order as created. Investigate tax, item pricing, address sourcing, and shipping in NetSuite. Never use retry to correct the existing transaction.
- If Vendure reports `failed`, search NetSuite for the external ID before retrying. A response may have been lost after NetSuite saved the transaction.
- If the external ID exists, do not create another order manually. The RESTlet is idempotent and a retry should return the existing Sales Order, but verify the existing transaction first.
- If the external ID does not exist, correct the reported reference or permission problem, return to dry-run if appropriate, and retry once.
- To stop new writes, set `NETSUITE_ORDER_EXPORT_MODE=dry-run` and restart the server and worker. This does not delete or alter any Sales Order already created.
- Never delete an export ledger row or reuse its `VENDURE-<order code>` external ID.

## Acceptance criteria

The first live test passes when exactly one NetSuite Sales Order exists for `VENDURE-Z8AUTBCU8XM1L8NW`, the Dashboard records its internal ID and transaction number as `exported`, all lines and addresses match, Our Truck shipping is $0.00, NetSuite tax is correct, the saved total is $31.33, and no other validated ledger row was submitted.

## First live result

The controlled export completed on October 7, 2026. NetSuite created Sales Order `SO310591`, internal ID `204855`, for external ID `VENDURE-Z8AUTBCU8XM1L8NW`. Its saved subtotal was $28.84, Our Truck shipping was $0.00, tax was $2.49, and total was $31.33.

The initial response represented NetSuite's blank zero-dollar `shippingcost` as `null`, so Vendure left ledger 3 in `failed` even though the transaction had been created. The recovery probe confirmed the external ID before any retry. The RESTlet now normalizes only a blank shipping cost to zero cents. After redeployment, an idempotent retry returned the existing `SO310591` and Vendure marked ledger 3 `exported` with matching totals and no error. Ledger 1 remained `validated`, ledger 2 remained `cancelled`, and the backend was returned to `dry-run`.
