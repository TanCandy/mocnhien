# MIGRATIONS

Tracks schema drift on `backend/models/Order.js` and one-off scripts run against
production data. No fields are deleted by this document — it's a map of what's
authoritative today so a future cleanup migration can drop the rest safely.

## Order schema: legacy/duplicate fields

| Field | Replacement | Status | Notes |
|---|---|---|---|
| `address` | `warehouseAddress` | Legacy, still written | Kept as a plain-text mirror of `warehouseAddress` on every create/update (`orderController.js`); read by `getWarehouseAddress()` fallback and by the frontend (`OrderDetail.tsx`). |
| `origin` / `destination` | `warehouseAddress` | Legacy, read-only fallback | Never written by any current create/update path (`createOrder`, `adminCreateOrder`, `adminUpdateOrder`). Only consulted by `getWarehouseAddress()` for pre-`warehouseAddress`-era orders, and read directly by `dashboardController.js` and `Dashboard.tsx`. |
| `product_name` | `productName` | Legacy, still written | `adminCreateOrder` always writes both fields with the same value; `adminUpdateOrder` does not update `product_name` on edit (only `productName`). Frontend (`AdminOrders.tsx`) still reads `product_name` in places. |
| `trackingId` / `tracking_code` | `orderCode` | Legacy, still written | `orderCode` (generated server-side) is the current permanent identifier used for Google Sheets sync and is never reassignable. `trackingId`/`tracking_code` are a duplicate pair kept for orders created before `orderCode` existed; `findOrderByIdentifier()` and `trackOrder()` search across all three. `uspsTracking` is unrelated — it's the real USPS/carrier tracking number, not an internal id. |
| `total_price` | `priceUSD` / `priceVND` | Legacy, still written | Set from the admin form's raw `total_price` input in `adminCreateOrder`; not recalculated on update and not used in any price math — `priceUSD`/`priceVND`/`totalUSD`/`totalVND` are authoritative for pricing. Frontend (`AdminOrders.tsx`, `Dashboard.tsx`) still reads it for older orders. |
| `totalUSD` / `totalVND` | `priceUSD` / `priceVND` | Duplicate, kept in sync | Every write path sets these identically to `priceUSD`/`priceVND` in the same call — functionally one value stored twice. No known reason for the split; likely an earlier rename that didn't finish. |
| `weightKg`, `serviceTier`, `packageCategory` | — (quote-only) | Dead on `Order` | Only used by `quoteController.js` to compute a one-off shipping quote; never persisted to an `Order` document by any current controller. `mapOrderForApi()` and `buildTimeline()` still read them defensively for any legacy order rows that do have them set. |

## Plan

Do not drop any of the above yet. Before a real schema migration:
1. Confirm in the production DB whether any documents still rely on `origin`/`destination`/`weightKg`/`serviceTier`/`packageCategory` (i.e., predate `warehouseAddress`/`orderCode`).
2. Pick one authoritative field per pair (`warehouseAddress`, `productName`, `orderCode`, `priceUSD`/`priceVND`) and update the frontend to stop reading the legacy mirror.
3. Write a one-off backfill script (pattern: `backend/scripts/migrate-*.js`) to copy any remaining legacy-only data into the authoritative field.
4. Only then remove the legacy fields from the schema and the write paths that duplicate them.

## Scripts run

| Script | Purpose |
|---|---|
| `backend/scripts/migrate-contact.js` | Backfill `contactType`/`contactValue` from the old `customerEmail` field. |
| `backend/scripts/migrate-staffName.js` | Backfill `staffName` on orders created before that field existed. |
| `backend/scripts/migrate-userEmail.js` | Backfill `userEmail` for order isolation on older orders. |
| `backend/scripts/verify-emails.js` | Read-only verification script, not a migration. |

No record exists of which environments these were actually run against — track that here going forward when a new one-off script is run.
