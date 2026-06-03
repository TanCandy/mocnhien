/**
 * Currency formatting helpers.
 * Exchange rate is user-provided on orders (no external API).
 */

function parseUSD(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatVND(value) {
  if (typeof value !== "number" || isNaN(value) || value === null || value === undefined) return "0 đ";
  return value.toLocaleString("vi-VN") + " đ";
}

function formatUSD(value) {
  if (typeof value !== "number" || isNaN(value) || value === null || value === undefined) return "$0.00";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** VND = USD × user-provided exchange rate */
function calculateVNDFromRate(priceUSD, exchangeRate) {
  const usd = parseUSD(priceUSD);
  const rate = Number(exchangeRate) || 0;
  if (usd <= 0 || rate <= 0) return { priceVND: 0, exchangeRate: rate };
  const priceVND = Math.round(usd * rate);
  return { priceVND, exchangeRate: rate };
}

module.exports = {
  parseUSD,
  formatVND,
  formatUSD,
  calculateVNDFromRate,
};
