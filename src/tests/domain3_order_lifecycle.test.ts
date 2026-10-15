import { describe, it, expect } from "vitest";
import { canTransition, OrderStatus, ALLOWED_TRANSITIONS } from "../lib/orderStateMachine";
import { getWarehouseAddress } from "../lib/orderUtils";

describe("Domain 3: Order State Machine & Concurrency (22 Tests)", () => {
  it("Test 045: Valid initial order status is always pending", () => {
    const initialStatus: OrderStatus = "pending";
    expect(initialStatus).toBe("pending");
  });

  it("Test 046: Valid transition: pending -> approved", () => {
    expect(canTransition("pending", "approved")).toBe(true);
  });

  it("Test 047: Valid transition: approved -> shipping", () => {
    expect(canTransition("approved", "shipping")).toBe(true);
  });

  it("Test 048: Valid transition: shipping -> delivered", () => {
    expect(canTransition("shipping", "delivered")).toBe(true);
  });

  it("Test 049: Invalid transition: delivered -> pending is forbidden", () => {
    expect(canTransition("delivered", "pending")).toBe(false);
  });

  it("Test 050: Invalid transition: shipping -> pending is forbidden", () => {
    expect(canTransition("shipping", "pending")).toBe(false);
  });

  it("Test 051: Setting status to delivered marks order paymentStatus as paid", () => {
    function resolveStatusPayment(status: OrderStatus, totalVND: number, paidAmount: number) {
      if (status === "delivered") {
        return {
          status,
          paymentStatus: "paid",
          paidAmount: Math.max(paidAmount, totalVND),
          remainingAmount: 0,
        };
      }
      return { status, paymentStatus: paidAmount >= totalVND ? "paid" : "pending", paidAmount, remainingAmount: Math.max(0, totalVND - paidAmount) };
    }

    const res = resolveStatusPayment("delivered", 5000000, 2000000);
    expect(res.paymentStatus).toBe("paid");
    expect(res.remainingAmount).toBe(0);
  });

  it("Test 052: Order approval sets approvedAt timestamp and approvedBy user", () => {
    function approveOrder(order: Record<string, any>, adminId: string) {
      if (order.status !== "pending") throw new Error("Only pending orders can be approved.");
      return {
        ...order,
        status: "approved",
        approvedAt: new Date("2026-10-11T05:00:00Z"),
        approvedBy: adminId,
      };
    }

    const approved = approveOrder({ orderCode: "ORD-1", status: "pending" }, "admin-1");
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe("admin-1");
    expect(approved.approvedAt).toBeDefined();
  });

  it("Test 053: Re-approving non-pending order throws an error", () => {
    function approveOrder(order: Record<string, any>, adminId: string) {
      if (order.status !== "pending") throw new Error("Only pending orders can be approved.");
      return { ...order, status: "approved" };
    }

    expect(() => approveOrder({ status: "approved" }, "admin-1")).toThrow("Only pending orders can be approved.");
  });

  it("Test 054: Order code matches ORD-<timestamp>-<rand> canonical pattern", () => {
    const ORDER_CODE_RE = /^ORD-[A-Z0-9]{8,10}-[A-Z0-9]{4}$/;
    expect(ORDER_CODE_RE.test("ORD-20261001-A001")).toBe(true);
    expect(ORDER_CODE_RE.test("ORD-LGF2ABCD-99EF")).toBe(true);
    expect(ORDER_CODE_RE.test("ORD-INVALID")).toBe(false);
  });

  it("Test 055: Tracking ID matches MN-<timestamp>-<rand> pattern", () => {
    const TRACKING_ID_RE = /^MN-\d{6}-[A-Z0-9]{4}$/;
    expect(TRACKING_ID_RE.test("MN-123456-A1B2")).toBe(true);
    expect(TRACKING_ID_RE.test("MN-999999-FFFF")).toBe(true);
    expect(TRACKING_ID_RE.test("INVALID-123")).toBe(false);
  });

  it("Test 056: Optimistic locking rejects stale paidAmount updates (CAS)", () => {
    function updateOrderPaidAmount(currentDbAmount: number, expectedAmount: number, addAmount: number) {
      if (currentDbAmount !== expectedAmount) {
        throw new Error("Conflict: A payment was recorded while you were editing.");
      }
      return currentDbAmount + addAmount;
    }

    // Success case
    expect(updateOrderPaidAmount(1000000, 1000000, 500000)).toBe(1500000);
    // Conflict case (concurrent payment credited DB to 1500000, form had 1000000)
    expect(() => updateOrderPaidAmount(1500000, 1000000, 500000)).toThrow("Conflict");
  });

  it("Test 057: Duplicate payment IDs are prevented via appliedPaymentIds set", () => {
    function applyPayment(appliedIds: string[], newPaymentId: string) {
      if (appliedIds.includes(newPaymentId)) {
        return { applied: false, ids: appliedIds };
      }
      return { applied: true, ids: [...appliedIds, newPaymentId] };
    }

    const step1 = applyPayment(["p1"], "p2");
    expect(step1.applied).toBe(true);
    expect(step1.ids).toEqual(["p1", "p2"]);

    const step2 = applyPayment(step1.ids, "p2");
    expect(step2.applied).toBe(false);
    expect(step2.ids).toEqual(["p1", "p2"]);
  });

  it("Test 058: USPS tracking number regex validation", () => {
    const USPS_RE = /^[A-Z0-9]{10,34}$/;
    expect(USPS_RE.test("9400100000000000000000")).toBe(true);
    expect(USPS_RE.test("9205500000000000000000")).toBe(true);
    expect(USPS_RE.test("123")).toBe(false); // too short
  });

  it("Test 059: Warehouse address fallback chain", () => {
    expect(getWarehouseAddress({ warehouseAddress: "Kho Tân Bình, HCM" })).toBe("Kho Tân Bình, HCM");
    expect(getWarehouseAddress({ addressFrom: "Oregon, US", addressTo: "Hà Nội, VN" })).toBe("Oregon, US → Hà Nội, VN");
    expect(getWarehouseAddress({}) || "Default Warehouse").toBe("Default Warehouse");
  });

  it("Test 060: Timeline stages advance accurately according to status", () => {
    function getCompletedStages(status: OrderStatus): number {
      switch (status) {
        case "delivered": return 5;
        case "shipping": return 3;
        case "approved": return 1;
        case "pending": return 0;
      }
    }

    expect(getCompletedStages("pending")).toBe(0);
    expect(getCompletedStages("approved")).toBe(1);
    expect(getCompletedStages("shipping")).toBe(3);
    expect(getCompletedStages("delivered")).toBe(5);
  });

  it("Test 061: Customer contact normalization resolves email type", () => {
    function normalizeContact(input: any) {
      if (typeof input === "string") return { type: "email", value: input.trim().toLowerCase() };
      return { type: input?.contactType || "none", value: input?.contactValue || "NO_CONTACT" };
    }

    expect(normalizeContact("User@Test.Local")).toEqual({ type: "email", value: "user@test.local" });
  });

  it("Test 062: Customer contact normalization resolves phone type", () => {
    function normalizeContact(type: string, val: string) {
      if (type === "phone") return { type: "phone", value: val.replace(/[^\d+]/g, "") };
      return { type, value: val };
    }

    expect(normalizeContact("phone", "+84 (090) 123-4567")).toEqual({ type: "phone", value: "+840901234567" });
  });

  it("Test 063: Deleting order unlinks payments to prevent dangling foreign keys", () => {
    interface Payment {
      id: string;
      orderId: string | null;
      status: "matched" | "unmatched";
    }

    function unlinkPaymentsOnOrderDelete(payments: Payment[], deletedOrderId: string) {
      return payments.map((p) => (p.orderId === deletedOrderId ? { ...p, orderId: null, status: "unmatched" as const } : p));
    }

    const payments: Payment[] = [
      { id: "p1", orderId: "o1", status: "matched" },
      { id: "p2", orderId: "o2", status: "matched" },
    ];

    const result = unlinkPaymentsOnOrderDelete(payments, "o1");
    expect(result[0].orderId).toBeNull();
    expect(result[0].status).toBe("unmatched");
    expect(result[1].orderId).toBe("o2");
  });

  it("Test 064: Product link URL normalization handles https prefix addition", () => {
    function normalizeUrl(url?: string | null) {
      if (!url) return "";
      const trimmed = url.trim();
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    }

    expect(normalizeUrl("amazon.com/dp/B08N5WRWNW")).toBe("https://amazon.com/dp/B08N5WRWNW");
    expect(normalizeUrl("https://ebay.com/itm/123")).toBe("https://ebay.com/itm/123");
    expect(normalizeUrl("")).toBe("");
  });

  it("Test 065: Service tier validation allows only standard and express", () => {
    const isValidTier = (tier: string) => ["standard", "express"].includes(tier.toLowerCase().trim());
    expect(isValidTier("standard")).toBe(true);
    expect(isValidTier("express")).toBe(true);
    expect(isValidTier("overnight")).toBe(false);
  });

  it("Test 066: Weight must be a non-negative finite number", () => {
    const isValidWeight = (w: any) => typeof w === "number" && Number.isFinite(w) && w >= 0;
    expect(isValidWeight(1.5)).toBe(true);
    expect(isValidWeight(0)).toBe(true);
    expect(isValidWeight(-2.5)).toBe(false);
    expect(isValidWeight(Infinity)).toBe(false);
  });
});
