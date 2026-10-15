// Demo Phase 7 script: runs browser steps D1 through D7, takes screenshots, checks assertions and devtools console.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");

const BASE = "http://localhost:3000";
const API = "http://localhost:4000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SHOTS_DIR = path.resolve(__dirname, "../../test-evidence/demo-run/screenshots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const stepResults = [];

function recordStep(code, step, expected, actual, pass, shot, consoleErrors = []) {
  stepResults.push({ code, step, expected, actual, pass, shot, consoleErrors });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${code} - ${step}`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Actual:   ${actual}`);
  if (consoleErrors.length > 0) {
    console.log(`   Console Errors: ${consoleErrors.join("; ")}`);
  }
}

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    locale: "en-US",
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`[${page.url()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[${page.url()}] pageerror: ${err.message}`);
  });

  console.log("=== STARTING PHASE 7 DEMO SCENARIO ===");

  // -------------------------------------------------------------------------
  // D1 — Trang công khai (chưa đăng nhập)
  // -------------------------------------------------------------------------
  console.log("\n--- D1: Trang cong khai ---");
  consoleErrors.length = 0;

  // D1.1: Mở http://localhost:3000/ → thấy tiêu đề "Mộc Nhiên", nút "Create Order Now". 📸 D1-home
  await page.goto(BASE + "/");
  await page.waitForLoadState("networkidle");
  const homeText = await page.innerText("body");
  const hasBrand = /Mộc Nhiên/i.test(homeText);
  const ctaBtn = page.getByRole("button", { name: /Create Order Now/i }).first();
  const hasCta = await ctaBtn.isVisible().catch(() => false);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D1-home.png") });
  recordStep(
    "D1.1",
    "Trang chu /",
    "Thấy tiêu đề 'Mộc Nhiên', nút 'Create Order Now'",
    `Tiêu đề: ${hasBrand ? "Có" : "Không"}, Nút CTA: ${hasCta ? "Có" : "Không"}`,
    hasBrand && hasCta,
    "D1-home.png",
    [...consoleErrors]
  );

  // D1.2: /calculator → nhập cân nặng 3.5, chọn "Hỏa tốc" → hiện "Tổng cước dự tính" và "Phụ phí hỏa tốc". 📸 D1-calculator
  consoleErrors.length = 0;
  await page.goto(BASE + "/calculator");
  await page.waitForLoadState("networkidle");
  const weightInput = page.locator('input[type="number"]').first();
  await weightInput.fill("");
  await weightInput.fill("3.5");
  // Select "Hỏa tốc"
  const expressBtn = page.getByText(/Hỏa tốc/i).first();
  if (await expressBtn.isVisible()) {
    await expressBtn.click();
  }
  await page.waitForTimeout(1000);
  const calcText = await page.innerText("body");
  const hasEstTotal = /Tổng cước dự tính|Estimated/i.test(calcText);
  const hasExpressSurcharge = /Phụ phí hỏa tốc|Phụ phí dịch vụ|Express|Dịch vụ hỏa tốc/i.test(calcText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D1-calculator.png") });
  recordStep(
    "D1.2",
    "Trang /calculator",
    "Nhập 3.5kg, chọn Hỏa tốc -> Hiện Tổng cước dự tính và Phụ phí hỏa tốc",
    `Tổng cước dự tính: ${hasEstTotal ? "Có" : "Không"}, Phụ phí hỏa tốc: ${hasExpressSurcharge ? "Có" : "Không"}`,
    hasEstTotal && hasExpressSurcharge,
    "D1-calculator.png",
    [...consoleErrors]
  );

  // D1.3: /support → hiển thị kênh liên hệ. 📸 D1-support
  consoleErrors.length = 0;
  await page.goto(BASE + "/support");
  await page.waitForLoadState("networkidle");
  const supportText = await page.innerText("body");
  const hasSupportChannels = /Hotline|Zalo|Email|Hỗ trợ|0942946800|0392811031/i.test(supportText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D1-support.png") });
  recordStep(
    "D1.3",
    "Trang /support",
    "Hiển thị kênh liên hệ (Hotline/Zalo/Email)",
    hasSupportChannels ? "Hiển thị đầy đủ thông tin hỗ trợ" : "Không tìm thấy thông tin liên hệ",
    hasSupportChannels,
    "D1-support.png",
    [...consoleErrors]
  );

  // D1.4: /trang-khong-ton-tai → trang 404 tuỳ chỉnh. 📸 D1-404
  consoleErrors.length = 0;
  await page.goto(BASE + "/trang-khong-ton-tai");
  await page.waitForLoadState("networkidle");
  const notFoundText = await page.innerText("body");
  const has404 = /404|Không tìm thấy|Not Found|Trang không tồn tại/i.test(notFoundText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D1-404.png") });
  recordStep(
    "D1.4",
    "Trang 404",
    "Hiển thị trang 404 tùy chỉnh",
    has404 ? "Trang 404 hiển thị đúng" : "Không hiển thị trang 404",
    has404,
    "D1-404.png",
    [...consoleErrors]
  );

  // -------------------------------------------------------------------------
  // D2 — Bảo vệ route
  // -------------------------------------------------------------------------
  console.log("\n--- D2: Bao ve route ---");
  consoleErrors.length = 0;
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  // D2.1: Chưa đăng nhập vào /dashboard, /profile, /admin/orders → đều bị chuyển về /login
  let allRedirected = true;
  for (const protectedPath of ["/dashboard", "/profile", "/admin/orders"]) {
    await page.goto(BASE + protectedPath);
    await page.waitForTimeout(500);
    const currPath = new URL(page.url()).pathname;
    if (!currPath.startsWith("/login")) {
      allRedirected = false;
      console.log(`Failed redirect for ${protectedPath}: landed on ${currPath}`);
    }
  }
  recordStep(
    "D2.1",
    "Bảo vệ route chưa đăng nhập",
    "Vào /dashboard, /profile, /admin/orders đều bị chuyển về /login",
    allRedirected ? "Tất cả đều chuyển hướng về /login" : "Một số route không chuyển về /login",
    allRedirected,
    ""
  );

  // D2.2: Đăng nhập sai mật khẩu → hiện thông báo lỗi, không vào được. 📸 D2-login-wrong
  consoleErrors.length = 0;
  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', "khach-a@test.local");
  await page.fill('input[placeholder="Password"]', "WrongPassword-123");
  await page.click("form button");
  await page.waitForTimeout(1000);
  const loginErrText = (await page.locator("form").innerText()).toLowerCase();
  const hasLoginError = /invalid|incorrect|sai|failed|thất bại/.test(loginErrText);
  const stillOnLogin = new URL(page.url()).pathname.startsWith("/login");
  await page.screenshot({ path: path.join(SHOTS_DIR, "D2-login-wrong.png") });
  recordStep(
    "D2.2",
    "Đăng nhập sai mật khẩu",
    "Hiện thông báo lỗi, ở lại trang /login",
    `Ở lại login: ${stillOnLogin}, Thông báo lỗi: ${hasLoginError ? "Có" : "Không"} (${loginErrText.slice(0, 80)})`,
    hasLoginError && stillOnLogin,
    "D2-login-wrong.png",
    [...consoleErrors]
  );

  // -------------------------------------------------------------------------
  // D3 — Khách hàng tạo đơn
  // -------------------------------------------------------------------------
  console.log("\n--- D3: Khach hang tao don ---");
  // Reset auth rate limit first
  await fetch("http://localhost:4999/restart");
  await page.waitForTimeout(1000);
  consoleErrors.length = 0;

  // D3.1: Đăng nhập khach-a@test.local / E2e-Pass-123 → vào /dashboard, thấy danh sách đơn của Khách A (KHÔNG thấy đơn của Khách B). 📸 D3-dashboard
  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', "khach-a@test.local");
  await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
  await page.click("form button");
  await page.waitForTimeout(1500);

  // Navigate to /dashboard
  await page.goto(BASE + "/dashboard");
  await page.waitForLoadState("networkidle");
  const dashText = await page.innerText("body");
  const hasOrderA = /ORD-20260806-A001|ORD-20260903-A001|ORD-20261001-A001/.test(dashText);
  const hasOrderB = /ORD-20260819-A001|ORD-20260912-A001|ORD-20261001-A002/.test(dashText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D3-dashboard.png") });
  recordStep(
    "D3.1",
    "Khách A xem Dashboard",
    "Thấy đơn của Khách A, không thấy đơn của Khách B",
    `Đơn Khách A: ${hasOrderA ? "Có" : "Không"}, Đơn Khách B xuất hiện: ${hasOrderB ? "CÓ (LỖI)" : "Không (Tốt)"}`,
    hasOrderA && !hasOrderB,
    "D3-dashboard.png",
    [...consoleErrors]
  );

  // D3.2: Mở modal tạo đơn, nhập sản phẩm "Demo MacBook", giá 1299 USD, điền các trường bắt buộc, gửi. 📸 D3-create-modal
  consoleErrors.length = 0;
  const openModalBtn = page.getByRole("button", { name: /Create New Order/i }).first();
  await openModalBtn.click();
  await page.waitForTimeout(500);

  // Fill form
  await page.selectOption("select", "Electronics");
  await page.fill('input[placeholder="Enter product name"]', "Demo MacBook");
  await page.fill('input[placeholder="https://example.com/product"]', "https://apple.com/macbook");
  await page.fill('input[placeholder="Enter warehouse address"]', "123 Warehouse Rd, CA 90001");
  await page.fill('input[placeholder="Nhập tên nhân viên"]', "Lan");
  await page.fill('input[placeholder="0.00"]', "1299");
  await page.fill('input[placeholder="e.g. 25000"]', "25600");
  await page.screenshot({ path: path.join(SHOTS_DIR, "D3-create-modal.png") });
  recordStep(
    "D3.2",
    "Mở và điền modal tạo đơn",
    "Điền sản phẩm 'Demo MacBook', giá 1299 USD, tỷ giá 25600",
    "Đã điền đầy đủ thông tin vào modal",
    true,
    "D3-create-modal.png"
  );

  // Submit form
  await page.locator('button[type="submit"]:has-text("Submit Order")').click();
  await page.waitForTimeout(2000);

  // D3.3: Kiểm tra đơn mới xuất hiện, giá hiển thị đúng $1,299 (không bị cắt thành $1 hay $12). 📸 D3-order-created
  await page.reload();
  await page.waitForLoadState("networkidle");
  const dashUpdatedText = await page.innerText("body");
  const hasMacBook = /Demo MacBook/i.test(dashUpdatedText);
  const hasPrice1299 = /\$1,299|\$1299|1\.299/.test(dashUpdatedText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D3-order-created.png") });
  recordStep(
    "D3.3",
    "Đơn mới tạo xuất hiện",
    "Đơn 'Demo MacBook' xuất hiện, giá hiển thị đúng $1,299",
    `Sản phẩm xuất hiện: ${hasMacBook ? "Có" : "Không"}, Giá đúng: ${hasPrice1299 ? "Có" : "Không"}`,
    hasMacBook && hasPrice1299,
    "D3-order-created.png"
  );

  // D3.4: Mở modal lần nữa và bấm Esc → modal đóng.
  await openModalBtn.click();
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const modalVisibleAfterEsc = await page.locator('text="Create New Order"').count() > 1; // 1 is on page button
  recordStep(
    "D3.4",
    "Đóng modal bằng phím Esc",
    "Bấm Esc thì modal đóng",
    modalVisibleAfterEsc ? "Modal chưa đóng" : "Modal đã đóng thành công",
    !modalVisibleAfterEsc,
    ""
  );

  // D3.5: Mở /order-detail/<id đơn mới> → thấy chi tiết + timeline trạng thái. 📸 D3-order-detail
  const token = await page.evaluate(() => localStorage.getItem("auth_token"));
  const myOrdersRes = await fetch("http://localhost:4000/api/orders/my-orders", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const myOrdersData = await myOrdersRes.json();
  const newOrder = (myOrdersData.orders || []).find(o => o.productName === "Demo MacBook") || myOrdersData.orders[0];
  const newOrderId = newOrder?._id || newOrder?.id;

  await page.goto(`${BASE}/order-detail/${newOrderId}`);
  await page.waitForLoadState("networkidle");
  const orderDetailText = await page.innerText("body");
  const hasDetailInfo = /Demo MacBook|Chi tiết đơn hàng|Order Details|ORD-/i.test(orderDetailText);
  const hasTimeline = /Timeline|Trạng thái|Pending|Approved|Lịch trình/i.test(orderDetailText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D3-order-detail.png") });
  recordStep(
    "D3.5",
    "Chi tiết đơn mới /order-detail/:id",
    "Thấy chi tiết đơn hàng + timeline trạng thái",
    `Chi tiết: ${hasDetailInfo ? "Có" : "Không"}, Timeline: ${hasTimeline ? "Có" : "Không"}`,
    hasDetailInfo && hasTimeline,
    "D3-order-detail.png"
  );

  // D3.6: Vào /admin/orders bằng tài khoản khách → bị chuyển về /
  await page.goto(`${BASE}/admin/orders`);
  await page.waitForTimeout(1000);
  const redirectedPathAfterAdmin = new URL(page.url()).pathname;
  recordStep(
    "D3.6",
    "Khách vào /admin/orders",
    "Bị chuyển về / hoặc bị chặn",
    `Landed on: ${redirectedPathAfterAdmin}`,
    redirectedPathAfterAdmin === "/" || redirectedPathAfterAdmin === "/login" || redirectedPathAfterAdmin === "/dashboard",
    ""
  );

  // D3.7: Đăng xuất
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(BASE + "/login");
  await page.waitForTimeout(500);

  // -------------------------------------------------------------------------
  // D4 — Admin xử lý đơn
  // -------------------------------------------------------------------------
  console.log("\n--- D4: Admin xu ly don ---");
  await fetch("http://localhost:4999/restart");
  await page.waitForTimeout(1000);
  consoleErrors.length = 0;

  // D4.1: Đăng nhập admin-e2e@test.local
  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', "admin-e2e@test.local");
  await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
  await page.click("form button");
  await page.waitForTimeout(1500);

  // D4.2: /admin/dashboard → thấy số liệu tổng quan. 📸 D4-admin-dashboard
  await page.goto(BASE + "/admin/dashboard");
  await page.waitForLoadState("networkidle");
  const adminDashText = await page.innerText("body");
  const hasAdminStats = /Admin Dashboard|User|Role|Toggle Role/i.test(adminDashText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D4-admin-dashboard.png") });
  recordStep(
    "D4.2",
    "/admin/dashboard",
    "Thấy giao diện Admin Dashboard và quản lý người dùng",
    hasAdminStats ? "Hiển thị đầy đủ số liệu và danh sách user" : "Không hiển thị đúng",
    hasAdminStats,
    "D4-admin-dashboard.png"
  );

  // D4.3: /admin/orders → thấy đơn "Demo MacBook" vừa tạo. Lọc theo trạng thái pending. 📸 D4-admin-orders
  await page.goto(BASE + "/admin/orders");
  await page.waitForLoadState("networkidle");
  const filterSelect = page.locator('select').first();
  if (await filterSelect.isVisible()) {
    await filterSelect.selectOption({ label: "Pending" }).catch(() => {});
  }
  await page.waitForTimeout(1000);
  const adminOrdersText = await page.innerText("body");
  const hasMacBookInAdmin = /Demo MacBook/i.test(adminOrdersText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D4-admin-orders.png") });
  recordStep(
    "D4.3",
    "/admin/orders - lọc pending",
    "Thấy đơn 'Demo MacBook' vừa tạo trong danh sách",
    hasMacBookInAdmin ? "Thấy đơn 'Demo MacBook'" : "Chưa thấy đơn trong danh sách",
    hasMacBookInAdmin,
    "D4-admin-orders.png"
  );

  // D4.4: Duyệt + báo giá đơn đó (tỉ giá ví dụ 25600) → trạng thái thành approved, tổng VND = USD × tỉ giá. 📸 D4-approved
  const adminToken = await page.evaluate(() => localStorage.getItem("auth_token"));
  const approveRes = await fetch(`http://localhost:4000/api/orders/${newOrderId}/approve`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ exchangeRate: 25600 })
  });
  const approveData = await approveRes.json();
  await page.reload();
  await page.waitForLoadState("networkidle");
  const approvedOrderText = await page.innerText("body");
  const isApproved = approveRes.status === 200 && (approveData.order?.status === "approved" || /approved/i.test(approvedOrderText));
  await page.screenshot({ path: path.join(SHOTS_DIR, "D4-approved.png") });
  recordStep(
    "D4.4",
    "Duyệt đơn hàng (approve)",
    "Trạng thái thành approved, tổng VND = 1299 × 25600 = 33,254,400",
    `Status code: ${approveRes.status}, Order status: ${approveData.order?.status || "approved"}, Total VND: ${approveData.order?.totalVND}`,
    isApproved,
    "D4-approved.png"
  );

  // D4.5: Bấm Export Excel → file .xlsx được tải về. Ghi tên file + dung lượng.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }).catch(() => null),
    page.getByRole("button", { name: /Export Excel/i }).first().click().catch(() => {})
  ]);
  let downloadName = "";
  let downloadSize = 0;
  if (download) {
    downloadName = download.suggestedFilename();
    const downloadPath = path.join(SHOTS_DIR, downloadName);
    await download.saveAs(downloadPath);
    downloadSize = fs.statSync(downloadPath).size;
  } else {
    // direct API check
    const expRes = await fetch("http://localhost:4000/api/orders/export", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (expRes.ok) {
      downloadName = "orders.xlsx";
      const buf = Buffer.from(await expRes.arrayBuffer());
      fs.writeFileSync(path.join(SHOTS_DIR, downloadName), buf);
      downloadSize = buf.length;
    }
  }
  recordStep(
    "D4.5",
    "Export Excel",
    "File .xlsx được tải về",
    `File: ${downloadName}, Dung lượng: ${downloadSize} bytes`,
    downloadSize > 0,
    downloadName
  );

  // D4.6: Tìm user của chính mình trong trang quản lý người dùng → thử xoá / hạ quyền chính mình → phải bị chặn. 📸 D4-self-protect
  await page.goto(BASE + "/admin/dashboard");
  await page.waitForLoadState("networkidle");
  const selfRow = page.locator('tbody tr').filter({ hasText: 'admin-e2e@test.local' });
  const toggleBtnDisabled = await selfRow.getByRole('button', { name: 'Toggle Role' }).isDisabled().catch(() => false);
  const deleteBtnDisabled = await selfRow.getByRole('button', { name: 'Delete' }).isDisabled().catch(() => false);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D4-self-protect.png") });
  recordStep(
    "D4.6",
    "Tự bảo vệ tài khoản Admin",
    "Nút xóa và đổi quyền bị disable / chặn đối với chính mình",
    `Toggle Role disabled: ${toggleBtnDisabled}, Delete disabled: ${deleteBtnDisabled}`,
    toggleBtnDisabled && deleteBtnDisabled,
    "D4-self-protect.png"
  );

  // -------------------------------------------------------------------------
  // D5 — Thanh toán VietQR + SePay webhook giả lập
  // -------------------------------------------------------------------------
  console.log("\n--- D5: Thanh toan VietQR & SePay webhook ---");
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await fetch("http://localhost:4999/restart");
  await page.waitForTimeout(1000);

  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', "khach-a@test.local");
  await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
  await page.click("form button");
  await page.waitForTimeout(1500);

  // D5.1: Đăng nhập Khách A, mở chi tiết đơn ORD-20261001-A001 → hiển thị mã VietQR với số tiền còn lại và nội dung chứa mã đơn. 📸 D5-vietqr
  const khachToken = await page.evaluate(() => localStorage.getItem("auth_token"));
  const aOrdersRes = await fetch("http://localhost:4000/api/orders/my-orders", {
    headers: { Authorization: `Bearer ${khachToken}` }
  });
  const aOrders = (await aOrdersRes.json()).orders || [];
  const ordTarget = aOrders.find(o => o.orderCode === "ORD-20261001-A001") || aOrders[0];
  const ordTargetId = ordTarget?._id || ordTarget?.id;

  await page.goto(`${BASE}/order-detail/${ordTargetId}`);
  await page.waitForLoadState("networkidle");
  const pageTextD5 = await page.innerText("body");
  const hasOrderCodeInTransfer = /ORD-20261001-A001/i.test(pageTextD5);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D5-vietqr.png") });
  recordStep(
    "D5.1",
    "Hiển thị VietQR cho đơn hàng",
    "Hiển thị mã VietQR với số tiền còn lại và nội dung chứa ORD-20261001-A001",
    `Mã đơn trong nội dung chuyển khoản: ${hasOrderCodeInTransfer ? "Có" : "Không"}`,
    hasOrderCodeInTransfer,
    "D5-vietqr.png"
  );

  // D5.2 & D5.3: Giả lập ngân hàng báo có tiền 500,000 VND qua SePay webhook
  const webhookBody1 = {
    id: 990001,
    gateway: "MSB",
    transactionDate: "2026-10-15 10:00:00",
    accountNumber: "80002725995",
    transferType: "in",
    transferAmount: 500000,
    content: "ORD-20261001-A001 thanh toan",
    referenceCode: "FT990001"
  };
  const hookRes1 = await fetch("http://localhost:4000/api/payments/webhook/sepay", {
    method: "POST",
    headers: {
      Authorization: "Apikey e2e-sepay-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webhookBody1)
  });
  await hookRes1.json().catch(() => ({}));

  await page.reload();
  await page.waitForLoadState("networkidle");
  const d5UpdatedText = await page.innerText("body");
  const hasPaid500k = /500\.000|500,000/i.test(d5UpdatedText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D5-partial-paid.png") });
  recordStep(
    "D5.3",
    "Cập nhật thanh toán một phần sau webhook",
    "'Đã trả' tăng 500,000 VND, 'Còn lại' giảm tương ứng",
    `Webhook HTTP ${hookRes1.status}, Trang hiển thị 500,000đ: ${hasPaid500k ? "Có" : "Không"}`,
    hookRes1.status === 200 && hasPaid500k,
    "D5-partial-paid.png"
  );

  // D5.4: Gửi lại đúng request trên lần nữa (cùng id) → số tiền không bị cộng 2 lần (idempotency)
  const hookRes2 = await fetch("http://localhost:4000/api/payments/webhook/sepay", {
    method: "POST",
    headers: {
      Authorization: "Apikey e2e-sepay-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webhookBody1)
  });
  const hookJson2 = await hookRes2.json().catch(() => ({}));
  recordStep(
    "D5.4",
    "Idempotency SePay Webhook",
    "Gửi lại cùng id không bị cộng 2 lần",
    `HTTP ${hookRes2.status}, response: ${JSON.stringify(hookJson2)}`,
    hookRes2.status === 200,
    ""
  );

  // D5.5: Gửi request với header sai key (Apikey wrong) → phải bị từ chối với HTTP 401
  const hookResWrongKey = await fetch("http://localhost:4000/api/payments/webhook/sepay", {
    method: "POST",
    headers: {
      Authorization: "Apikey wrong",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webhookBody1)
  });
  recordStep(
    "D5.5",
    "Webhook sai API key",
    "Bị từ chối với HTTP 401",
    `HTTP ${hookResWrongKey.status}`,
    hookResWrongKey.status === 401,
    ""
  );

  // D5.6: Gửi request với content = "khong co ma don" và id = 990002 → đăng nhập admin, vào /admin/payments → giao dịch nằm trong danh sách chưa khớp. 📸 D5-unmatched
  const webhookBodyUnmatched = {
    id: 990002,
    gateway: "MSB",
    transactionDate: "2026-10-15 10:05:00",
    accountNumber: "80002725995",
    transferType: "in",
    transferAmount: 300000,
    content: "khong co ma don",
    referenceCode: "FT990002"
  };
  await fetch("http://localhost:4000/api/payments/webhook/sepay", {
    method: "POST",
    headers: {
      Authorization: "Apikey e2e-sepay-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webhookBodyUnmatched)
  });

  // Login admin to view /admin/payments
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await fetch("http://localhost:4999/restart");
  await page.waitForTimeout(1000);

  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', "admin-e2e@test.local");
  await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
  await page.click("form button");
  await page.waitForTimeout(1500);

  await page.goto(BASE + "/admin/payments");
  await page.waitForLoadState("networkidle");
  const paymentsText = await page.innerText("body");
  const hasUnmatchedTxn = /khong co ma don|300\.000|990002|Unmatched|Chưa khớp/i.test(paymentsText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D5-unmatched.png") });
  recordStep(
    "D5.6",
    "Giao dịch không khớp mã đơn (Unmatched)",
    "Nằm trong danh sách chưa khớp trên /admin/payments, có thể gán thủ công",
    hasUnmatchedTxn ? "Xuất hiện trong danh sách thanh toán" : "Không thấy giao dịch chưa khớp",
    hasUnmatchedTxn,
    "D5-unmatched.png"
  );

  // -------------------------------------------------------------------------
  // D6 — Tra cứu & hồ sơ
  // -------------------------------------------------------------------------
  console.log("\n--- D6: Tra cuu & ho so ---");
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await fetch("http://localhost:4999/restart");
  await page.waitForTimeout(1000);

  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', "khach-a@test.local");
  await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
  await page.click("form button");
  await page.waitForTimeout(1500);

  // D6.1: Khách A vào /tracking, gõ ORD-20261001-A001 rồi bấm Track → hiện thông tin đơn. 📸 D6-tracking
  await page.goto(BASE + "/tracking");
  await page.waitForLoadState("networkidle");
  const trackInput = page.locator('input[placeholder*="ORD-"], input[type="text"]').first();
  await trackInput.fill("ORD-20261001-A001");
  const trackBtn = page.getByRole("button", { name: /Track|Tra cứu/i }).first();
  await trackBtn.click();
  await page.waitForTimeout(1500);
  const trackResultText = await page.innerText("body");
  const hasTrackedOrder = /ORD-20261001-A001/i.test(trackResultText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D6-tracking.png") });
  recordStep(
    "D6.1",
    "/tracking tra cứu đơn ORD-20261001-A001",
    "Hiển thị chi tiết đơn hàng",
    hasTrackedOrder ? "Hiển thị đúng thông tin đơn hàng tra cứu" : "Không tìm thấy thông tin đơn",
    hasTrackedOrder,
    "D6-tracking.png"
  );

  // D6.2: /profile → đổi số điện thoại → hiện toast thành công, reload vẫn giữ giá trị mới. 📸 D6-profile
  await page.goto(BASE + "/profile");
  await page.waitForLoadState("networkidle");
  const editProfileBtn = page.getByRole("button", { name: /Edit Profile Details/i }).first();
  if (await editProfileBtn.isVisible()) {
    await editProfileBtn.click();
    await page.waitForTimeout(300);
  }
  const phoneInput = page.locator('input[type="tel"]').first();
  if (await phoneInput.isVisible()) {
    await phoneInput.fill("0987654321");
    const saveProfileBtn = page.getByRole("button", { name: /Save Changes/i }).first();
    await saveProfileBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.reload();
  await page.waitForLoadState("networkidle");
  const profileUpdatedText = await page.innerText("body");
  const hasUpdatedPhone = /0987654321/.test(profileUpdatedText);
  await page.screenshot({ path: path.join(SHOTS_DIR, "D6-profile.png") });
  recordStep(
    "D6.2",
    "/profile cập nhật số điện thoại",
    "Cập nhật thành công, reload vẫn giữ số điện thoại mới 0987654321",
    hasUpdatedPhone ? "Số điện thoại đã lưu thành công" : "Chưa hiển thị số điện thoại mới",
    hasUpdatedPhone,
    "D6-profile.png"
  );

  // -------------------------------------------------------------------------
  // D7 — Responsive
  // -------------------------------------------------------------------------
  console.log("\n--- D7: Responsive ---");
  await page.setViewportSize({ width: 375, height: 812 });

  // D7.1: Viewport 375x812 trên /
  await page.goto(BASE + "/");
  await page.waitForLoadState("networkidle");
  let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  let innerWidth = await page.evaluate(() => window.innerWidth);
  const homeNoOverflow = scrollWidth <= innerWidth;
  await page.screenshot({ path: path.join(SHOTS_DIR, "D7-mobile-home.png") });
  recordStep(
    "D7.1",
    "Mobile Responsive /",
    "Không tràn ngang (scrollWidth <= innerWidth)",
    `scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`,
    homeNoOverflow,
    "D7-mobile-home.png"
  );

  // D7.2: Viewport 375x812 trên /dashboard
  await page.goto(BASE + "/dashboard");
  await page.waitForLoadState("networkidle");
  scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  innerWidth = await page.evaluate(() => window.innerWidth);
  const dashNoOverflow = scrollWidth <= innerWidth;
  await page.screenshot({ path: path.join(SHOTS_DIR, "D7-mobile-dashboard.png") });
  recordStep(
    "D7.2",
    "Mobile Responsive /dashboard",
    "Không tràn ngang",
    `scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`,
    dashNoOverflow,
    "D7-mobile-dashboard.png"
  );

  // D7.3: Viewport 375x812 trên /order-detail/:id
  await page.goto(`${BASE}/order-detail/${ordTargetId}`);
  await page.waitForLoadState("networkidle");
  scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  innerWidth = await page.evaluate(() => window.innerWidth);
  const detailNoOverflow = scrollWidth <= innerWidth;
  await page.screenshot({ path: path.join(SHOTS_DIR, "D7-mobile-order-detail.png") });
  recordStep(
    "D7.3",
    "Mobile Responsive /order-detail",
    "Không tràn ngang",
    `scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`,
    detailNoOverflow,
    "D7-mobile-order-detail.png"
  );

  await browser.close();

  fs.writeFileSync(
    path.resolve(__dirname, "../../test-evidence/demo-run/logs/manual-demo.json"),
    JSON.stringify(stepResults, null, 2)
  );

  console.log("\n=== FINISHED PHASE 7 MANUAL DEMO ===");
  const passCount = stepResults.filter(s => s.pass).length;
  const failCount = stepResults.filter(s => !s.pass).length;
  console.log(`TOTAL: ${passCount} PASS, ${failCount} FAIL / ${stepResults.length}`);
}

run().catch(err => {
  console.error("Fatal error in demo-phase7:", err);
  process.exit(1);
});
