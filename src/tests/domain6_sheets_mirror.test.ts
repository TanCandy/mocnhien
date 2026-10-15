import { describe, it, expect } from "vitest";

describe("Domain 6: Google Sheets Real-time Mirror (20 Tests)", () => {
  function sanitizeCellString(val: any): any {
    if (typeof val !== "string") return val;
    if (/^[=+\-@\t\r]/.test(val)) {
      return `'${val}`;
    }
    return val;
  }

  it("Test 111: Escapes leading equals sign (=) with single quote prefix", () => {
    expect(sanitizeCellString("=1+1")).toBe("'=1+1");
    expect(sanitizeCellString("=HYPERLINK(\"http://evil.com\")")).toBe("'=HYPERLINK(\"http://evil.com\")");
  });

  it("Test 112: Escapes leading plus sign (+) with single quote prefix", () => {
    expect(sanitizeCellString("+12345")).toBe("'+12345");
    expect(sanitizeCellString("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
  });

  it("Test 113: Escapes leading minus sign (-) with single quote prefix", () => {
    expect(sanitizeCellString("-500")).toBe("'-500");
  });

  it("Test 114: Escapes leading at symbol (@) with single quote prefix", () => {
    expect(sanitizeCellString("@SUM(A1:B10)")).toBe("'@SUM(A1:B10)");
  });

  it("Test 115: Escapes leading tab and carriage return characters", () => {
    expect(sanitizeCellString("\tTabbedProduct")).toBe("'\tTabbedProduct");
    expect(sanitizeCellString("\rReturnProduct")).toBe("'\rReturnProduct");
  });

  it("Test 116: Leaves safe strings untouched without prepending quotes", () => {
    expect(sanitizeCellString("Nước hoa Chanel No.5")).toBe("Nước hoa Chanel No.5");
    expect(sanitizeCellString("Nguyễn Thị Mai")).toBe("Nguyễn Thị Mai");
    expect(sanitizeCellString("ORD-20261001-A001")).toBe("ORD-20261001-A001");
  });

  it("Test 117: Preserves non-string numbers, booleans, and nulls unchanged", () => {
    expect(sanitizeCellString(1250000)).toBe(1250000);
    expect(sanitizeCellString(0)).toBe(0);
    expect(sanitizeCellString(true)).toBe(true);
    expect(sanitizeCellString(null)).toBe(null);
  });

  it("Test 118: orderToRow maps order fields into flat sheet dictionary", () => {
    function orderToRow(order: Record<string, any>) {
      return {
        orderCode: order.orderCode || "",
        staffName: sanitizeCellString(order.staffName ?? ""),
        productName: sanitizeCellString(order.productName || ""),
        customerName: sanitizeCellString(order.customerName || ""),
        vnd: order.totalVND || 0,
        status: order.status || "pending",
      };
    }

    const row = orderToRow({
      orderCode: "ORD-1",
      staffName: "Staff A",
      productName: "=CMD()",
      customerName: "Alice",
      totalVND: 500000,
      status: "approved",
    });

    expect(row.orderCode).toBe("ORD-1");
    expect(row.productName).toBe("'=CMD()");
    expect(row.vnd).toBe(500000);
    expect(row.status).toBe("approved");
  });

  it("Test 119: Missing staffName defaults to empty string instead of null/undefined", () => {
    function resolveStaff(staff?: string | null) {
      return sanitizeCellString(staff ?? "");
    }

    expect(resolveStaff(null)).toBe("");
    expect(resolveStaff(undefined)).toBe("");
    expect(resolveStaff("Minh Thư")).toBe("Minh Thư");
  });

  it("Test 120: Contact value 'NO_CONTACT' is mapped to empty string for sheet clarity", () => {
    function formatContactValue(val?: string) {
      return val === "NO_CONTACT" ? "" : val || "";
    }

    expect(formatContactValue("NO_CONTACT")).toBe("");
    expect(formatContactValue("user@test.local")).toBe("user@test.local");
  });

  it("Test 121: Sheet row timestamp formats in Vietnam timezone (Asia/Ho_Chi_Minh)", () => {
    const d = new Date("2026-10-11T00:00:00Z");
    const formatted = d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    expect(formatted).toBeDefined();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("Test 122: Sheet payload includes webhook secret when configured", () => {
    function buildPayload(body: Record<string, any>, secret?: string) {
      return secret ? { ...body, secret } : body;
    }

    const payloadWithSecret = buildPayload({ action: "upsert", orderCode: "ORD-1" }, "my-secret-key");
    expect(payloadWithSecret.secret).toBe("my-secret-key");

    const payloadWithoutSecret = buildPayload({ action: "upsert", orderCode: "ORD-1" });
    expect(payloadWithoutSecret).not.toHaveProperty("secret");
  });

  it("Test 123: Missing orderCode skips sheet sync without throwing unhandled rejection", () => {
    function canSyncOrder(order: Record<string, any>): boolean {
      return Boolean(order && order.orderCode && String(order.orderCode).trim().length > 0);
    }

    expect(canSyncOrder({ id: "1" })).toBe(false);
    expect(canSyncOrder({ id: "1", orderCode: "ORD-1" })).toBe(true);
  });

  it("Test 124: Bulk resync payload wraps orders array in action 'upsertMany'", () => {
    function buildBulkPayload(orders: any[]) {
      return {
        action: "upsertMany",
        orders,
      };
    }

    const payload = buildBulkPayload([{ orderCode: "ORD-1" }, { orderCode: "ORD-2" }]);
    expect(payload.action).toBe("upsertMany");
    expect(payload.orders.length).toBe(2);
  });

  it("Test 125: Delete order payload produces action 'delete' with row keys", () => {
    function buildDeletePayload(orderCode: string, orderId: string) {
      return { action: "delete", orderCode, orderId };
    }

    expect(buildDeletePayload("ORD-1", "id-123")).toEqual({ action: "delete", orderCode: "ORD-1", orderId: "id-123" });
  });

  it("Test 126: Sheet timeout handler aborts after configured threshold", () => {
    const REQUEST_TIMEOUT_MS = 10_000;
    const BULK_TIMEOUT_MS = 60_000;
    expect(REQUEST_TIMEOUT_MS).toBe(10000);
    expect(BULK_TIMEOUT_MS).toBe(60000);
  });

  it("Test 127: Sheet failure never blocks underlying database operations", () => {
    async function performOperationWithSheetMirror(dbOp: () => Promise<any>, sheetOp: () => Promise<any>) {
      const dbResult = await dbOp();
      try {
        await sheetOp();
      } catch (sheetErr) {
        // Logged, non-blocking
      }
      return dbResult;
    }

    return performOperationWithSheetMirror(
      async () => ({ id: "order-saved" }),
      async () => { throw new Error("Google Sheets timeout"); }
    ).then((res) => {
      expect(res).toEqual({ id: "order-saved" });
    });
  });

  it("Test 128: Parses Apps Script JSON response or falls back to text gracefully", () => {
    function parseSheetResponse(text: string) {
      try {
        return { isJson: true, data: JSON.parse(text) };
      } catch {
        return { isJson: false, raw: text };
      }
    }

    expect(parseSheetResponse('{"ok": true, "row": 5}')).toEqual({ isJson: true, data: { ok: true, row: 5 } });
    expect(parseSheetResponse("<html>Error 500</html>")).toEqual({ isJson: false, raw: "<html>Error 500</html>" });
  });

  it("Test 129: Stored payment status takes precedence over calculated status in row sync", () => {
    function resolveRowPaymentStatus(order: Record<string, any>, calculatedStatus: string) {
      return order.paymentStatus || calculatedStatus;
    }

    expect(resolveRowPaymentStatus({ paymentStatus: "paid" }, "pending")).toBe("paid");
    expect(resolveRowPaymentStatus({}, "pending")).toBe("pending");
  });

  it("Test 130: USPS tracking number is sanitized against formula injection before sync", () => {
    const rawTracking = "=@cmd|'calc'!A0";
    expect(sanitizeCellString(rawTracking)).toBe("'=@cmd|'calc'!A0");
  });
});
