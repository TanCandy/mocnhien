// Renders a worksheet from an .xlsx to HTML (cell styles read from the file) and screenshots it.
// Used because no spreadsheet app (LibreOffice/Excel) is available to render the file directly.
const ExcelJS = require("D:/personal stuff/Side Job/mocnhien/backend/node_modules/exceljs");
const { chromium } = require("playwright-core");
const fs = require("fs");

const colorOf = (c, dflt) => (c && c.argb ? "#" + c.argb.slice(2) : dflt);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function fmt(cell) {
  let v = cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) v = v.result;
    else if ("formula" in v || "sharedFormula" in v) v = 0; // zero-total formulas carry no cached value
    else if ("text" in v) v = v.text;
    else if (v.richText) v = v.richText.map((r) => r.text).join("");
  }
  if (v === null || v === undefined || v === "") return "";
  const nf = cell.numFmt || "";
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  if (typeof v === "number") {
    if (nf.includes("$")) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (nf.includes("đ")) return v.toLocaleString("vi-VN") + " đ";
    if (/0\.0+/.test(nf)) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(v);
  }
  return String(v);
}

async function render(xlsx, sheetName, outPng, { rows = 16, title = "" } = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsx);
  const ws = wb.getWorksheet(sheetName);
  const nCols = Math.min(ws.columnCount, 25);
  const merged = {};
  const skip = new Set();
  for (const [, m] of Object.entries(ws._merges)) {
    const { top, left, bottom, right } = m.model;
    merged[`${top},${left}`] = { cs: right - left + 1, rs: bottom - top + 1 };
    for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) if (r !== top || c !== left) skip.add(`${r},${c}`);
  }
  let html = `<html><body style="margin:0;font-family:Arial;background:#fff"><div style="padding:6px 10px;font:bold 13px Arial;background:#222;color:#fff">${esc(title || sheetName)}</div><table style="border-collapse:collapse;table-layout:fixed;"><colgroup><col style="width:34px">`;
  for (let c = 1; c <= nCols; c++) html += `<col style="width:${Math.round((ws.getColumn(c).width || 9) * 7.2)}px">`;
  html += "</colgroup>";
  for (let r = 1; r <= rows; r++) {
    const row = ws.getRow(r);
    html += `<tr style="height:${Math.round((row.height || 15) * 1.33)}px"><td style="background:#f3f3f3;border:1px solid #ccc;font:11px Arial;text-align:center;color:#666">${r}</td>`;
    for (let c = 1; c <= nCols; c++) {
      if (skip.has(`${r},${c}`)) continue;
      const cell = row.getCell(c);
      const m = merged[`${r},${c}`];
      const f = cell.font || {};
      const al = cell.alignment || {};
      const bg = colorOf(cell.fill && cell.fill.fgColor, "#ffffff");
      const fg = colorOf(f.color, "#000000");
      html += `<td ${m ? `colspan="${m.cs}" rowspan="${m.rs}"` : ""} style="background:${bg};color:${fg};font:${f.bold ? "bold " : ""}${f.italic ? "italic " : ""}${Math.round((f.size || 10) * 1.2)}px ${f.name || "Arial"};border:1px solid #d0d0d0;padding:1px 4px;overflow:hidden;white-space:${al.wrapText ? "normal" : "nowrap"};text-align:${al.horizontal || (typeof (cell.value && cell.value.result !== undefined ? cell.value.result : cell.value) === "number" ? "right" : "left")};vertical-align:${al.vertical === "middle" ? "middle" : al.vertical || "bottom"}">${esc(fmt(cell))}</td>`;
    }
    html += "</tr>";
  }
  html += "</table></body></html>";
  const htmlPath = outPng.replace(/\.png$/, ".html");
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 2000, height: 700 }, deviceScaleFactor: 1 });
  await page.goto("file:///" + htmlPath.replace(/\\/g, "/"));
  const box = await page.evaluate(() => ({ w: document.querySelector("table").scrollWidth, h: document.body.scrollHeight }));
  await page.setViewportSize({ width: Math.min(box.w + 4, 2400), height: box.h + 4 });
  await page.screenshot({ path: outPng });
  await browser.close();
  fs.unlinkSync(htmlPath);
  console.log("wrote", outPng);
}

module.exports = { render };
if (require.main === module) {
  const [, , xlsx, sheet, png, rows, title] = process.argv;
  render(xlsx, sheet, png, { rows: Number(rows) || 16, title }).catch((e) => { console.error(e); process.exit(1); });
}
