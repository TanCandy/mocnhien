const ExcelJS = require("exceljs");
const { logger } = require("../config/logger");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const sheets = require("../services/sheetsSync");

const STATUSES = ["pending", "approved", "shipping", "delivered"];
const PAYMENT_STATUSES = ["pending", "paid"];
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const VND = '#,##0" ₫"';
const USD = '"$"#,##0.00';

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

// ============================================
// Admin — GET /api/orders/export(.xlsx)
// ============================================
async function exportOrders(req, res) {
  const filter = buildOrderFilter(req.query);
  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
  const orderIds = orders.map((o) => o._id);
  const payments = await Payment.find({ order: { $in: orderIds } }).select("-raw").sort({ createdAt: -1 }).lean();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Moc Nhien";
  wb.created = new Date();

  // ── Orders ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Orders");
  ws.columns = [
    { header: "Ngày", key: "date", width: 12 },
    { header: "Mã đơn", key: "orderCode", width: 20 },
    { header: "Nhân viên", key: "staffName", width: 16 },
    { header: "Sản phẩm", key: "productName", width: 32 },
    { header: "Link", key: "productLink", width: 30 },
    { header: "Kho", key: "warehouse", width: 28 },
    { header: "Khách hàng", key: "customerName", width: 22 },
    { header: "Liên hệ", key: "contactValue", width: 24 },
    { header: "USD", key: "usd", width: 12, style: { numFmt: USD } },
    { header: "Tỷ giá", key: "exchangeRate", width: 10, style: { numFmt: "#,##0" } },
    { header: "Tổng VND", key: "vnd", width: 16, style: { numFmt: VND } },
    { header: "Đã trả", key: "paidAmount", width: 16, style: { numFmt: VND } },
    { header: "% trả", key: "paymentPercentage", width: 8 },
    { header: "Còn lại", key: "remainingAmount", width: 16, style: { numFmt: VND } },
    { header: "Thanh toán", key: "paymentStatus", width: 12 },
    { header: "Trạng thái", key: "status", width: 12 },
    { header: "USPS tracking", key: "trackingNumber", width: 22 },
    { header: "Tạo lúc (UTC)", key: "createdAt", width: 22 },
  ];
  for (const order of orders) {
    const row = sheets.orderToRow(order);
    const added = ws.addRow(row);
    if (row.productLink && /^https?:\/\//i.test(row.productLink)) {
      added.getCell("productLink").value = { text: row.productLink, hyperlink: row.productLink };
    }
  }
  if (orders.length > 0) {
    const first = 2;
    const last = orders.length + 1;
    const totals = ws.addRow({ orderCode: `Tổng (${orders.length} đơn)` });
    for (const key of ["vnd", "paidAmount", "remainingAmount"]) {
      const col = ws.getColumn(key).letter;
      totals.getCell(key).value = { formula: `SUM(${col}${first}:${col}${last})` };
    }
    totals.font = { bold: true };
  }
  styleHeader(ws);

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
      orderCode: p.orderCode || "",
      amount: p.amount,
      content: p.content,
      gateway: p.gateway,
      referenceCode: p.referenceCode,
      manual: p.assignedBy ? "Có" : "",
    });
  }
  styleHeader(ps);

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

module.exports = { exportOrders, resyncSheets, buildOrderFilter };
