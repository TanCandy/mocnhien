/**
 * Google Sheets mirror of the orders collection, via a Google Apps Script
 * web app (source: integrations/google-sheets/Code.gs).
 *
 * MongoDB is the source of truth — a sheet failure is logged and never blocks
 * or fails the DB write that triggered it.
 *
 * Wire format (JSON POST to WEBHOOK_URL):
 *   upsert:      { ...orderRow }                          (no `action`, legacy-compatible)
 *   delete:      { action: "delete", orderCode, orderId }
 *   bulk upsert: { action: "upsertMany", orders: [orderRow, ...] }
 * When WEBHOOK_SECRET is set it is added as `secret` to every body (Apps
 * Script `doPost` cannot read request headers).
 */

const { env } = require("../config/env");
const { logger } = require("../config/logger");
const { getOrderTotalUSD, getOrderTotalVND, computePaymentFields } = require("./orderMath");

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const REQUEST_TIMEOUT_MS = 10_000;
const BULK_TIMEOUT_MS = 60_000;

/** Sanitize values to prevent Google Sheets / Excel Formula Injection (=, +, -, @, \t, \r) */
function sanitizeCellString(val) {
  if (typeof val !== "string") return val;
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

/** Flat, sheet/Excel-friendly representation of an order. */
function orderToRow(order) {
  const total = getOrderTotalVND(order);
  const payment = computePaymentFields(total, order.paidAmount);
  // Stored status wins: an admin can mark an order paid explicitly.
  const paymentStatus = order.paymentStatus || payment.paymentStatus;
  const createdAt = order.createdAt ? new Date(order.createdAt) : null;

  return {
    date: createdAt ? createdAt.toLocaleDateString("vi-VN", { timeZone: TIME_ZONE }) : "",
    orderCode: order.orderCode || "",
    orderId: order._id ? String(order._id) : "",
    staffName: sanitizeCellString(order.staffName ?? ""),
    productName: sanitizeCellString(order.productName || order.product_name || ""),
    productLink: sanitizeCellString(order.productLink || ""),
    warehouse: sanitizeCellString(order.warehouseAddress || ""),
    customerName: sanitizeCellString(order.customerName || ""),
    contactType: order.contactType || "",
    contactValue: sanitizeCellString(order.contactValue === "NO_CONTACT" ? "" : order.contactValue || ""),
    usd: getOrderTotalUSD(order),
    exchangeRate: order.exchangeRate ?? 0,
    vnd: total,
    paidAmount: payment.paidAmount,
    paymentPercentage: payment.paymentPercent,
    remainingAmount: payment.remainingAmount,
    status: order.status || "",
    trackingNumber: sanitizeCellString(order.uspsTracking || ""),
    createdAt: createdAt ? createdAt.toISOString() : "",
    updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : "",
    // Added after the original keys so positional (legacy) receivers keep working.
    paymentStatus,
  };
}

async function post(body, timeoutMs = REQUEST_TIMEOUT_MS) {
  const payload = env.WEBHOOK_SECRET ? { ...body, secret: env.WEBHOOK_SECRET } : body;
  const res = await fetch(env.WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Apps Script returns HTML on errors / auth problems
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function syncOrder(order) {
  if (!env.WEBHOOK_URL) {
    logger.warn("[SheetsWebhook] WEBHOOK_URL not set — skipping sync.");
    return;
  }
  // orderCode is the sheet's row key — skip (not throw) so the DB write is never blocked
  if (!order.orderCode) {
    logger.error({ orderId: order._id ? String(order._id) : "" }, "[SheetsWebhook] Missing orderCode, skipping sync.");
    return;
  }

  const row = orderToRow(order);
  try {
    const res = await post(row);
    if (!res.ok || (res.json && res.json.ok === false)) {
      // Apps Script answers 200 even on failure — the reason is in the body.
      logger.error({ orderCode: row.orderCode, status: res.status, error: res.json?.error }, "[SheetsWebhook] sheet rejected sync");
    } else {
      logger.info({ orderCode: row.orderCode, status: res.status }, "[SheetsWebhook] synced");
    }
  } catch (err) {
    logger.error({ orderCode: row.orderCode, err: err.message }, "[SheetsWebhook] failed");
  }
}

async function deleteOrderRow(order) {
  if (!env.WEBHOOK_URL) {
    logger.warn("[SheetsWebhook] WEBHOOK_URL not set — skipping sheet delete sync.");
    return;
  }
  const orderCode = order.orderCode || "";
  try {
    const res = await post({ action: "delete", orderCode, orderId: order._id ? String(order._id) : "" });
    if (!res.ok || (res.json && res.json.ok === false)) {
      logger.error({ orderCode, status: res.status, error: res.json?.error }, "[SheetsWebhook] sheet rejected delete");
    } else {
      logger.info({ orderCode, status: res.status }, "[SheetsWebhook] delete synced");
    }
  } catch (err) {
    logger.error({ orderCode, err: err.message }, "[SheetsWebhook] delete failed");
  }
}

/**
 * Push every given order to the sheet in batches. Requires the bundled
 * Code.gs (the `upsertMany` action). Returns a summary for the admin UI.
 */
async function syncMany(orders, batchSize = 200) {
  if (!env.WEBHOOK_URL) {
    const err = new Error("WEBHOOK_URL is not configured.");
    err.statusCode = 400;
    throw err;
  }
  const rows = orders.filter((o) => o.orderCode).map(orderToRow);
  let sent = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await post({ action: "upsertMany", orders: batch }, BULK_TIMEOUT_MS);
    if (!res.ok || (res.json && res.json.ok === false)) {
      const err = new Error(
        `Sheet rejected batch ${i / batchSize + 1}: ${res.json?.error || `HTTP ${res.status}`}`
      );
      err.statusCode = 502;
      throw err;
    }
    sent += batch.length;
  }
  return { sent, skipped: orders.length - rows.length };
}

module.exports = { orderToRow, syncOrder, deleteOrderRow, syncMany };
