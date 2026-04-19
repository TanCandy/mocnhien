/**
 * Format USD number to currency string
 * @param {number|null|undefined} amount - USD amount
 * @returns {string} Formatted string like "$1,000.00"
 */
export const formatUSD = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

/**
 * Format VND number to Vietnamese currency string
 * @param {number|null|undefined} amount - VND amount
 * @returns {string} Formatted string like "25.000.000 đ"
 */
export const formatVND = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 đ";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

/**
 * Safe format VND with manual formatting fallback
 * @param {number|null|undefined} value - VND amount
 * @returns {string} Formatted string like "25,000,000 đ"
 */
export const formatVNDFallback = (value: number | null | undefined): string => {
  if (typeof value !== "number" || isNaN(value) || value === null || value === undefined) return "0 đ";
  return value.toLocaleString("vi-VN") + " đ";
};
