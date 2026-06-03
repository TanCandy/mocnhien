/**
 * Reusable exchange rate utilities for USD to VND conversion
 * These functions provide a consistent way to calculate and format currency values
 */

import { parseUSD } from "./formatters";

/**
 * Calculate VND amount from USD and exchange rate
 * @param priceUSD - Price in USD (string or number)
 * @param exchangeRate - Exchange rate (USD to VND)
 * @returns Calculated VND amount (rounded)
 */
export function calculateVND(priceUSD: string | number, exchangeRate: number): number {
  const usdValue = parseUSD(priceUSD);
  if (!exchangeRate || exchangeRate <= 0) return 0;
  return Math.round(usdValue * exchangeRate);
}

/**
 * Format exchange rate for display
 * @param rate - Exchange rate number
 * @returns Formatted string like "25,000 VND"
 */
export function formatExchangeRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || isNaN(rate)) return "N/A";
  return `${rate.toLocaleString("vi-VN")} VND`;
}

/**
 * Validate exchange rate value
 * @param rate - Exchange rate to validate
 * @returns true if rate is valid (> 0)
 */
export function isValidExchangeRate(rate: number | string | null | undefined): boolean {
  if (rate === null || rate === undefined || rate === "") return false;
  const numRate = typeof rate === "string" ? parseFloat(rate) : rate;
  return !isNaN(numRate) && numRate > 0;
}

/**
 * Parse exchange rate from various input types
 * @param rate - Exchange rate value (string or number)
 * @returns Parsed number or 0 if invalid
 */
export function parseExchangeRate(rate: number | string | null | undefined): number {
  if (rate === null || rate === undefined || rate === "") return 0;
  if (typeof rate === "number") return rate;
  const parsed = parseFloat(String(rate).replace(/,/g, "").trim());
  return isNaN(parsed) ? 0 : parsed;
}
