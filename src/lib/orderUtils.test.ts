import { describe, it, expect } from "vitest";
import {
  getWarehouseAddress,
  getMongoOrderId,
  resolveContactDisplay,
  computeOrderVND,
} from "./orderUtils";

describe("getWarehouseAddress", () => {
  it("prefers warehouseAddress when present", () => {
    expect(getWarehouseAddress({ warehouseAddress: " 123 Main St " })).toBe("123 Main St");
  });

  it("falls back to origin/destination pair", () => {
    expect(getWarehouseAddress({ origin: "USA", destination: "VN" })).toBe("USA → VN");
  });

  it("returns empty string when nothing is set", () => {
    expect(getWarehouseAddress({})).toBe("");
  });
});

describe("getMongoOrderId", () => {
  it("returns the _id when present", () => {
    expect(getMongoOrderId({ _id: "abc123" })).toBe("abc123");
  });

  it("throws when _id is missing", () => {
    expect(() => getMongoOrderId({})).toThrow(/Missing order _id/);
  });
});

describe("resolveContactDisplay", () => {
  it("shows 'No Contact' for none/NO_CONTACT", () => {
    expect(resolveContactDisplay("none", "")).toBe("No Contact");
    expect(resolveContactDisplay("email", "NO_CONTACT")).toBe("No Contact");
  });

  it("shows the raw value for phone/email", () => {
    expect(resolveContactDisplay("phone", "0123456789")).toBe("0123456789");
    expect(resolveContactDisplay("email", "a@b.com")).toBe("a@b.com");
  });

  it("falls back to an em dash for unknown/missing values", () => {
    expect(resolveContactDisplay(undefined, undefined)).toBe("—");
  });
});

describe("computeOrderVND", () => {
  it("computes VND from USD * exchangeRate when both are positive", () => {
    expect(computeOrderVND(10, 23000)).toBe(230000);
  });

  it("falls back to storedVND when USD or rate is missing", () => {
    expect(computeOrderVND(0, 23000, 500000)).toBe(500000);
    expect(computeOrderVND(10, 0, 500000)).toBe(500000);
  });

  it("returns 0 when nothing is available", () => {
    expect(computeOrderVND()).toBe(0);
  });
});
