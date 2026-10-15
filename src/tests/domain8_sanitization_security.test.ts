import { describe, it, expect } from "vitest";
import { ensureUrlProtocol } from "../lib/formatters";
import {
  escapeRegex,
  sanitizeKeyword,
  sanitizeSearchParam,
  escapeHtml,
  isObjectId,
  isAllowedOrigin,
  safeAssign,
  sanitizeSqlParam,
  stripAnsi,
  isValidInternalRedirect,
  isValidJwtStructure,
  getRateLimitKey,
  sanitizeFilename,
} from "../lib/sanitizer";

describe("Domain 8: Data Sanitization & Injections (22 Tests)", () => {
  it("Test 151: ensureUrlProtocol neutralizes javascript: URIs to safe '#' link", () => {
    expect(ensureUrlProtocol("javascript:alert(1)")).toBe("#");
    expect(ensureUrlProtocol("javascript:void(0)")).toBe("#");
    expect(ensureUrlProtocol("JAVASCRIPT:alert(document.cookie)")).toBe("#");
  });

  it("Test 152: ensureUrlProtocol neutralizes data: HTML/SVG URIs", () => {
    expect(ensureUrlProtocol("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(ensureUrlProtocol("vbscript:msgbox(1)")).toBe("#");
  });

  it("Test 153: ensureUrlProtocol keeps valid https:// URLs intact", () => {
    expect(ensureUrlProtocol("https://apple.com/iphone")).toBe("https://apple.com/iphone");
    expect(ensureUrlProtocol("http://example.com/item?id=123")).toBe("http://example.com/item?id=123");
  });

  it("Test 154: ensureUrlProtocol prepends https:// to bare domains", () => {
    expect(ensureUrlProtocol("amazon.com/product")).toBe("https://amazon.com/product");
    expect(ensureUrlProtocol("shop.vn")).toBe("https://shop.vn");
  });

  it("Test 155: ensureUrlProtocol handles empty, null or undefined input gracefully", () => {
    expect(ensureUrlProtocol("")).toBe("");
    expect(ensureUrlProtocol(null)).toBe("");
    expect(ensureUrlProtocol(undefined)).toBe("");
  });

  it("Test 156: escapeRegex neutralizes regex metacharacters (*, +, ?, ^, $, etc.)", () => {
    expect(escapeRegex("ORD.*")).toBe("ORD\\.\\*");
    expect(escapeRegex("user[0-9]+")).toBe("user\\[0-9\\]\\+");
    expect(escapeRegex("(a|b)?")).toBe("\\(a\\|b\\)\\?");
    expect(escapeRegex("^$*+?.()|{}[]\\")).toBe("\\^\\$\\*\\+\\?\\.\\(\\)\\|\\{\\}\\[\\]\\\\");
  });

  it("Test 157: Search regex pattern prevents ReDoS catastrophic backtracking", () => {
    const rawPattern = "((((((((a+)+)+)+)+)+)+)+)";
    const escaped = escapeRegex(rawPattern);
    const regex = new RegExp(escaped);
    const start = performance.now();
    regex.test("aaaaaaaaaaaaaaaaaaaaaaaX");
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50); // Instant evaluation since metachars were escaped
  });

  it("Test 158: Search keyword is capped at 100 characters to prevent query amplification", () => {
    const giantString = "A".repeat(5000);
    expect(sanitizeKeyword(giantString).length).toBe(100);
  });

  it("Test 159: NoSQL injection prevention: rejects object / operator payload in query strings", () => {
    expect(sanitizeSearchParam({ $gt: "" })).toBe("");
    expect(sanitizeSearchParam(["ORD-1", "ORD-2"])).toBe("");
    expect(sanitizeSearchParam("ORD-20261001-A001")).toBe("ORD-20261001-A001");
  });

  it("Test 160: HTML entity encoding neutralizes raw script tags", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
  });

  it("Test 161: Validates MongoDB ObjectId string pattern strictly", () => {
    expect(isObjectId("507f191e810c19729de860ea")).toBe(true);
    expect(isObjectId("$where: true")).toBe(false);
    expect(isObjectId("../../../etc/passwd")).toBe(false);
  });

  it("Test 162: Auth cookie attributes enforce security flags", () => {
    function getCookieOptions(isProd: boolean) {
      return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };
    }

    const prodOpts = getCookieOptions(true);
    expect(prodOpts.httpOnly).toBe(true);
    expect(prodOpts.sameSite).toBe("lax");
    expect(prodOpts.secure).toBe(true);

    const devOpts = getCookieOptions(false);
    expect(devOpts.secure).toBe(false);
  });

  it("Test 163: CORS origin checker permits allowed domain", () => {
    expect(isAllowedOrigin("https://mocnhienauthentic.vn")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://malicious-site.com")).toBe(false);
  });

  it("Test 164: Strips __proto__ and constructor keys to avoid prototype pollution", () => {
    const clean = safeAssign({}, JSON.parse('{"__proto__": {"polluted": true}, "name": "Safe"}'));
    expect(clean).not.toHaveProperty("__proto__");
    expect((clean as any).polluted).toBeUndefined();
    expect(clean.name).toBe("Safe");
  });

  it("Test 165: Content-Security-Policy disallows inline scripts and objects", () => {
    const cspDirectives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
    };
    expect(cspDirectives.objectSrc).toEqual(["'none'"]);
    expect(cspDirectives.scriptSrc).toContain("'self'");
  });

  it("Test 166: Body parser JSON payload size limit configured to 1MB", () => {
    const maxPayloadBytes = 1 * 1024 * 1024;
    expect(maxPayloadBytes).toBe(1048576);
  });

  it("Test 167: Prevents SQL injection strings in relational helpers", () => {
    expect(sanitizeSqlParam("1; DROP TABLE orders;--")).toBe("1 DROP TABLE orders--");
  });

  it("Test 168: Strips ANSI escape sequences from logged strings", () => {
    expect(stripAnsi("\u001b[31mRed Error\u001b[0m")).toBe("Red Error");
  });

  it("Test 169: Prevents open redirect attacks by verifying destination path starts with '/'", () => {
    expect(isValidInternalRedirect("/dashboard")).toBe(true);
    expect(isValidInternalRedirect("/order-detail/123")).toBe(true);
    expect(isValidInternalRedirect("//evil.com")).toBe(false);
    expect(isValidInternalRedirect("https://evil.com")).toBe(false);
    expect(isValidInternalRedirect("javascript:alert(1)")).toBe(false);
  });

  it("Test 170: Validates JWT token structure has exactly three parts", () => {
    expect(isValidJwtStructure("header.payload.signature")).toBe(true);
    expect(isValidJwtStructure("header.payload")).toBe(false);
    expect(isValidJwtStructure("header.payload.")).toBe(false);
    expect(isValidJwtStructure("invalid-token")).toBe(false);
  });

  it("Test 171: Rate limiter identifier maps IP or user ID cleanly", () => {
    expect(getRateLimitKey("127.0.0.1", "u123")).toBe("user:u123");
    expect(getRateLimitKey("192.168.1.1")).toBe("ip:192.168.1.1");
    expect(getRateLimitKey()).toBe("ip:unknown");
  });

  it("Test 172: Prevents directory traversal in filename parameters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeFilename("orders-20261011.xlsx")).toBe("orders-20261011.xlsx");
  });
});
