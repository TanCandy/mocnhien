const { env } = require("../config/env");

function clampNumber(n, min, max) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function normalizeTier(serviceTier) {
  const t = (serviceTier || "standard").toLowerCase().trim();
  if (t === "express" || t === "standard") return t;
  return "standard";
}

function getCategoryInsuranceRate(packageCategory) {
  const c = (packageCategory || "").toLowerCase();
  // Heuristic rates based on common categories from the UI.
  if (c.includes("luxury") || c.includes("antique") || c.includes("fragile")) return 0.025;
  if (c.includes("electronics") || c.includes("cosmetic") || c.includes("supplement")) return 0.015;
  return 0;
}

function calculateQuote({ weightKg, serviceTier, packageCategory }) {
  const w = clampNumber(weightKg, 0.01, 2000);
  const tier = normalizeTier(serviceTier);

  // Base pricing (USD).
  const baseUsd = 9.5 * w;
  const handlingUsd = 3 + 1.2 * Math.min(w, 10); // capped so it doesn't explode

  // Tier multiplier.
  const tierMultiplier = tier === "express" ? 1.25 : 1.0;
  const serviceUsd = (baseUsd + handlingUsd) * (tierMultiplier - 1);

  // Optional insurance based on category.
  const insuranceRate = getCategoryInsuranceRate(packageCategory);
  const insuranceUsd = baseUsd * insuranceRate;

  const totalUsd = baseUsd + handlingUsd + serviceUsd + insuranceUsd;
  const totalVnd = Math.round(totalUsd * env.QUOTE_EXCHANGE_RATE_VND_PER_USD);

  return {
    currency: "VND",
    amount: totalVnd,
    breakdown: {
      baseUsd,
      handlingUsd,
      insuranceUsd,
      serviceUsd,
      totalUsd,
      exchangeRateVndPerUsd: env.QUOTE_EXCHANGE_RATE_VND_PER_USD,
      totalVnd,
    },
  };
}

module.exports = { calculateQuote };

