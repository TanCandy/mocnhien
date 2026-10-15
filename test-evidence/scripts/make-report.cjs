// Builds test-evidence/REPORT.html from the logs/JSON, then prints REPORT.pdf with headless Chrome.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const OUT = "D:/personal stuff/Side Job/mocnhien/test-evidence";
const sweep = require(OUT + "/logs/sweep-results.json");
const flows = require(OUT + "/logs/flows-results.json");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const img = (f, cap, cls = "") => `<figure class="${cls}"><img src="screenshots/${f}"><figcaption>${esc(cap)}</figcaption></figure>`;

const WHO = { anon: "Khách vãng lai", "anon-guard": "Vãng lai → trang cần đăng nhập", customer: "Khách hàng (đã đăng nhập)", "customer-guard": "Khách hàng → trang admin", admin: "Admin" };

// Group sweep rows by who+route, desktop & mobile side by side
const groups = new Map();
for (const r of sweep) {
  const k = r.who + "|" + r.route;
  if (!groups.has(k)) groups.set(k, { who: r.who, route: r.route });
  groups.get(k)[r.vp] = r;
}
const note = (r) => {
  const n = [];
  if (r.failed.length) n.push(`${new Set(r.failed).size} lỗi HTTP (${[...new Set(r.failed.map((x) => x.split(" ").slice(0, 3).join(" ")))].join(", ")})`);
  if (r.hOverflow) n.push("tràn ngang");
  return n.join("; ") || "—";
};
const routeRows = [...groups.values()]
  .map((g) => {
    const d = g.desktop, m = g.mobile;
    let verdict = "OK", cls = "ok";
    if (g.route === "/this-page-does-not-exist") { verdict = "Lưu ý: không có trang 404 (trắng)"; cls = "warn"; }
    else if (g.who === "anon-guard" && g.route === "/dashboard") { verdict = "LỖI: không chặn khách vãng lai"; cls = "bad"; }
    else if (g.route.startsWith("/order-detail")) { verdict = "Lưu ý: hiện dữ liệu mock cố định"; cls = "warn"; }
    else if (g.route === "/calculator") { verdict = "Lưu ý: giống trang chủ, chưa có UI tính giá"; cls = "warn"; }
    else if (g.who === "anon" || g.who === "anon-guard") { verdict = "OK (401 /api/user/profile là bình thường khi chưa đăng nhập)"; }
    return `<tr class="${cls}"><td>${esc(WHO[g.who])}</td><td><code>${esc(g.route.replace(/6abfe[0-9a-f]+/, ":id"))}</code></td><td><code>${esc(d.finalPath.replace(/6abfe[0-9a-f]+/, ":id"))}</code></td><td>${d.hOverflow ? "✗" : "✓"} / ${m.hOverflow ? "✗" : "✓"}</td><td>${esc(verdict)}</td></tr>`;
  })
  .join("\n");

const flowRows = flows
  .map((f, i) => `<tr class="${f.pass ? "ok" : "bad"}"><td>${i + 1}</td><td>${esc(f.name)}</td><td class="c">${f.pass ? "PASS" : "FAIL"}</td><td>${esc(f.detail)}</td></tr>`)
  .join("\n");
const passed = flows.filter((f) => f.pass).length;

const HEAD = { "anon|/": "Trang chủ", "anon|/calculator": "Calculator", "anon|/tracking": "Tracking", "anon|/support": "Support", "anon|/login": "Đăng nhập", "anon|/register": "Đăng ký", "anon|/forgot-password": "Quên mật khẩu", "anon|/reset-password": "Đặt lại mật khẩu", "anon|/this-page-does-not-exist": "URL không tồn tại (kiểm tra 404)", "anon-guard|/dashboard": "Vãng lai mở /dashboard", "anon-guard|/profile": "Vãng lai mở /profile → bị chuyển /login", "anon-guard|/admin/orders": "Vãng lai mở /admin/orders → bị chuyển /login", "customer|/": "Trang chủ", "customer|/dashboard": "Dashboard khách", "customer|/profile": "Profile", "customer|/tracking": "Tracking", "customer|/support": "Support", "customer-guard|/admin/orders": "Khách mở /admin/orders → bị đưa về trang chủ", "admin|/admin/dashboard": "Admin Dashboard", "admin|/admin/orders": "Admin → Manage Orders", "admin|/admin/payments": "Admin → Payments", "admin|/profile": "Admin → Profile" };
const gallery = [...groups.values()].map((g) => {
  const d = g.desktop, m = g.mobile;
  const isOD = g.route.startsWith("/order-detail");
  const title = isOD ? "Chi tiết đơn (/order-detail/:id)" : HEAD[g.who + "|" + g.route] || g.route;
  const cls = g.route === "/this-page-does-not-exist" || isOD || g.route === "/calculator" ? "warn" : g.who === "anon-guard" && g.route === "/dashboard" ? "bad" : "";
  return `<div class="pair ${cls}"><div class="d"><h4><span class="tag">${esc(WHO[g.who])}</span>${esc(title)}</h4><img src="screenshots/${d.file}"><div class="cap">Desktop 1366×850 · ${esc(d.route.replace(/6abfe[0-9a-f]+/, ":id"))} → ${esc(d.finalPath.replace(/6abfe[0-9a-f]+/, ":id"))}</div></div><div class="m"><h4>&nbsp;</h4><img src="screenshots/${m.file}"><div class="cap">Mobile 375×812</div></div></div>`;
}).join("");

const STEP = {
  "flow-01-login-wrong-password.png": "Đăng nhập sai mật khẩu → ở lại /login, báo lỗi",
  "flow-02-register-filled.png": "Đăng ký tài khoản mới: form đã điền",
  "flow-03-register-result.png": "Kết quả sau đăng ký",
  "flow-04-customer-dashboard.png": "Dashboard khách sau đăng nhập",
  "flow-05-create-order-modal-filled.png": "Form tạo đơn đã điền (899 USD)",
  "flow-06-create-order-success.png": "Tạo đơn thành công: totalVND = 899 × 25.600 = 23.014.400",
  "flow-06b-create-order-price-1299.png": "LỖI: nhập 1,299 USD → đơn lưu giá 1 USD (25.600 đ)",
  "flow-07-customer-payment-qr.png": "Mã QR VietQR thanh toán trên dashboard khách",
  "flow-08-admin-payments.png": "Admin → Payments: giao dịch webhook & Unmatched",
  "flow-09-admin-orders.png": "Admin → Manage Orders: thấy đơn của khách",
  "flow-10-admin-after-approve.png": "Admin duyệt đơn → status approved",
  "flow-11-admin-export-clicked.png": "Admin bấm Export Excel → tải orders-….xlsx",
};
const flowGallery = '<div class="steps">' + Object.entries(STEP).map(([f, c], i) => `<figure><img src="screenshots/${f}"><figcaption><b>Bước ${i + 1}.</b> ${esc(c)}</figcaption></figure>`).join("") + "</div>";

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo kiểm thử — Mộc Nhiên Authentic</title>
<style>
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 "Segoe UI", Arial, sans-serif; color: #222; }
h1 { font-size: 22pt; margin: 0 0 4px; color: #356854; }
h2 { font-size: 14pt; margin: 22px 0 8px; padding-bottom: 3px; border-bottom: 2px solid #356854; color: #274e13; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 14px 0 6px; break-after: avoid; }
.sub { color: #666; margin-bottom: 14px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 9pt; }
th, td { border: 1px solid #ccc; padding: 3px 6px; vertical-align: top; text-align: left; }
th { background: #356854; color: #fff; }
tr { break-inside: avoid; }
tr.ok td:last-child, tr.ok td.c { }
tr.warn { background: #fff8e1; } tr.bad { background: #fdecea; }
td.c { text-align: center; font-weight: 700; }
tr.ok td.c { color: #1b7a3d; } tr.bad td.c { color: #b3261e; }
code { background: #f2f2f2; padding: 0 3px; border-radius: 3px; font-size: 9pt; }
.cards { display: flex; gap: 8px; margin: 10px 0; }
.card { flex: 1; border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; text-align: center; }
.card b { display: block; font-size: 18pt; color: #356854; }
.card.bad b { color: #b3261e; }
figure { margin: 8px 0; break-inside: avoid; }
figure img { width: 100%; border: 1px solid #ccc; }
figcaption { font-size: 8.5pt; color: #555; margin-top: 2px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.grid2 figure img, .grid3 figure img { height: 75mm; object-fit: cover; object-position: top; }
.tall img { height: 90mm; object-fit: cover; object-position: top; }
.pair { display: flex; gap: 8px; align-items: flex-start; margin: 6px 0 12px; break-inside: avoid; }
.pair .d { flex: 2.3; } .pair .m { flex: 1; }
.pair h4 { margin: 8px 0 2px; font-size: 10pt; color: #274e13; break-after: avoid; }
.pair img { width: 100%; height: 88mm; object-fit: cover; object-position: top; border: 1px solid #ccc; }
.pair .cap { font-size: 8pt; color: #555; }
.pair .tag { font-size: 8pt; color: #fff; background: #356854; border-radius: 3px; padding: 0 4px; margin-right: 4px; }
.pair.warn img { border-color: #e0a800; } .pair.bad img { border-color: #b3261e; }
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0; }
.steps figure { margin: 0; break-inside: avoid; }
.steps img { height: 85mm; object-fit: cover; object-position: top; }
.steps b { color: #356854; }
.pagebreak { break-before: page; }
.box { border-left: 4px solid #e0a800; background: #fffbea; padding: 6px 10px; margin: 8px 0; }
.box.bad { border-color: #b3261e; background: #fdecea; }
ul { margin: 4px 0 8px 18px; padding: 0; }
.sev { font-weight: 700; } .sev.h { color: #b3261e; } .sev.m { color: #b26a00; } .sev.l { color: #555; }
</style></head><body>

<h1>Báo cáo kiểm thử</h1>
<div class="sub">Mộc Nhiên Authentic — Export Excel theo mẫu "Tiền hàng MN" &amp; kiểm thử toàn bộ ứng dụng trên máy local<br>Ngày chạy: 03/10/2026 · Môi trường: Windows 11, Chrome, Node.js, MongoDB in-memory (dữ liệu test)</div>

<h2>1. Tóm tắt</h2>
<div class="cards">
  <div class="card"><b>67</b>test backend đạt</div>
  <div class="card"><b>15</b>test frontend đạt</div>
  <div class="card"><b>46</b>lượt mở trang (23 trang × desktop/mobile)</div>
  <div class="card"><b>${passed}/${flows.length}</b>kiểm tra luồng đạt</div>
  <div class="card bad"><b>1</b>lỗi nghiêm trọng tìm thấy</div>
</div>
<ul>
  <li><b>Export Excel đã được viết lại</b> để giống file Google Sheet mẫu: mỗi tháng một sheet <code>ĐƠN THÁNG n</code>, đủ 3 khối (Khách bank mua hàng / PD TIEUBANGSG / WEMC Anh Mạnh), 25 cột, hàng tổng, header xanh, freeze + filter, định dạng ngày/tiền như mẫu. Sheet <code>Payments</code> được giữ để đối soát SePay.</li>
  <li><b>Lint (tsc), build frontend, test backend, test frontend đều xanh</b> (log trong <code>logs/</code>).</li>
  <li><b>Quét 23 trang × 2 kích thước màn hình:</b> không có trang nào tràn ngang, không có lỗi JS chưa bắt; phân quyền (khách → admin bị đẩy về trang chủ, vãng lai → /login) hoạt động, trừ <code>/dashboard</code>.</li>
  <li><b>Tìm thấy 1 lỗi ảnh hưởng tiền:</b> nhập giá ≥ 1.000 USD vào form đặt đơn sẽ bị lưu thành giá sai (1.299 → 1). Chưa sửa — xem mục 6.</li>
</ul>
<div class="box"><b>Giới hạn của báo cáo này:</b> (1) chưa có bản deploy nên mọi thứ chạy trên máy local, chưa test trên server thật; (2) ảnh file Excel là <i>ảnh dựng lại bằng HTML từ chính style/giá trị trong file .xlsx</i> (máy không có Excel/LibreOffice) — không phải ảnh chụp Excel hay Google Sheets thật; (3) dữ liệu là dữ liệu test trong Mongo in-memory, mất khi tắt máy.</div>

<h2>2. Export Excel — so với file mẫu</h2>
<h3>2.1 Mẫu Google Sheet (tab ĐƠN THÁNG 10)</h3>
${img("excel-template-thang10.png", "Ảnh dựng lại từ file .xlsx tải về từ Google Sheet mẫu.")}
<h3>2.2 File xuất từ app (cùng tab, dữ liệu test)</h3>
${img("excel-export-thang10.png", "Ảnh dựng lại từ file xuất bởi GET /api/orders/export. Ô tổng USD/VND/CỌC/NỢ là công thức SUM; Excel tính lại khi mở.")}
${img("excel-export-thang9.png", "Sheet ĐƠN THÁNG 9 — đơn lúc 30/09 18:30 UTC được xếp vào tháng 10 theo giờ Việt Nam (UTC+7).")}

<h3>2.3 Đối chiếu cột</h3>
<table>
<tr><th>Cột mẫu</th><th>Nguồn dữ liệu trong app</th></tr>
<tr><td>Ngày</td><td>Ngày tạo đơn, giờ VN, ô ngày thật định dạng <code>dd/MM/yyyy</code></td></tr>
<tr><td>Mã Đơn · Tên Nhân Viên</td><td>orderCode · staffName</td></tr>
<tr><td>Tên Sản Phẩm/link</td><td>productName; nếu có link http(s) thì thành hyperlink</td></tr>
<tr><td>USD · TỶ GIÁ · VND</td><td>priceUSD · exchangeRate · totalVND</td></tr>
<tr><td>CỌC · NỢ</td><td>paidAmount · remainingAmount</td></tr>
<tr><td>Số KG</td><td>weightKg (nếu đơn có nhập)</td></tr>
<tr><td>PAGE/SALE, NƯỚC (có dropdown như mẫu), Phụ Thu, TIỀN KG</td><td>App chưa có dữ liệu → để trống, nhập tay</td></tr>
<tr><td>Khối "PD TIEUBANGSG" và "WEMC ANH MẠNH" (cột N–Y)</td><td>App chưa có dữ liệu → để trống, giữ màu/công thức tổng để nhập tay</td></tr>
</table>
<p>File gồm: sheet mỗi tháng (mới nhất trước) + sheet <code>Payments</code> (chỉ các giao dịch đã khớp với đơn có trong file). Bộ lọc trạng thái / thanh toán / ngày của trang Admin vẫn hoạt động. File mẫu xuất ra nằm trong <code>exports/</code>.</p>
<div class="box"><b>Lưu ý:</b> (a) cột CỌC/NỢ dùng định dạng <code>$</code> đúng như mẫu nhưng giá trị là VND — nếu muốn hiển thị "đ" cần chỉnh định dạng; (b) các ô tổng bằng 0 không có giá trị lưu sẵn (giới hạn của thư viện exceljs) — Excel/Google Sheets tự tính lại khi mở, nhưng trình xem trước (preview email, Quick Look…) có thể hiện trống.</div>

<h2 class="pagebreak">3. Test tự động</h2>
<table>
<tr><th>Bộ test</th><th>Kết quả</th><th>Ghi chú</th></tr>
<tr><td>Backend (vitest + supertest + mongodb-memory-server)</td><td class="c">67 / 67 đạt</td><td>7 file; gồm 13 test mới <code>exportLayout.test.js</code> (tên sheet, nhóm tháng theo giờ VN, header 25 cột, merge, freeze/filter, màu &amp; định dạng, hyperlink, công thức SUM, dropdown, 0 đơn, Payments) và test export trong <code>security.test.js</code> (cập nhật theo bố cục mới)</td></tr>
<tr><td>Frontend (vitest)</td><td class="c">15 / 15 đạt</td><td>2 file</td></tr>
<tr><td>Lint — <code>tsc --noEmit</code></td><td class="c">Đạt</td><td>không lỗi kiểu</td></tr>
<tr><td>Build — <code>vite build</code></td><td class="c">Đạt</td><td>chỉ cảnh báo bundle &gt; 500 kB (đã có từ trước)</td></tr>
</table>

<h2>4. Quét toàn bộ trang (46 lượt)</h2>
<p>Mỗi trang mở bằng Chrome thật ở 1366×850 (desktop) và 375×812 (mobile), với 3 vai trò. Ghi nhận: URL cuối cùng sau redirect, tràn ngang (desktop / mobile), lỗi console, HTTP ≥ 400. Ảnh chụp đầy đủ trong <code>screenshots/</code>.</p>
<table>
<tr><th>Vai trò</th><th>Truy cập</th><th>Đến</th><th>Không tràn ngang (D / M)</th><th>Nhận xét</th></tr>
${routeRows}
</table>
<h3>Ảnh chụp từng trang</h3>
${gallery}

<h2 class="pagebreak">5. Kiểm thử luồng nghiệp vụ (${passed}/${flows.length} đạt)</h2>
<table>
<tr><th>#</th><th>Kiểm tra</th><th>Kết quả</th><th>Chi tiết</th></tr>
${flowRows}
</table>
<h3>Ảnh từng bước</h3>
${flowGallery}

<h2 class="pagebreak">6. Lỗi và phát hiện</h2>
<p>Các mục dưới <b>chưa được sửa</b> (ngoài phạm vi yêu cầu export), trừ khi bạn bảo sửa.</p>
<table>
<tr><th>#</th><th>Mức</th><th>Mô tả</th><th>Đề xuất</th></tr>
<tr class="bad"><td>1</td><td class="sev h">Cao</td><td><b>Giá ≥ 1.000 USD bị lưu sai.</b> Ô giá tự thêm dấu phẩy (<code>1,299</code>), form gửi chuỗi này, server <code>parseFloat("1,299")</code> = 1. Thử thật: đơn 1.299 USD lưu totalVND = 25.600 thay vì 33.254.400 (ảnh <code>flow-06b-create-order-price-1299.png</code>). Khách đặt hàng đắt tiền sẽ bị tính thiếu tiền.</td><td>Gửi số đã parse (bỏ dấu phẩy) từ frontend <code>Dashboard.tsx</code>, và/hoặc server từ chối chuỗi không phải số. Sửa nhỏ, ~5 dòng.</td></tr>
<tr class="bad"><td>2</td><td class="sev m">Trung bình</td><td><code>/dashboard</code> không được bảo vệ bằng ProtectedRoute: khách vãng lai vẫn vào được, thấy tên "User" mock và 401 liên tục trong console.</td><td>Bọc bằng ProtectedRoute như <code>/profile</code>.</td></tr>
<tr class="warn"><td>3</td><td class="sev m">Trung bình</td><td><code>/order-detail/:id</code> luôn hiện dữ liệu mock cố định (<code>MOCK_ORDERS</code>), không đọc đơn thật từ API.</td><td>Nối với API đơn hàng hoặc ẩn trang.</td></tr>
<tr class="warn"><td>4</td><td class="sev l">Thấp</td><td>Không có route 404: URL sai ra trang trắng.</td><td>Thêm route <code>*</code>.</td></tr>
<tr class="warn"><td>5</td><td class="sev l">Thấp</td><td><code>/calculator</code> hiển thị giống trang chủ, chưa có giao diện tính giá.</td><td>Xác nhận có chủ đích hay chưa làm.</td></tr>
<tr class="warn"><td>6</td><td class="sev l">Thấp</td><td>Trang công khai gọi <code>/api/user/profile</code> khi chưa đăng nhập → 401 trong console (gọi đôi do StrictMode ở dev).</td><td>Chỉ gọi khi có token.</td></tr>
<tr class="warn"><td>7</td><td class="sev l">Thấp</td><td>Trang chủ có thêm 1 lỗi console (tài nguyên 404) chưa xác định.</td><td>Kiểm tra tab Network.</td></tr>
<tr class="warn"><td>8</td><td class="sev l">Thấp</td><td>Export: ô tổng = 0 không có giá trị lưu sẵn; CỌC/NỢ dùng định dạng $ theo mẫu nhưng là VND; sheet Payments bỏ các giao dịch chưa khớp đơn (có chủ đích).</td><td>Xem mục 2.</td></tr>
</table>
<h3>Những điểm hoạt động tốt</h3>
<ul>
  <li>Giới hạn đăng nhập (10 lần / 15 phút / IP) hoạt động.</li>
  <li>Webhook SePay: sai API key bị từ chối (401); giao dịch trùng không cộng hai lần; giao dịch sai tài khoản bị bỏ qua; giao dịch không có mã đơn được lưu thành "Unmatched"; giao dịch có mã được cộng đúng đơn.</li>
  <li>Phân quyền: export chỉ admin (khách 403, vãng lai 401); khách vào /admin/* bị đưa về trang chủ.</li>
  <li>Giao diện mobile 375px: không trang nào tràn ngang.</li>
</ul>

<h2>7. Việc chưa làm</h2>
<ul>
  <li><b>Deploy:</b> chưa có VPS/domain nên chưa chạy Docker Compose thật và chưa kiểm thử trên bản deploy.</li>
  <li>Chưa mở file xuất trong Excel / Google Sheets thật (không có sẵn trên máy). Khuyến nghị: bạn tải thử 1 file từ Admin → Export Excel và mở bằng Excel/Google Sheets để xác nhận bằng mắt.</li>
  <li>Đồng bộ Google Sheet (<code>Code.gs</code>, tab "Orders") giữ nguyên, chưa đổi theo mẫu.</li>
  <li>Code export + test mới đang nằm ở working tree, chưa commit.</li>
</ul>
</body></html>`;

(async () => {
  fs.writeFileSync(path.join(OUT, "REPORT.html"), html);
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage();
  await page.goto("file:///" + OUT + "/REPORT.html");
  await page.waitForLoadState("networkidle");
  await page.pdf({ path: path.join(OUT, "REPORT.pdf"), format: "A4", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" }, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
  await browser.close();
  console.log("done", fs.statSync(path.join(OUT, "REPORT.pdf")).size);
})().catch((e) => { console.error(e); process.exit(1); });
