/**
 * Currency formatting helpers.
 * Exchange rate is user-provided on orders (no external API).
 */

function parseUSD(value) {
  if (typeof value === "number") return value < 0 || isNaN(value) ? 0 : value;
  if (!value) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function formatVND(value) {
  if (typeof value !== "number" || isNaN(value) || value === null || value === undefined) return "0 đ";
  return value.toLocaleString("vi-VN") + " đ";
}

function formatUSD(value) {
  if (typeof value !== "number" || isNaN(value) || value === null || value === undefined) return "$0.00";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parse exchange rate (strips commas from "25,600" so parseFloat doesn't truncate to 25) */
function parseExchangeRate(value) {
  if (typeof value === "number") return value < 0 || isNaN(value) ? 0 : Math.min(10000000, value);
  if (!value) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || parsed < 0 ? 0 : Math.min(10000000, parsed);
}

/** VND = USD × user-provided exchange rate */
function calculateVNDFromRate(priceUSD, exchangeRate) {
  const usd = parseUSD(priceUSD);
  const rate = parseExchangeRate(exchangeRate);
  if (usd <= 0 || rate <= 0) return { priceVND: 0, exchangeRate: rate };
  const priceVND = Math.round(usd * rate);
  return { priceVND, exchangeRate: rate };
}

module.exports = {
  parseUSD,
  parseExchangeRate,
  formatVND,
  formatUSD,
  calculateVNDFromRate,
};
