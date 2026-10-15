/**
 * Single source of truth for an order's money fields.
 *
 * Every place that shows, stores, exports or collects an order amount (API
 * responses, admin edits, the payment webhook, the QR code, Sheets/Excel)
 * goes through these helpers so they can never disagree.
 */

/** USD price of an order, including the legacy `total_price` field. */
function getOrderTotalUSD(order) {
  return Number(order.totalUSD || order.priceUSD || order.total_price || 0) || 0;
}

/**
 * VND amount the customer owes in total. Always derived from USD × rate when
 * both exist (stored VND values can be stale); falls back to stored VND for
 * legacy orders without a USD price.
 */
function getOrderTotalVND(order) {
  const usd = getOrderTotalUSD(order);
  const rate = Number(order.exchangeRate || 0) || 0;
  if (usd > 0 && rate > 0) return Math.round(usd * rate);
  return Math.max(0, Math.round(Number(order.totalVND || order.priceVND || 0) || 0));
}

/**
 * Derive percent / remaining / status from a total and a paid amount.
 * - percent is floored so 99.6% never displays as 100%
 * - an order with no price yet (total 0) is never "paid"
 * - overpayment is kept in paidAmount; remaining never goes negative
 */
function computePaymentFields(totalVND, paidAmount) {
  const total = Math.max(0, Math.round(Number(totalVND) || 0));
  const paid = Math.max(0, Math.round(Number(paidAmount) || 0));
  return {
    paidAmount: paid,
    paymentPercent: total > 0 ? Math.min(100, Math.floor((paid / total) * 100)) : 0,
    remainingAmount: Math.max(0, total - paid),
    paymentStatus: total > 0 && paid >= total ? "paid" : "pending",
  };
}

module.exports = { getOrderTotalUSD, getOrderTotalVND, computePaymentFields };
