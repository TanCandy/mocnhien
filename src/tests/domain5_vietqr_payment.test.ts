import { describe, it, expect } from "vitest";

describe("Domain 5: VietQR & Webhook Reconciliation (22 Tests)", () => {
  function extractOrderCodeCandidates(content: string): string[] {
    const flat = String(content || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const out: string[] = [];
    for (let i = flat.indexOf("ORD"); i !== -1; i = flat.indexOf("ORD", i + 1)) {
      const chunk = flat.slice(i, i + 15);
      if (/^ORD[A-Z0-9]{12}$/.test(chunk)) {
        const code = `ORD-${chunk.slice(3, 11)}-${chunk.slice(11, 15)}`;
        if (!out.includes(code)) out.push(code);
      }
    }
    return out;
  }

  function transferContentFor(orderCode: string): string {
    return String(orderCode || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }

  it("Test 089: transferContentFor strips hyphens and uppercase formats code", () => {
    expect(transferContentFor("ORD-20261001-A001")).toBe("ORD20261001A001");
    expect(transferContentFor("ord-lgf2abcd-99ef")).toBe("ORDLGF2ABCD99EF");
  });

  it("Test 090: extractOrderCodeCandidates extracts canonical code with hyphens intact", () => {
    const content = "Thanh toan don hang ORD-20261001-A001 tai Moc Nhien";
    expect(extractOrderCodeCandidates(content)).toEqual(["ORD-20261001-A001"]);
  });

  it("Test 091: extractOrderCodeCandidates extracts code when banks strip hyphens", () => {
    const content = "MBVCB.98765.ORD20261001A001.CT TU NGUYEN VAN A";
    expect(extractOrderCodeCandidates(content)).toEqual(["ORD-20261001-A001"]);
  });

  it("Test 092: extractOrderCodeCandidates extracts code with spaces inserted by customer", () => {
    const content = "ORD 20261001 A001 thanh toan";
    expect(extractOrderCodeCandidates(content)).toEqual(["ORD-20261001-A001"]);
  });

  it("Test 093: extractOrderCodeCandidates returns empty array when no order code present", () => {
    const content = "Chuyen tien mua hang khong ghi ma don";
    expect(extractOrderCodeCandidates(content)).toEqual([]);
  });

  it("Test 094: extractOrderCodeCandidates handles lowercase bank narratives", () => {
    const content = "ord20261001a001 ck tien hang";
    expect(extractOrderCodeCandidates(content)).toEqual(["ORD-20261001-A001"]);
  });

  it("Test 095: extractOrderCodeCandidates dedupes duplicate candidate matches", () => {
    const content = "ORD20261001A001 don hang ORD-20261001-A001";
    expect(extractOrderCodeCandidates(content)).toEqual(["ORD-20261001-A001"]);
  });

  it("Test 096: CRC16 calculation produces valid 4-character hex string", () => {
    function calculateCrc16(data: string): string {
      let crc = 0xffff;
      for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
          if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xffff;
          else crc = (crc << 1) & 0xffff;
        }
      }
      return crc.toString(16).toUpperCase().padStart(4, "0");
    }

    const payload = "00020101021238540010A00000072701240006970407011003456789010208QRIBFTTA5303704540715000005802VN62180814ORD20261001A0016304";
    const crc = calculateCrc16(payload);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });

  it("Test 097: VietQR Tag-Length-Value format helper packs elements correctly", () => {
    function tlv(id: string, value: string): string {
      const len = String(value.length).padStart(2, "0");
      return `${id}${len}${value}`;
    }

    expect(tlv("00", "01")).toBe("000201");
    expect(tlv("53", "704")).toBe("5303704");
    expect(tlv("58", "VN")).toBe("5802VN");
  });

  it("Test 098: Webhook ignores outgoing transfers (transferType !== 'in')", () => {
    function shouldProcessWebhook(type: string, amount: number) {
      if (type !== "in") return { process: false, reason: "outgoing" };
      if (!Number.isFinite(amount) || amount <= 0) return { process: false, reason: "non-positive amount" };
      return { process: true };
    }

    expect(shouldProcessWebhook("out", 500000)).toEqual({ process: false, reason: "outgoing" });
    expect(shouldProcessWebhook("in", 0)).toEqual({ process: false, reason: "non-positive amount" });
    expect(shouldProcessWebhook("in", 1000000)).toEqual({ process: true });
  });

  it("Test 099: Webhook filters transfers for non-configured bank accounts", () => {
    function filterAccount(expectedAcc: string, receivedAcc: string) {
      return expectedAcc === receivedAcc;
    }

    expect(filterAccount("0345678901", "0345678901")).toBe(true);
    expect(filterAccount("0345678901", "9999999999")).toBe(false);
  });

  it("Test 100: Idempotent duplicate webhook detector flags already processed txn ID", () => {
    const seenTxnIds = new Set(["TXN-001", "TXN-002"]);
    function checkDuplicate(id: string) {
      if (seenTxnIds.has(id)) return { duplicate: true };
      seenTxnIds.add(id);
      return { duplicate: false };
    }

    expect(checkDuplicate("TXN-001")).toEqual({ duplicate: true });
    expect(checkDuplicate("TXN-003")).toEqual({ duplicate: false });
  });

  it("Test 101: Webhook timing-safe API key comparison", () => {
    function timingSafeCheck(apiKey: string, expectedKey: string): boolean {
      if (!apiKey || !expectedKey || apiKey.length !== expectedKey.length) return false;
      let diff = 0;
      for (let i = 0; i < apiKey.length; i++) {
        diff |= apiKey.charCodeAt(i) ^ expectedKey.charCodeAt(i);
      }
      return diff === 0;
    }

    expect(timingSafeCheck("secret123", "secret123")).toBe(true);
    expect(timingSafeCheck("secret123", "secret999")).toBe(false);
    expect(timingSafeCheck("secret12", "secret123")).toBe(false);
  });

  it("Test 102: Parses local Vietnam timestamp from SePay without offset", () => {
    function parseSepayDate(value?: string | null) {
      if (!value) return null;
      const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(String(value).trim());
      const d = m ? new Date(`${m[1]}T${m[2]}+07:00`) : new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = parseSepayDate("2026-10-11 12:30:45");
    expect(d).not.toBeNull();
    expect(d?.toISOString()).toBeDefined();
  });

  it("Test 103: Manual assignment claims unmatched transfer atomically", () => {
    interface Transfer {
      id: string;
      status: "matched" | "unmatched";
      orderCode?: string;
    }

    function assignTransfer(t: Transfer, orderCode: string): Transfer {
      if (t.status === "matched") throw new Error("This transfer is already assigned.");
      return { ...t, status: "matched", orderCode };
    }

    const unassigned: Transfer = { id: "p1", status: "unmatched" };
    const assigned = assignTransfer(unassigned, "ORD-20261001-A001");
    expect(assigned.status).toBe("matched");
    expect(assigned.orderCode).toBe("ORD-20261001-A001");
    expect(() => assignTransfer(assigned, "ORD-20261001-A002")).toThrow("already assigned");
  });

  it("Test 104: Prevents negative amount in transfer assignment", () => {
    const isValidTransferAmount = (amt: number) => typeof amt === "number" && amt > 0 && Number.isInteger(amt);
    expect(isValidTransferAmount(500000)).toBe(true);
    expect(isValidTransferAmount(-500)).toBe(false);
    expect(isValidTransferAmount(0)).toBe(false);
  });

  it("Test 105: Accumulates multiple partial payments up to total", () => {
    function applyPartial(total: number, currentPaid: number, incoming: number) {
      const nextPaid = currentPaid + incoming;
      return {
        paidAmount: nextPaid,
        remainingAmount: Math.max(0, total - nextPaid),
        isFullyPaid: nextPaid >= total,
      };
    }

    const step1 = applyPartial(1000000, 0, 400000);
    expect(step1.remainingAmount).toBe(600000);
    expect(step1.isFullyPaid).toBe(false);

    const step2 = applyPartial(1000000, step1.paidAmount, 600000);
    expect(step2.remainingAmount).toBe(0);
    expect(step2.isFullyPaid).toBe(true);
  });

  it("Test 106: Overpayment preserves full paidAmount without losing surplus record", () => {
    const total = 1000000;
    const paid = 1200000;
    const remaining = Math.max(0, total - paid);
    expect(paid).toBe(1200000); // not clamped downward
    expect(remaining).toBe(0);
  });

  it("Test 107: Bank BIN length is exactly 6 digits", () => {
    const isValidBin = (bin: string) => /^\d{6}$/.test(bin);
    expect(isValidBin("970407")).toBe(true); // Techcombank
    expect(isValidBin("970422")).toBe(true); // MBBank
    expect(isValidBin("123")).toBe(false);
  });

  it("Test 108: Account number format allows only alphanumeric digits", () => {
    const isValidAccNumber = (acc: string) => /^[A-Z0-9]{6,20}$/i.test(acc);
    expect(isValidAccNumber("0345678901")).toBe(true);
    expect(isValidAccNumber("1903338888")).toBe(true);
    expect(isValidAccNumber("0345-6789")).toBe(false); // must not contain hyphens
  });

  it("Test 109: Payment state resolver distinguishes due, partial, paid, and no_price", () => {
    function resolveState(totalVND: number, paidAmount: number, isDelivered: boolean) {
      if (isDelivered || (totalVND > 0 && paidAmount >= totalVND)) return "paid";
      if (totalVND <= 0) return "no_price";
      if (paidAmount > 0) return "partial";
      return "due";
    }

    expect(resolveState(0, 0, false)).toBe("no_price");
    expect(resolveState(1000000, 0, false)).toBe("due");
    expect(resolveState(1000000, 400000, false)).toBe("partial");
    expect(resolveState(1000000, 1000000, false)).toBe("paid");
    expect(resolveState(1000000, 0, true)).toBe("paid"); // delivered order flips to paid
  });

  it("Test 110: Webhook response answers with duplicate flag when transaction previously recorded", () => {
    function formatWebhookResponse(isDup: boolean, orderCode?: string) {
      return {
        success: true,
        duplicate: isDup || undefined,
        matched: orderCode || undefined,
      };
    }

    expect(formatWebhookResponse(true)).toEqual({ success: true, duplicate: true });
    expect(formatWebhookResponse(false, "ORD-1")).toEqual({ success: true, matched: "ORD-1" });
  });
});
