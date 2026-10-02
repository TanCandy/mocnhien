/**
 * Mộc Nhiên — Google Sheets receiver for order sync.
 *
 * The backend (backend/services/sheetsSync.js) POSTs JSON here:
 *   upsert:      { secret, ...orderRow }                       (no `action`)
 *   delete:      { secret, action: "delete", orderCode, orderId }
 *   bulk upsert: { secret, action: "upsertMany", orders: [orderRow, ...] }
 *
 * Rows are keyed by order code. Only the columns listed in COLUMNS are
 * written — you can add your own columns (notes, formulas…) to the right and
 * they are left untouched. Don't rename the managed header cells.
 *
 * Setup: see integrations/google-sheets/README.md
 */

var SHEET_NAME = "Orders";

// [key sent by the backend, header shown in the sheet, kind]
var COLUMNS = [
  ["date", "Ngày", "date"],
  ["orderCode", "Mã đơn", "text"],
  ["staffName", "Nhân viên", "text"],
  ["productName", "Sản phẩm", "text"],
  ["productLink", "Link", "text"],
  ["warehouse", "Kho", "text"],
  ["customerName", "Khách hàng", "text"],
  ["contactType", "Loại liên hệ", "text"],
  ["contactValue", "Liên hệ", "text"],
  ["usd", "USD", "usd"],
  ["exchangeRate", "Tỷ giá", "number"],
  ["vnd", "Tổng VND", "number"],
  ["paidAmount", "Đã trả", "number"],
  ["paymentPercentage", "% trả", "number"],
  ["remainingAmount", "Còn lại", "number"],
  ["paymentStatus", "Thanh toán", "text"],
  ["status", "Trạng thái", "text"],
  ["trackingNumber", "USPS tracking", "text"],
  ["createdAt", "Tạo lúc", "datetime"],
  ["updatedAt", "Cập nhật lúc", "datetime"],
  ["orderId", "Order ID", "text"],
];

var FORMATS = {
  date: "dd/mm/yyyy",
  datetime: "dd/mm/yyyy hh:mm",
  number: "#,##0",
  usd: "#,##0.00",
  // text: no format — values get a leading apostrophe instead (see cellValue_)
};

function doGet() {
  // Lets you check the deployment URL in a browser.
  return json_({ ok: true, service: "moc-nhien-orders-sheet" });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ ok: false, error: "invalid JSON" });
  }

  var secret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
  if (!secret) return json_({ ok: false, error: "WEBHOOK_SECRET script property is not set" });
  if (body.secret !== secret) return json_({ ok: false, error: "unauthorized" });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return json_({ ok: false, error: "busy, retry" });
  try {
    var sheet = getSheet_();
    var cols = ensureHeaders_(sheet);

    if (body.action === "delete") {
      return json_({ ok: true, deleted: deleteRow_(sheet, cols, body) });
    }
    if (body.action === "upsertMany") {
      var result = upsertMany_(sheet, cols, body.orders || []);
      return json_({ ok: true, updated: result.updated, appended: result.appended });
    }
    var single = upsertMany_(sheet, cols, [body]);
    return json_({ ok: true, updated: single.updated, appended: single.appended });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

/** Map each managed key to its 1-based column, adding any missing headers on the right. */
function ensureHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  var header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var byHeader = {};
  for (var i = 0; i < header.length; i++) {
    if (header[i] !== "") byHeader[String(header[i]).trim()] = i + 1;
  }

  var cols = {};
  var next = header.length + 1;
  for (var c = 0; c < COLUMNS.length; c++) {
    var key = COLUMNS[c][0];
    var title = COLUMNS[c][1];
    var col = byHeader[title] || byHeader[key];
    if (!col) {
      col = next++;
      sheet.getRange(1, col).setValue(title).setFontWeight("bold");
      var format = FORMATS[COLUMNS[c][2]];
      if (format && sheet.getMaxRows() > 1) {
        sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setNumberFormat(format);
      }
    }
    cols[key] = col;
  }
  if (sheet.getFrozenRows() === 0) sheet.setFrozenRows(1);
  return cols;
}

function cellValue_(kind, key, row) {
  var v = row[key];
  if (kind === "date") {
    // Use the ISO timestamp so the sheet gets a real date regardless of locale.
    if (row.createdAt) return new Date(row.createdAt);
    return v || "";
  }
  if (kind === "datetime") return v ? new Date(v) : "";
  if (kind === "number" || kind === "usd") {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  if (v === undefined || v === null || v === "") return "";
  // Leading apostrophe keeps phone numbers' leading 0 and long tracking numbers intact.
  return "'" + String(v);
}

function writeRow_(sheet, rowIndex, cols, row) {
  var min = Infinity;
  var max = 0;
  for (var c = 0; c < COLUMNS.length; c++) {
    min = Math.min(min, cols[COLUMNS[c][0]]);
    max = Math.max(max, cols[COLUMNS[c][0]]);
  }

  if (max - min + 1 === COLUMNS.length) {
    // Managed columns are contiguous — write them in one call.
    var values = new Array(COLUMNS.length);
    for (var i = 0; i < COLUMNS.length; i++) {
      values[cols[COLUMNS[i][0]] - min] = cellValue_(COLUMNS[i][2], COLUMNS[i][0], row);
    }
    sheet.getRange(rowIndex, min, 1, COLUMNS.length).setValues([values]);
    return;
  }
  for (var j = 0; j < COLUMNS.length; j++) {
    sheet.getRange(rowIndex, cols[COLUMNS[j][0]]).setValue(cellValue_(COLUMNS[j][2], COLUMNS[j][0], row));
  }
}

function indexByOrderCode_(sheet, cols) {
  var index = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return index;
  var codes = sheet.getRange(2, cols.orderCode, lastRow - 1, 1).getValues();
  for (var i = 0; i < codes.length; i++) {
    var code = String(codes[i][0]).trim().replace(/^'/, "");
    if (code) index[code] = i + 2;
  }
  return index;
}

function upsertMany_(sheet, cols, rows) {
  var index = indexByOrderCode_(sheet, cols);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var updated = 0;
  var appended = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var code = String(row.orderCode || "").trim();
    if (!code) continue;
    var r = index[code];
    if (r) {
      updated++;
    } else {
      r = ++lastRow;
      index[code] = r;
      appended++;
      if (r > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    }
    writeRow_(sheet, r, cols, row);
  }
  return { updated: updated, appended: appended };
}

function deleteRow_(sheet, cols, body) {
  var code = String(body.orderCode || "").trim();
  var r = code ? indexByOrderCode_(sheet, cols)[code] : null;

  // Fallback: match on the order id column.
  if (!r && body.orderId && sheet.getLastRow() >= 2) {
    var ids = sheet.getRange(2, cols.orderId, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim().replace(/^'/, "") === String(body.orderId)) {
        r = i + 2;
        break;
      }
    }
  }
  if (!r) return false;
  sheet.deleteRow(r);
  return true;
}
