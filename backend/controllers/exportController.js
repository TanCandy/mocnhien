const ExcelJS = require("exceljs");
const { logger } = require("../config/logger");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const sheets = require("../services/sheetsSync");

const STATUSES = ["pending", "approved", "shipping", "delivered"];
const PAYMENT_STATUSES = ["pending", "paid"];
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const VND = '#,##0" ₫"';

/** Shared filter for export + resync: ?status=&paymentStatus=&from=YYYY-MM-DD&to=YYYY-MM-DD */
function buildOrderFilter(query) {
  const filter = {};
  if (STATUSES.includes(query.status)) filter.status = query.status;
  if (PAYMENT_STATUSES.includes(query.paymentStatus)) filter.paymentStatus = query.paymentStatus;

  // Dates are calendar days in Vietnam time.
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const createdAt = {};
  if (day.test(query.from || "")) createdAt.$gte = new Date(`${query.from}T00:00:00.000+07:00`);
  if (day.test(query.to || "")) createdAt.$lte = new Date(`${query.to}T23:59:59.999+07:00`);
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  return filter;
}

function stamp(date = new Date()) {
  // e.g. 20261002-1430 in Vietnam time
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3E5641" } };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

/** Sanitize values to prevent Excel Formula Injection (=, +, -, @, \t, \r) */
function sanitizeCellString(val) {
  if (typeof val !== "string") return val;
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

// ── Monthly "ĐƠN THÁNG n" sheets, laid out like the shop's Google Sheet ────────
// Layout, colours and number formats are copied from the "Tiền hàng MN" template:
//   row 1  block titles          row 2  column totals
//   row 3  column headers        row 4+ one order per row
const USD_FMT = "[$$]#,##0.00";
const VND_FMT = "#,##0 [$đ-42A]";
const MONEY_FMT = "#,##0.00";
const DATE_FMT = "dd/MM/yyyy";
const FONT = "Arial";
const SPARE_ROWS = 30; // styled empty rows after the data, for typing the PD/WEMC blocks by hand
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;

const COLORS = {
  cream: "FFFFF2CC",
  peach: "FFFCE5CD",
  green: "FF6AA84F",
  pink: "FFEA9999",
  blue: "FFCFE2F3",
  head: "FF356854",
  headDark: "FF274E13",
};

// fill: data-row background (null = white) · total: gets a SUM in row 2 · dark: darker header
const SHEET_COLUMNS = [
  { header: "Ngày", key: "date", width: 12, fill: "peach", fmt: DATE_FMT, center: true },
  { header: "Mã Đơn", key: "orderCode", width: 19, fill: "peach" },
  { header: "PAGE/SALE", key: "pageSale", width: 14, fill: "peach", list: "PAGE,SALE" },
  { header: "NƯỚC", key: "country", width: 14, fill: "peach", list: "Mỹ,ANH,ÚC,INDO,NHẬT,HÀN,SPAIN" },
  { header: "Tên Nhân Viên", key: "staffName", width: 16, fill: "peach" },
  { header: "Tên Sản Phẩm/link", key: "productName", width: 34, fill: "peach" },
  { header: "USD", key: "usd", width: 13, fill: "peach", fmt: USD_FMT, total: true },
  { header: "TỶ GIÁ", key: "exchangeRate", width: 12, fill: "peach", fmt: "#,##0.00 [$đ-42A]" },
  { header: "VND", key: "vnd", width: 15, fill: "peach", fmt: "#,##0", total: true, totalFmt: VND_FMT },
  { header: "CỌC", key: "paidAmount", width: 15, fill: "peach", fmt: VND_FMT, total: true },
  { header: "NỢ", key: "remainingAmount", width: 15, fill: "peach", fmt: VND_FMT, total: true, center: true },
  { header: "Phụ Thu", key: "surcharge", width: 13, fill: "peach", fmt: "#,##0.00 [$đ-42A]", total: true, dark: true },
  { header: "Số KG", key: "weightKg", width: 10, fill: "peach", fmt: MONEY_FMT, total: true, dark: true },
  { header: "TIỀN KG", key: "kgFee", width: 14, fill: "peach", fmt: "#,##0.00 [$đ-42A]", total: true, dark: true, center: true },
  { header: "Tỷ Giá Mua ", key: "buyRate", width: 15, fill: null, center: true },
  { header: "USD ", key: "buyUsd", width: 15, fill: null, fmt: USD_FMT, total: true, center: true },
  { header: "Tiền VND", key: "buyVnd", width: 15, fill: null, fmt: MONEY_FMT, total: true, center: true },
  { header: "Lời tỷ giá", key: "buyProfit", width: 14, fill: null, total: true, center: true },
  { header: "TỶ GIÁ 2", key: "wRate", width: 14, fill: "blue", fmt: VND_FMT },
  { header: "USD  2", key: "wUsd", width: 13.75, fill: "blue", fmt: USD_FMT, total: true },
  { header: "VND 2", key: "wVnd", width: 13.25, fill: "blue", fmt: VND_FMT, total: true },
  { header: "CỌC 2", key: "wDeposit", width: 13, fill: "blue", fmt: VND_FMT, total: true },
  { header: "CÒN NỢ", key: "wDebt", width: 13, fill: "blue", total: true },
  { header: "LỜI TỶ GIÁ", key: "wProfit", width: 13.6, fill: "blue", total: true },
  { header: "CK", key: "ck", width: 13.6, fill: null, center: true },
];
const COLUMN_COUNT = SHEET_COLUMNS.length;

// Row 1 / row 2 background per column (copied from the template).
const TITLE_FILL = (c) => {
  if (c <= 10) return COLORS.cream;
  if (c <= 13) return COLORS.peach;
  if (c <= 18) return COLORS.green;
  if (c <= 23) return COLORS.pink;
  return COLORS.cream;
};
const THIN = { style: "thin", color: { argb: "FF000000" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Calendar parts of an instant in Vietnam time. */
function vnParts(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(date).map((x) => [x.type, x.value])
  );
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

function colLetter(index) {
  let n = index;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildMonthSheet(wb, name, orders) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: HEADER_ROW }] });
  SHEET_COLUMNS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  // Row 1 — block titles
  ws.getRow(1).height = 37.5;
  for (let c = 1; c <= COLUMN_COUNT; c++) {
    const cell = ws.getCell(1, c);
    cell.fill = solid(TITLE_FILL(c));
    cell.font = { name: FONT, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  ws.getCell("A1").value = "KHÁCH BANK MUA HÀNG";
  ws.getCell("N1").value = "MUA HÀNG BÊN PD TIEUBANGSG/ TN-KH/Dieu";
  ws.getCell("R1").value = "MUA HÀNG BÊN WEMC ANH MẠNH ";
  ws.mergeCells("A1:I1");
  ws.mergeCells("L1:M1");
  ws.mergeCells("N1:Q1");
  ws.mergeCells("R1:W1");

  // Row 3 — headers
  ws.getRow(HEADER_ROW).height = 22.5;
  SHEET_COLUMNS.forEach((col, i) => {
    const cell = ws.getCell(HEADER_ROW, i + 1);
    cell.value = col.header;
    cell.fill = solid(col.dark ? COLORS.headDark : COLORS.head);
    cell.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
  });
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: COLUMN_COUNT } };

  // Rows 4+ — one order per row, oldest first (as in the template), then spare rows
  const sorted = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const totals = {};
  const lastRow = FIRST_DATA_ROW + sorted.length + SPARE_ROWS - 1;

  for (let r = FIRST_DATA_ROW; r <= lastRow; r++) {
    const order = sorted[r - FIRST_DATA_ROW];
    const row = order ? sheets.orderToRow(order) : null;
    ws.getRow(r).height = 22.5;
    SHEET_COLUMNS.forEach((col, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.font = { name: FONT };
      cell.alignment = { vertical: "middle", horizontal: col.center ? "center" : undefined };
      if (col.fill) cell.fill = solid(COLORS[col.fill]);
      if (col.fmt) cell.numFmt = col.fmt;
      cell.border = BORDER;
      if (col.list) cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${col.list}"`] };
      if (!row) return;

      let value;
      if (col.key === "date") {
        const { year, month, day } = vnParts(new Date(order.createdAt));
        value = new Date(Date.UTC(year, month - 1, day));
      } else if (col.key === "weightKg") {
        value = Number(order.weightKg) > 0 ? Number(order.weightKg) : null;
      } else if (col.key === "productName") {
        value = row.productName;
        if (row.productLink && /^https?:\/\//i.test(row.productLink)) {
          value = { text: row.productName || row.productLink, hyperlink: row.productLink };
        } else if (row.productLink) {
          value = `${row.productName} ${row.productLink}`.trim();
        }
      } else {
        value = row[col.key];
      }
      if (value === undefined || value === null || value === "") return;
      cell.value = typeof value === "string" ? sanitizeCellString(value) : value;
      if (col.total && typeof value === "number") totals[col.key] = (totals[col.key] || 0) + value;
    });
  }

  // Row 2 — totals for every numeric column (the PD/WEMC columns total what you type in)
  ws.getRow(2).height = 37.5;
  for (let c = 1; c <= COLUMN_COUNT; c++) {
    const col = SHEET_COLUMNS[c - 1];
    const cell = ws.getCell(2, c);
    cell.fill = solid(TITLE_FILL(c));
    cell.font = { name: FONT, bold: c <= 10 || (c >= 14 && c <= 23) };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    if (!col.total) continue;
    const letter = colLetter(c);
    cell.value = { formula: `SUM(${letter}${FIRST_DATA_ROW}:${letter}${lastRow})`, result: totals[col.key] || 0 };
    cell.numFmt = col.totalFmt || col.fmt || MONEY_FMT;
  }
  ws.getCell("A2").value = `Tổng (${sorted.length} đơn)`;
  ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
  return ws;
}

/** Group orders by Vietnam calendar month → [{ year, month, name, orders }], newest month first. */
function groupByMonth(orders, now = new Date()) {
  const groups = new Map();
  for (const order of orders) {
    const { year, month } = vnParts(new Date(order.createdAt || now));
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, { year, month, orders: [] });
    groups.get(key).orders.push(order);
  }
  if (groups.size === 0) {
    const { year, month } = vnParts(now);
    groups.set(`${year}-${String(month).padStart(2, "0")}`, { year, month, orders: [] });
  }
  const list = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([, g]) => g);
  const multiYear = new Set(list.map((g) => g.year)).size > 1;
  return list.map((g) => ({ ...g, name: multiYear ? `ĐƠN THÁNG ${g.month}-${g.year}` : `ĐƠN THÁNG ${g.month}` }));
}

function buildWorkbook(orders, payments) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moc Nhien";
  wb.created = new Date();

  for (const group of groupByMonth(orders)) buildMonthSheet(wb, group.name, group.orders);

  // ── Payments (bank transfers credited to these orders) ──────────────────
  const ps = wb.addWorksheet("Payments");
  ps.columns = [
    { header: "Thời gian", key: "when", width: 20 },
    { header: "Mã đơn", key: "orderCode", width: 20 },
    { header: "Số tiền", key: "amount", width: 16, style: { numFmt: VND } },
    { header: "Nội dung CK", key: "content", width: 40 },
    { header: "Ngân hàng", key: "gateway", width: 12 },
    { header: "Mã tham chiếu", key: "referenceCode", width: 18 },
    { header: "Gán thủ công", key: "manual", width: 12 },
  ];
  for (const p of payments) {
    ps.addRow({
      when: (p.transactionDate || p.createdAt)
        ? new Date(p.transactionDate || p.createdAt).toLocaleString("vi-VN", { timeZone: TIME_ZONE })
        : "",
      orderCode: sanitizeCellString(p.orderCode || ""),
      amount: p.amount,
      content: sanitizeCellString(p.content || ""),
      gateway: sanitizeCellString(p.gateway || ""),
      referenceCode: sanitizeCellString(p.referenceCode || ""),
      manual: p.assignedBy ? "Có" : "",
    });
  }
  styleHeader(ps);
  return wb;
}

// ============================================
// Admin — GET /api/orders/export(.xlsx)
// ============================================
async function exportOrders(req, res) {
  const filter = buildOrderFilter(req.query);
  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
  const orderIds = orders.map((o) => o._id);
  const payments = await Payment.find({ order: { $in: orderIds } }).select("-raw").sort({ createdAt: -1 }).lean();

  const wb = buildWorkbook(orders, payments);

  const filename = `orders-${stamp()}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  await wb.xlsx.write(res);
  res.end();

  logger.info({ count: orders.length, filter, by: String(req.user._id) }, "[ExportOrders] exported");
}

// ============================================
// Admin — POST /api/orders/sheets/resync
// Pushes every (filtered) order to the Google Sheet. Used to fill a freshly
// created sheet on a new server, or to repair drift.
// ============================================
async function resyncSheets(req, res) {
  const filter = buildOrderFilter(req.query);
  const orders = await Order.find(filter).sort({ createdAt: 1 }).lean();
  const result = await sheets.syncMany(orders);
  logger.info({ ...result, by: String(req.user._id) }, "[SheetsResync] done");
  return res.status(200).json({ message: `Synced ${result.sent} orders to Google Sheets.`, ...result });
}

module.exports = { exportOrders, resyncSheets, buildOrderFilter, buildWorkbook, groupByMonth };
