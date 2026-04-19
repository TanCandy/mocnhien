const axios = require("axios");

const FALLBACK_RATE = 25000;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

let cachedRate = null;
let cacheTimestamp = null;

/**
 * Fetch USD to VND exchange rate from open.er-api.com
 * @returns {Promise<number>} USD to VND exchange rate
 */
async function getUSDToVND() {
  const now = Date.now();

  // Return cached rate if still valid
  if (cachedRate && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    console.log(`[ExchangeRate] Using cached rate: ${cachedRate}`);
    return cachedRate;
  }

  try {
    const res = await axios.get("https://open.er-api.com/v6/latest/USD", {
      timeout: 5000,
    });

    if (res.data && res.data.rates && res.data.rates.VND) {
      const rate = res.data.rates.VND;
      cachedRate = rate;
      cacheTimestamp = now;
      console.log(`[ExchangeRate] Fetched new rate from API: ${rate}`);
      return rate;
    }

    throw new Error("Invalid response format");
  } catch (error) {
    console.error("[ExchangeRate] API error:", error.message);

    // Try fallback API
    try {
      const fallbackRes = await axios.get(
        "https://api.exchangerate-api.com/v4/latest/USD",
        { timeout: 5000 }
      );

      if (fallbackRes.data && fallbackRes.data.rates && fallbackRes.data.rates.VND) {
        const rate = fallbackRes.data.rates.VND;
        cachedRate = rate;
        cacheTimestamp = now;
        console.log(`[ExchangeRate] Fetched from fallback API: ${rate}`);
        return rate;
      }
    } catch (fallbackError) {
      console.warn("[ExchangeRate] Fallback API also failed:", fallbackError.message);
    }

    // Use fallback rate if all APIs fail
    console.warn(`[ExchangeRate] Using fallback rate: ${FALLBACK_RATE}`);
    cachedRate = FALLBACK_RATE;
    cacheTimestamp = now;
    return FALLBACK_RATE;
  }
}

/**
 * Clear exchange rate cache
 */
function clearCache() {
  cachedRate = null;
  cacheTimestamp = null;
}

module.exports = {
  getUSDToVND,
  clearCache,
};
