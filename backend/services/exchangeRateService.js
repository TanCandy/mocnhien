const axios = require("axios");

const FALLBACK_RATE = 26000; // Safe fallback rate
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

let cachedRate = null;
let cacheTimestamp = null;

/**
 * Fetch USD to VND exchange rate with safe fallback
 * @returns {Promise<number>} USD to VND exchange rate
 */
async function getExchangeRate() {
  const now = Date.now();

  // Return cached rate if still valid
  if (cachedRate && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    console.log(`[ExchangeRate] Using cached rate: ${cachedRate}`);
    return cachedRate;
  }

  // Try primary API: open.er-api.com
  try {
    const res = await axios.get("https://open.er-api.com/v6/latest/USD", {
      timeout: 5000,
    });

    if (!res.data || !res.data.rates || !res.data.rates.VND) {
      throw new Error("Invalid rate data from primary API");
    }

    const rate = res.data.rates.VND;
    cachedRate = rate;
    cacheTimestamp = now;
    console.log(`[ExchangeRate] Fetched new rate from API: ${rate}`);
    return rate;
  } catch (error) {
    console.error("[ExchangeRate] Primary API error:", error.message);

    // Try fallback API: exchangerate-api.com
    try {
      const fallbackRes = await axios.get(
        "https://api.exchangerate-api.com/v4/latest/USD",
        { timeout: 5000 }
      );

      if (!fallbackRes.data || !fallbackRes.data.rates || !fallbackRes.data.rates.VND) {
        throw new Error("Invalid rate data from fallback API");
      }

      const rate = fallbackRes.data.rates.VND;
      cachedRate = rate;
      cacheTimestamp = now;
      console.log(`[ExchangeRate] Fetched from fallback API: ${rate}`);
      return rate;
    } catch (fallbackError) {
      console.error("[ExchangeRate] Fallback API error:", fallbackError.message);
    }

    // Use fallback rate if all APIs fail
    console.warn(`[ExchangeRate] Using fallback rate: ${FALLBACK_RATE}`);
    cachedRate = FALLBACK_RATE;
    cacheTimestamp = now;
    return FALLBACK_RATE;
  }
}

/**
 * Parse USD string to number (remove commas)
 * @param {string} value - USD value string like "1,000" or "1,000,000"
 * @returns {number} Parsed number
 */
function parseUSD(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  // Remove all commas and convert to number
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format VND number to Vietnamese currency string
 * @param {number} value - VND amount
 * @returns {string} Formatted string like "25,000,000 đ"
 */
function formatVND(value) {
  if (typeof value !== "number" || isNaN(value) || value === null || value === undefined) return "0 đ";
  return value.toLocaleString("vi-VN") + " đ";
}

/**
 * Format USD number to string with commas and dollar sign
 * @param {number} value - USD amount
 * @returns {string} Formatted string like "$1,000.00"
 */
function formatUSD(value) {
  if (typeof value !== "number" || isNaN(value) || value === null || value === undefined) return "$0.00";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calculate VND from USD using real-time exchange rate
 * @param {number} priceUSD - Price in USD
 * @returns {Promise<{priceVND: number, exchangeRate: number}>}
 */
async function calculateVND(priceUSD) {
  const rate = await getExchangeRate();
  const priceVND = Math.round(priceUSD * rate);
  console.log(`[CalculateVND] $${priceUSD} × ${rate} = ${priceVND} VND`);
  return { priceVND, exchangeRate: rate };
}

/**
 * Clear exchange rate cache
 */
function clearCache() {
  cachedRate = null;
  cacheTimestamp = null;
}

module.exports = {
  getExchangeRate,
  parseUSD,
  formatVND,
  formatUSD,
  calculateVND,
  clearCache,
};
