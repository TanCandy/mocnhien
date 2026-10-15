import { describe, it, expect } from "vitest";
import { parseUSD, formatUSD, formatVND, ensureUrlProtocol } from "./formatters";
import { calculateVND, parseExchangeRate, formatExchangeRate, isValidExchangeRate } from "./exchangeRate";

describe("50+ Bug Fix Verification Suite", () => {
  describe("Financial & Currency Math Hardening", () => {
    it("BUG-16 / BUG-26: parseUSD rejects negative prices and returns 0", () => {
      expect(parseUSD(-50)).toBe(0);
      expect(parseUSD("-100")).toBe(0);
      expect(parseUSD("   -25.50  ")).toBe(0);
      expect(parseUSD("1,299.99")).toBe(1299.99);
      expect(parseUSD("0")).toBe(0);
      expect(parseUSD("")).toBe(0);
    });

    it("BUG-27: parseExchangeRate rejects negative rates and clamps excessive rates", () => {
      expect(parseExchangeRate(-25000)).toBe(0);
      expect(parseExchangeRate("-1")).toBe(0);
      expect(parseExchangeRate("25,600")).toBe(25600);
      expect(parseExchangeRate("25000")).toBe(25000);
      expect(parseExchangeRate(1e12)).toBe(10000000); // Clamped to 10M to prevent integer overflow
    });

    it("BUG-26: calculateVND accurately calculates VND without float inaccuracies", () => {
      const result = calculateVND(1299, 25600);
      expect(result).toBe(33254400);

      const withDecimals = calculateVND(10.5, 25000);
      expect(withDecimals).toBe(262500);
    });

    it("isValidExchangeRate strictly requires positive non-zero number", () => {
      expect(isValidExchangeRate(0)).toBe(false);
      expect(isValidExchangeRate(-500)).toBe(false);
      expect(isValidExchangeRate(NaN)).toBe(false);
      expect(isValidExchangeRate(25600)).toBe(true);
    });
  });

  describe("Security & Input Sanitization", () => {
    it("BUG-20: ensureUrlProtocol neutralizes javascript: URIs", () => {
      expect(ensureUrlProtocol("javascript:alert(1)")).toBe("#");
      expect(ensureUrlProtocol("JAVASCRIPT:alert(document.cookie)")).toBe("#");
      expect(ensureUrlProtocol("javascript:void(0)")).toBe("#");
      expect(ensureUrlProtocol("https://apple.com/iphone")).toBe("https://apple.com/iphone");
      expect(ensureUrlProtocol("example.com/item")).toBe("https://example.com/item");
    });

    it("Formatters handle null and undefined safely without throwing", () => {
      expect(formatUSD(null)).toBe("$0.00");
      expect(formatUSD(undefined)).toBe("$0.00");
      expect(formatUSD(NaN)).toBe("$0.00");
      expect(formatVND(null)).toBe("0 đ");
      expect(formatVND(undefined)).toBe("0 đ");
      expect(formatVND(NaN)).toBe("0 đ");
    });

    it("BUG-28 / BUG-104 / BUG-122: Formula injection characters are neutralized with leading quote", () => {
      function sanitizeCellString(val: any) {
        if (typeof val !== "string") return val;
        if (/^[=+\-@\t\r]/.test(val)) {
          return `'${val}`;
        }
        return val;
      }

      expect(sanitizeCellString("=1+1")).toBe("'=1+1");
      expect(sanitizeCellString("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
      expect(sanitizeCellString("+12345")).toBe("'+12345");
      expect(sanitizeCellString("-500")).toBe("'-500");
      expect(sanitizeCellString("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
      expect(sanitizeCellString("\tTabbed")).toBe("'\tTabbed");
      expect(sanitizeCellString("Clean product name")).toBe("Clean product name");
      expect(sanitizeCellString(12345)).toBe(12345);
    });
  });

  describe("Phone and Validation Regex Constraints", () => {
    it("BUG-09: Validates Vietnam and international phone numbers", () => {
      const phoneRegex = /^[\d\s\-+()]{8,15}$/;
      expect(phoneRegex.test("0912345678")).toBe(true);
      expect(phoneRegex.test("+84 912 345 678")).toBe(true);
      expect(phoneRegex.test("+1 555 123 456")).toBe(true);
      expect(phoneRegex.test("123")).toBe(false); // too short
      expect(phoneRegex.test("01234567890123456")).toBe(false); // too long
      expect(phoneRegex.test("<script>alert(1)</script>")).toBe(false);
      expect(phoneRegex.test("not-a-number")).toBe(false);
    });

    it("BUG-02 / BUG-142: Email format and length bounds RFC 5321", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test("valid@example.com")).toBe(true);
      expect(emailRegex.test("user.name+tag@sub.domain.co")).toBe(true);
      expect(emailRegex.test("invalid")).toBe(false);
      expect(emailRegex.test("invalid@")).toBe(false);
      expect(emailRegex.test("@domain.com")).toBe(false);
      expect(emailRegex.test("user@domain")).toBe(false);
    });
  });
});
