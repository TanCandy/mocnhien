/**
 * Production Data Sanitization and Security Helpers
 * Used across frontend and backend for defensive computing.
 */

/**
 * Escapes special regex characters to prevent ReDoS and unintentional pattern matching
 */
export function escapeRegex(str: string): string {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Caps keyword search string length to prevent query amplification
 */
export function sanitizeKeyword(raw?: string | null, maxLen = 100): string {
  return String(raw || "").trim().slice(0, maxLen);
}

/**
 * Rejects non-string types to prevent NoSQL query operator injection ({ $gt: "" }, arrays, etc.)
 */
export function sanitizeSearchParam(param: unknown): string {
  if (typeof param !== "string") return "";
  return param.trim();
}

/**
 * Encodes special HTML entities to neutralize raw script tags and XSS payloads
 */
export function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates strictly formatted 24-char hex MongoDB ObjectIds
 */
export function isObjectId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Checks if a given request origin is in the allowed CORS origins whitelist
 */
export function isAllowedOrigin(origin?: string, allowedOrigins = ["https://mocnhienauthentic.vn", "http://localhost:3000"]): boolean {
  if (!origin) return true; // non-browser requests
  return allowedOrigins.includes(origin);
}

/**
 * Strips dangerous prototype pollution keys (__proto__, constructor, prototype)
 */
export function safeAssign<T = Record<string, any>>(target: Record<string, any>, source: Record<string, any>): T {
  for (const [key, val] of Object.entries(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    target[key] = val;
  }
  return target as T;
}

/**
 * Strips relational SQL meta characters
 */
export function sanitizeSqlParam(param: string): string {
  return String(param || "").replace(/['";\\]/g, "");
}

/**
 * Strips ANSI terminal escape sequences from logged strings
 */
export function stripAnsi(str: string): string {
  return String(str || "").replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

/**
 * Prevents open redirect attacks by ensuring internal relative path
 */
export function isValidInternalRedirect(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  return path.startsWith("/") && !path.startsWith("//") && !path.includes(":");
}

/**
 * Verifies JWT string has valid 3-segment dot-separated format
 */
export function isValidJwtStructure(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * Rate limit identifier generation
 */
export function getRateLimitKey(ip?: string, userId?: string): string {
  if (userId) return `user:${userId}`;
  return `ip:${ip || "unknown"}`;
}

/**
 * Prevents directory traversal in filenames
 */
export function sanitizeFilename(filename: string): string {
  return String(filename || "").replace(/[/\\?%*:|"<>]/g, "").replace(/\.\./g, "");
}
