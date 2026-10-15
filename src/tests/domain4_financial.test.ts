import { describe, it, expect } from "vitest";
import { parseUSD, formatUSD, formatVND } from "../lib/formatters";
import { calculateVND, parseExchangeRate, formatExchangeRate, isValidExchangeRate } from "../lib/exchangeRate";

describe("Domain 4: Financial Precision & Monetary Integrity (22 Tests)", () => {
  it("Test 067: parseUSD accurately parses whole dollar amounts", () => {
    expect(parseUSD(100)).toBe(100);
    expect(parseUSD("100")).toBe(100);
  });

  it("Test 068: parseUSD accurately parses decimal cents", () => {
    expect(parseUSD("1299.99")).toBe(1299.99);
    expect(parseUSD("49.5")).toBe(49.5);
  });

  it("Test 069: parseUSD removes comma thousand separators", () => {
    expect(parseUSD("1,299.50")).toBe(1299.5);
    expect(parseUSD("10,000,000.00")).toBe(10000000);
  });

  it("Test 070: parseUSD clamps negative numbers to zero", () => {
    expect(parseUSD(-50)).toBe(0);
    expect(parseUSD("-999.99")).toBe(0);
  });

  it("Test 071: parseUSD returns 0 for empty or invalid strings", () => {
    expect(parseUSD("")).toBe(0);
    expect(parseUSD("abc")).toBe(0);
    expect(parseUSD(null)).toBe(0);
    expect(parseUSD(undefined)).toBe(0);
  });

  it("Test 072: parseExchangeRate parses standard VND rate", () => {
    expect(parseExchangeRate(25600)).toBe(25600);
    expect(parseExchangeRate("25,600")).toBe(25600);
  });

  it("Test 073: parseExchangeRate clamps negative rate to zero", () => {
    expect(parseExchangeRate(-25000)).toBe(0);
    expect(parseExchangeRate("-100")).toBe(0);
  });

  it("Test 074: parseExchangeRate clamps excessive rates to 10M to avoid integer overflow", () => {
    expect(parseExchangeRate(999999999999)).toBe(10000000);
  });

  it("Test 075: calculateVND accurately multiplies USD by exchange rate and rounds to integer", () => {
    expect(calculateVND(100, 25600)).toBe(2560000);
    expect(calculateVND(1299, 25600)).toBe(33254400);
  });

  it("Test 076: calculateVND handles decimal USD cents accurately", () => {
    expect(calculateVND(10.5, 25000)).toBe(262500);
    expect(calculateVND(0.99, 25000)).toBe(24750);
  });

  it("Test 077: calculateVND returns 0 when price or rate is zero or negative", () => {
    expect(calculateVND(0, 25600)).toBe(0);
    expect(calculateVND(100, 0)).toBe(0);
    expect(calculateVND(-10, 25600)).toBe(0);
  });

  it("Test 078: isValidExchangeRate returns true only for positive numbers", () => {
    expect(isValidExchangeRate(25600)).toBe(true);
    expect(isValidExchangeRate(0)).toBe(false);
    expect(isValidExchangeRate(-100)).toBe(false);
    expect(isValidExchangeRate(NaN)).toBe(false);
  });

  it("Test 079: formatExchangeRate produces standard localized Vietnamese dong string", () => {
    expect(formatExchangeRate(25600)).toBe("25.600 VND");
    expect(formatExchangeRate(25000)).toBe("25.000 VND");
  });

  it("Test 080: formatVND formats currency with Vietnamese locale and symbol", () => {
    expect(formatVND(1000000)).toMatch(/1\.000\.000.*₫/);
    expect(formatVND(0)).toMatch(/0.*₫/);
  });

  it("Test 081: formatVND gracefully handles null, undefined and NaN", () => {
    expect(formatVND(null)).toBe("0 đ");
    expect(formatVND(undefined)).toBe("0 đ");
    expect(formatVND(NaN)).toBe("0 đ");
  });

  it("Test 082: formatUSD formats standard USD currency with two decimal places", () => {
    expect(formatUSD(1299.99)).toBe("$1,299.99");
    expect(formatUSD(50)).toBe("$50.00");
    expect(formatUSD(0)).toBe("$0.00");
  });

  it("Test 083: formatUSD gracefully handles null, undefined and NaN", () => {
    expect(formatUSD(null)).toBe("$0.00");
    expect(formatUSD(undefined)).toBe("$0.00");
    expect(formatUSD(NaN)).toBe("$0.00");
  });

  it("Test 084: Payment percent computation never produces NaN or division by zero", () => {
    function computePaymentPercent(totalVND: number, paidAmount: number): number {
      if (!totalVND || totalVND <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round((paidAmount / totalVND) * 100)));
    }

    expect(computePaymentPercent(0, 500000)).toBe(0);
    expect(computePaymentPercent(1000000, 500000)).toBe(50);
    expect(computePaymentPercent(1000000, 1000000)).toBe(100);
    expect(computePaymentPercent(1000000, 2000000)).toBe(100); // capped at 100%
  });

  it("Test 085: Remaining amount calculation clamps at zero (no negative remaining)", () => {
    function computeRemaining(totalVND: number, paidAmount: number): number {
      return Math.max(0, totalVND - paidAmount);
    }

    expect(computeRemaining(1000000, 600000)).toBe(400000);
    expect(computeRemaining(1000000, 1000000)).toBe(0);
    expect(computeRemaining(1000000, 1500000)).toBe(0);
  });

  it("Test 086: Derived payment status flips to paid when paidAmount covers total", () => {
    function deriveStatus(totalVND: number, paidAmount: number) {
      if (totalVND > 0 && paidAmount >= totalVND) return "paid";
      return "pending";
    }

    expect(deriveStatus(2000000, 1999999)).toBe("pending");
    expect(deriveStatus(2000000, 2000000)).toBe("paid");
    expect(deriveStatus(2000000, 3000000)).toBe("paid");
  });

  it("Test 087: Partial payment maintains pending status until remaining balance is cleared", () => {
    function checkPartial(totalVND: number, paidAmount: number) {
      const remaining = Math.max(0, totalVND - paidAmount);
      return {
        isPartial: paidAmount > 0 && remaining > 0,
        status: remaining === 0 ? "paid" : "pending",
      };
    }

    const partial = checkPartial(10000000, 3000000);
    expect(partial.isPartial).toBe(true);
    expect(partial.status).toBe("pending");
  });

  it("Test 088: Currency conversion round-trip preserves precision for quotes", () => {
    const originalUSD = 250.75;
    const rate = 25400;
    const vnd = calculateVND(originalUSD, rate);
    const roundTripUSD = Math.round((vnd / rate) * 100) / 100;
    expect(Math.abs(roundTripUSD - originalUSD)).toBeLessThanOrEqual(0.01);
  });
});
