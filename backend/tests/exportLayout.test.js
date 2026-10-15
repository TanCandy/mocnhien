import { describe, it, expect } from "vitest";
const ExcelJS = require("exceljs");
const { buildWorkbook, groupByMonth } = require("../controllers/exportController");

// Orders at fixed instants; Vietnam is UTC+7 so 2026-09-30T18:00Z is already 1 Oct there.
const orders = [
  {
    _id: "a1", orderCode: "ORD-SEP-1", createdAt: new Date("2026-09-10T03:00:00Z"),
    staffName: "Lan", productName: "Giày", productLink: "https://shop.example/giay",
    priceUSD: 100, exchangeRate: 25000, totalVND: 2500000, paidAmount: 1000000, weightKg: 2.5,
  },
  {
    _id: "a2", orderCode: "ORD-OCT-1", createdAt: new Date("2026-09-30T18:00:00Z"),
    staffName: "Minh", productName: "Túi", productLink: "",
    priceUSD: 40, exchangeRate: 25000, totalVND: 1000000, paidAmount: 0,
  },
  {
    _id: "a3", orderCode: "ORD-OCT-2", createdAt: new Date("2026-10-02T03:00:00Z"),
    staffName: "Lan", productName: "Áo", productLink: "not a url",
    priceUSD: 10, exchangeRate: 25000, totalVND: 250000, paidAmount: 250000,
  },
];

async function roundTrip(ords, payments = []) {
  const wb = buildWorkbook(ords, payments);
  const buf = await wb.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buf);
  return loaded;
}

describe("export layout (Google Sheet template)", () => {
  it("makes one 'ĐƠN THÁNG n' sheet per Vietnam month, newest first, then Payments", async () => {
    const wb = await roundTrip(orders);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["ĐƠN THÁNG 10", "ĐƠN THÁNG 9", "Payments"]);
  });

  it("puts the 30 Sep 18:00Z order in October (Vietnam time)", async () => {
    const wb = await roundTrip(orders);
    const oct = wb.getWorksheet("ĐƠN THÁNG 10");
    expect([oct.getCell("B4").value, oct.getCell("B5").value]).toEqual(["ORD-OCT-1", "ORD-OCT-2"]);
    expect(wb.getWorksheet("ĐƠN THÁNG 9").getCell("B4").value).toBe("ORD-SEP-1");
  });

  it("adds the year to sheet names when orders span several years", () => {
    const names = groupByMonth([
      { createdAt: new Date("2025-12-20T00:00:00Z") },
      { createdAt: new Date("2026-01-05T00:00:00Z") },
    ]).map((g) => g.name);
    expect(names).toEqual(["ĐƠN THÁNG 1-2026", "ĐƠN THÁNG 12-2025"]);
  });

  it("keeps the template's titles, merges and 25 headers in row 3", async () => {
    const ws = (await roundTrip(orders)).getWorksheet("ĐƠN THÁNG 10");
    expect(ws.getCell("A1").value).toBe("KHÁCH BANK MUA HÀNG");
    expect(ws.getCell("N1").value).toBe("MUA HÀNG BÊN PD TIEUBANGSG/ TN-KH/Dieu");
    expect(ws.getCell("R1").value).toBe("MUA HÀNG BÊN WEMC ANH MẠNH ");
    expect(Object.keys(ws._merges).sort()).toEqual(["A1", "L1", "N1", "R1"]);

    const headers = [];
    for (let c = 1; c <= 25; c++) headers.push(ws.getRow(3).getCell(c).value);
    expect(headers.slice(0, 14)).toEqual([
      "Ngày", "Mã Đơn", "PAGE/SALE", "NƯỚC", "Tên Nhân Viên", "Tên Sản Phẩm/link",
      "USD", "TỶ GIÁ", "VND", "CỌC", "NỢ", "Phụ Thu", "Số KG", "TIỀN KG",
    ]);
    expect(headers).toHaveLength(25);
    expect(headers[24]).toBe("CK");
  });

  it("freezes rows 1-3 and filters on the header row", async () => {
    const ws = (await roundTrip(orders)).getWorksheet("ĐƠN THÁNG 10");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
    expect(ws.autoFilter).toBeTruthy();
  });

  it("writes real dates, numbers and the template's colours/formats", async () => {
    const ws = (await roundTrip(orders)).getWorksheet("ĐƠN THÁNG 10");
    const date = ws.getCell("A4").value;
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe("2026-10-01T00:00:00.000Z"); // 1 Oct in Vietnam
    expect(ws.getCell("A4").numFmt).toBe("dd/MM/yyyy");
    expect(ws.getCell("E4").value).toBe("Minh");
    expect(ws.getCell("G4").value).toBe(40);
    expect(ws.getCell("G4").numFmt).toBe("[$$]#,##0.00");
    expect(ws.getCell("I4").value).toBe(1000000);
    expect(ws.getCell("J4").value).toBe(0);
    expect(ws.getCell("K4").value).toBe(1000000); // NỢ = remaining
    expect(ws.getCell("A4").fill.fgColor.argb).toBe("FFFCE5CD");
    expect(ws.getCell("A3").fill.fgColor.argb).toBe("FF356854");
    expect(ws.getCell("A1").fill.fgColor.argb).toBe("FFFFF2CC");
    expect(ws.getCell("N1").fill.fgColor.argb).toBe("FF6AA84F");
  });

  it("fills Số KG when the order has a weight, leaves manual columns empty", async () => {
    const ws = (await roundTrip(orders)).getWorksheet("ĐƠN THÁNG 9");
    expect(ws.getCell("M4").value).toBe(2.5);
    for (const addr of ["C4", "D4", "L4", "N4", "O4", "S4", "Y4"]) expect(ws.getCell(addr).value).toBeNull();
  });

  it("turns http(s) product links into hyperlinks and keeps other text as text", async () => {
    const wb = await roundTrip(orders);
    const link = wb.getWorksheet("ĐƠN THÁNG 9").getCell("F4").value;
    expect(link).toMatchObject({ text: "Giày", hyperlink: "https://shop.example/giay" });
    expect(wb.getWorksheet("ĐƠN THÁNG 10").getCell("F5").value).toBe("Áo not a url");
  });

  it("totals each money column in row 2 with a SUM formula and cached result", async () => {
    const ws = (await roundTrip(orders)).getWorksheet("ĐƠN THÁNG 10");
    expect(ws.getCell("A2").value).toBe("Tổng (2 đơn)");
    const usd = ws.getCell("G2").value;
    expect(usd.formula).toMatch(/^SUM\(G4:G\d+\)$/);
    expect(usd.result).toBe(50);
    expect(ws.getCell("I2").value.result).toBe(1250000);
    expect(ws.getCell("J2").value.result).toBe(250000);
    expect(ws.getCell("K2").value.result).toBe(1000000);
  });

  it("limits PAGE/SALE and NƯỚC to the template's dropdown lists", async () => {
    const ws = (await roundTrip(orders)).getWorksheet("ĐƠN THÁNG 10");
    expect(ws.getCell("C4").dataValidation.formulae[0]).toBe('"PAGE,SALE"');
    expect(ws.getCell("D4").dataValidation.formulae[0]).toContain("Mỹ");
  });

  it("still produces an openable empty template for the current month with zero orders", async () => {
    const wb = await roundTrip([]);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toHaveLength(2);
    expect(names[0]).toMatch(/^ĐƠN THÁNG \d{1,2}$/);
    expect(wb.worksheets[0].getCell("A2").value).toBe("Tổng (0 đơn)");
  });

  it("keeps the Payments sheet with its own header", async () => {
    const wb = await roundTrip(orders, [
      { orderCode: "ORD-OCT-1", amount: 500000, content: "ORDOCT1", gateway: "MB", referenceCode: "R1", createdAt: new Date("2026-10-02T03:00:00Z") },
    ]);
    const ps = wb.getWorksheet("Payments");
    expect(ps.getRow(1).getCell(1).value).toBe("Thời gian");
    expect(ps.getRow(2).getCell(2).value).toBe("ORD-OCT-1");
    expect(ps.getRow(2).getCell(3).value).toBe(500000);
  });
});
