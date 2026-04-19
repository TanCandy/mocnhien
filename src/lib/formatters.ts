/**
 * Format currency input - allows typing with commas
 * @param {string} value - Input value
 * @returns {string} Formatted value with commas
 */
export function formatCurrencyInput(value: string): string {
  if (!value) return "";

  // Remove all non-numeric characters except decimal point
  let cleaned = value.replace(/[^0-9.]/g, "");

  // Handle decimal points
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    // Only keep first part and second part
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }

  // Split into integer and decimal parts
  const [intPart, decPart] = cleaned.split(".");

  // Format integer part with commas
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Combine with decimal part
  if (decPart !== undefined) {
    // Limit decimal places to 2
    const limitedDec = decPart.slice(0, 2);
    return formattedInt + "." + limitedDec;
  }

  return formattedInt;
}

/**
 * Parse USD string to number (remove commas)
 * @param {string} value - USD value string like "1,000" or "1,000.50"
 * @returns {number} Parsed number
 */
export function parseUSD(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  // Remove all commas and convert to number
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format USD number to currency string
 * @param {number|null|undefined} amount - USD amount
 * @returns {string} Formatted string like "$1,000.00"
 */
export function formatUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Format VND number to Vietnamese currency string
 * @param {number|null|undefined} amount - VND amount
 * @returns {string} Formatted string like "25.000.000 đ"
 */
export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 đ";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

/**
 * Format a link for display (truncate if too long)
 * @param {string} url - URL to format
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated URL
 */
export function formatLink(url: string, maxLength: number = 50): string {
  if (!url) return "";
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength) + "...";
}

/**
 * Check if a string is a valid URL
 * @param {string} url - String to check
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    // Try adding https:// if it doesn't have a protocol
    try {
      new URL("https://" + url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Ensure URL has protocol
 * @param {string} url - URL to process
 * @returns {string} URL with protocol
 */
export function ensureUrlProtocol(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "https://" + url;
}
