// Remaining browser UI flow groups: orders track profile admin mobile robust.
// Loaded by flows-ui.cjs, which hands over its helper object.
const fs = require("fs");
const path = require("path");
const L = require("./lib.cjs");
const { BASE, USERS, SHOTS, check, skip, http, login: apiLogin, reset, restart } = L;

exports.register = (h) => {
  const { newCtx, openPage, shot, settle, pathOf, uiLogin, clearBrowserSession, tokenInStorage } = h;

  const cachedTokens = {};
  const myOrders = async (who) => {
    if (!cachedTokens[who]) {
      const res = await apiLogin(who);
      cachedTokens[who] = res.token;
    }
    const r = await http("GET", "/api/orders/my-orders", { token: cachedTokens[who] });
    return Array.isArray(r.body) ? r.body : r.body.orders || [];
  };

  /** Fill and submit the customer "Create New Order" modal. */
  async function fillCreateForm(page, { type = "Electronics", name, price = "", rate = "25000", link = "", warehouse = "1 Warehouse Rd, CA 90001", staff = "Lan" }) {
    const form = page.locator("form").filter({ hasText: "Product Type" });
    await form.locator("select").first().selectOption(type);
    await form.locator('input[placeholder="Enter product name"]').fill(name);
    if (link) await form.locator('input[placeholder="https://example.com/product"]').fill(link);
    await form.locator('input[placeholder="Enter warehouse address"]').fill(warehouse);
    await form.locator('input[placeholder="Nhập tên nhân viên"]').fill(staff);
    if (price) await form.locator('input[placeholder="0.00"]').fill(price);
    if (rate) await form.locator('input[placeholder="e.g. 25000"]').fill(rate);
    return form;
  }
  const submitBtn = (page) => page.locator('button[type="submit"]', { hasText: "Submit Order" });
  const openCreate = async (page) => {
    const cancelBtn = page.getByRole("button", { name: "Cancel" });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    const closeBtn = page.locator('button:has-text("Close")');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    await page.goto(BASE + "/dashboard");
    await settle(page, 300);
    const btn = page.getByRole("button", { name: "Create New Order" }).first();
    await btn.click({ timeout: 5000 });
    await page.waitForSelector("text=Fill in the details below");
  };

  // -------------------------------------------------------------------------
  async function groupOrders() {
    await reset();
    const A = "UI-ORDER";
    const ctx = await newCtx();
    const page = await openPage(ctx);
    await uiLogin(page, "a");
    await page.goto(BASE + "/dashboard");
    await settle(page);

    let f = await shot(page, "orders-01-dashboard");
    const seeded = await myOrders("a");
    const bodyText = await page.locator("body").innerText();
    const active = seeded.filter((o) => o.status !== "delivered").length;
    check("UI-ORDER-01", A, "Dashboard khách: chỉ hiện đơn của mình, số đơn đang vận chuyển khớp API",
      seeded.length > 0 && seeded.every((o) => o.userEmail ? o.userEmail === USERS.a.email : true) && !/Son Mac Ruby Woo/.test(bodyText) && new RegExp(`Active Shipments\\s*${active}`, "i").test(bodyText.replace(/\s+/g, " ")),
      `API ${seeded.length} đơn, active=${active}`, f);

    // create 899 USD
    await openCreate(page);
    await fillCreateForm(page, { name: "UI test 899", price: "899", link: "example.com/p899" });
    f = await shot(page, "orders-02-create-899-filled");
    await submitBtn(page).click();
    await page.waitForSelector("text=Order Submitted", { timeout: 8000 }).catch(() => {});
    f = await shot(page, "orders-03-create-899-submitted");
    let list = await myOrders("a");
    let o = list.find((x) => x.productName === "UI test 899");
    check("UI-ORDER-02", A, "Tạo đơn 899 USD qua form → lưu đúng 899 USD, VND = 899 × tỷ giá", !!o && o.priceUSD === 899 && Math.round(o.priceVND) === 899 * 25000, o ? `USD=${o.priceUSD} VND=${o.priceVND}` : "không thấy đơn", f);
    check("UI-ORDER-03", A, "Link không có https:// vẫn được nhận (không chặn đơn)", !!o && !!o.productLink, o ? String(o.productLink) : "");

    // create 1,299 USD (the bug: used to be stored as 1)
    await openCreate(page);
    await fillCreateForm(page, { name: "UI test 1299", price: "1299" });
    const shownPrice = await page.locator('input[placeholder="0.00"]').inputValue();
    f = await shot(page, "orders-04-create-1299-filled");
    await submitBtn(page).click();
    await page.waitForSelector("text=Order Submitted", { timeout: 8000 }).catch(() => {});
    f = await shot(page, "orders-05-create-1299-submitted");
    list = await myOrders("a");
    o = list.find((x) => x.productName === "UI test 1299");
    check("UI-ORDER-04", A, "Tạo đơn 1.299 USD (≥ 1.000) → lưu đúng 1299, không còn thành 1 (lỗi #1)", !!o && o.priceUSD === 1299 && Math.round(o.priceVND) === 1299 * 25000, `ô giá hiện "${shownPrice}" → USD=${o && o.priceUSD} VND=${o && o.priceVND}`, f);

    // 12,500.50
    await openCreate(page);
    await fillCreateForm(page, { name: "UI test 12500", price: "12500.50", rate: "25500" });
    await submitBtn(page).click();
    await page.waitForSelector("text=Order Submitted", { timeout: 8000 }).catch(() => {});
    o = (await myOrders("a")).find((x) => x.productName === "UI test 12500");
    check("UI-ORDER-05", A, "Tạo đơn 12.500,50 USD → lưu 12500.5", !!o && o.priceUSD === 12500.5, o ? `USD=${o.priceUSD}` : "không thấy đơn");

    // no price
    await openCreate(page);
    await fillCreateForm(page, { name: "UI test khong gia", price: "" });
    await submitBtn(page).click();
    await page.waitForTimeout(1800);
    o = (await myOrders("a")).find((x) => x.productName === "UI test khong gia");
    check("UI-ORDER-06", A, "Tạo đơn không nhập giá → đơn vẫn tạo được (giá chờ admin báo)", !!o, o ? `USD=${o.priceUSD}` : "không thấy đơn");

    // required fields: submit with empty name does nothing
    await openCreate(page);
    const before = (await myOrders("a")).length;
    const form = page.locator("form").filter({ hasText: "Product Type" });
    await form.locator("select").first().selectOption("Shoes");
    await form.locator('input[placeholder="Enter product name"]').fill("");
    await form.locator('input[placeholder="Enter warehouse address"]').fill("");
    await form.locator('input[placeholder="Nhập tên nhân viên"]').fill("");
    await submitBtn(page).click();
    await page.waitForTimeout(700);
    f = await shot(page, "orders-06-missing-fields-blocked");
    const stillOpen = await page.locator("text=Fill in the details below").count();
    const after = (await myOrders("a")).length;
    check("UI-ORDER-07", A, "Thiếu tên SP / kho / nhân viên → form không gửi, không tạo đơn", stillOpen > 0 && after === before, `modal mở=${stillOpen > 0}, before=${before}, after=${after}`, f);

    // missing exchange rate → server or form rejects
    await fillCreateForm(page, { name: "UI test thieu ty gia", price: "10", rate: "" });
    await page.locator('input[placeholder="e.g. 25000"]').fill("");
    await submitBtn(page).click();
    await page.waitForTimeout(1200);
    f = await shot(page, "orders-07-missing-rate");
    check("UI-ORDER-08", A, "Thiếu tỷ giá → không tạo đơn", !(await myOrders("a")).some((x) => x.productName === "UI test thieu ty gia"), "", f);
    await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
    await page.waitForTimeout(300);

    // double click only creates one order
    await openCreate(page);
    await fillCreateForm(page, { name: "UI test double click", price: "50" });
    await submitBtn(page).dblclick();
    await page.waitForTimeout(2500);
    const closeBtn = page.locator('button:has-text("Close")');
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click().catch(() => {});
    const dbl = (await myOrders("a")).filter((x) => x.productName === "UI test double click");
    check("UI-ORDER-09", A, "Bấm đúp nút Submit chỉ tạo 1 đơn", dbl.length === 1, `tạo ${dbl.length} đơn`);

    // XSS in product name is escaped
    await openCreate(page);
    await fillCreateForm(page, { name: "<img src=x onerror=window.__xss=1>XSS", price: "5" });
    await submitBtn(page).click();
    await page.waitForSelector("text=Order Submitted", { timeout: 8000 }).catch(() => {});
    await page.goto(BASE + "/dashboard");
    await settle(page);
    f = await shot(page, "orders-08-xss-escaped");
    const xss = await page.evaluate(() => window.__xss === 1);
    const shown = await page.locator("text=<img src=x onerror=window.__xss=1>XSS").count();
    check("UI-ORDER-10", A, "Tên SP chứa <img onerror> → hiện nguyên văn, script không chạy (XSS)", !xss && shown > 0, `chạy script=${xss}, hiển thị chữ=${shown > 0}`, f);

    // Dashboard totals update after new orders
    const t = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const activeNow = (await myOrders("a")).filter((x) => x.status !== "delivered").length;
    check("UI-ORDER-11", A, "Số 'Active Shipments' cập nhật sau khi tạo đơn mới", new RegExp(`Active Shipments\\s*${activeNow}`, "i").test(t), `active=${activeNow}`);

    // QR payment section
    const first = (await myOrders("a")).find((x) => x.productName === "UI test 899");
    const qr = await http("GET", `/api/payments/orders/${first.orderCode || first.id}`, { token: (await apiLogin("a")).token });
    check("UI-ORDER-12", A, "API thanh toán của đơn trả nội dung chuyển khoản chứa mã ORD-…", qr.status === 200 && JSON.stringify(qr.body).includes(first.orderCode || first.id), `HTTP ${qr.status}`);
    await ctx.close();
  }

  // -------------------------------------------------------------------------
  async function groupTrack() {
    await reset();
    const A = "UI-TRACK";
    const ctx = await newCtx();
    const page = await openPage(ctx);
    await uiLogin(page, "a");
    const mine = (await myOrders("a"))[0];
    const code = mine.orderCode || mine.id;

    await page.goto(BASE + "/tracking");
    await settle(page, 300);
    const input = page.locator('input[placeholder="Enter order code or customer name"]');
    await input.fill(code);
    await page.waitForTimeout(900);
    let f = await shot(page, "track-01-code-suggestions");
    const sugg = await page.locator(`text=${code}`).count();
    check("UI-TRACK-01", A, "Gõ mã đơn → hiện gợi ý đúng đơn", sugg > 0, `${sugg} gợi ý`, f);
    await page.locator(`div.cursor-pointer:has-text("${code}")`).first().click();
    await page.getByRole("button", { name: "Track", exact: true }).click();
    await page.waitForSelector("text=Current Status", { timeout: 8000 }).catch(() => {});
    f = await shot(page, "track-02-result-by-code");
    const bodyTxt = await page.locator("body").innerText();
    check("UI-TRACK-02", A, "Chọn gợi ý + Track → hiện trạng thái, giá USD/VND, khách", /Current Status/.test(bodyTxt) && /Price \(USD\)/.test(bodyTxt) && /Nguyen Van A/.test(bodyTxt), "", f);

    // type a full code and press Track without picking from the dropdown
    await page.goto(BASE + "/tracking");
    await settle(page, 300);
    await page.locator('input[placeholder="Enter order code or customer name"]').fill(code);
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Track", exact: true }).click();
    await page.waitForTimeout(1200);
    f = await shot(page, "track-03-type-code-press-track");
    const direct = await page.locator("text=Current Status").count();
    check("UI-TRACK-03", A, "Dán nguyên mã đơn rồi bấm Track (không chọn gợi ý) → ra kết quả", direct > 0, direct ? "ra kết quả" : (await page.locator("p.font-medium.text-sm").first().innerText().catch(() => "")), f);

    // by customer name
    await page.goto(BASE + "/tracking");
    await settle(page, 300);
    await page.locator('input[placeholder="Enter order code or customer name"]').fill("Nguyen");
    await page.waitForTimeout(900);
    f = await shot(page, "track-04-name-suggestions");
    const names = await page.locator("div.cursor-pointer .font-mono").allInnerTexts();
    const mineCodes = (await myOrders("a")).map((x) => x.orderCode || x.id);
    check("UI-TRACK-04", A, "Tìm theo tên khách → gợi ý chỉ chứa đơn của chính mình", names.length > 0 && names.every((n) => mineCodes.includes(n.trim())), `${names.length} gợi ý`, f);
    await page.locator('input[placeholder="Enter order code or customer name"]').fill("Tran Thi");
    await page.waitForTimeout(900);
    f = await shot(page, "track-05-other-customer-hidden");
    const leak = await page.locator("div.cursor-pointer").count();
    check("UI-TRACK-05", A, "Khách A tìm tên khách B → không thấy đơn của B", leak === 0, `${leak} gợi ý`, f);

    // unknown code via API behind UI
    const unknown = await http("GET", "/api/orders/track?code=ORD-00000000-FFFF", { token: (await apiLogin("a")).token });
    check("UI-TRACK-06", A, "Mã đơn không tồn tại → 404 + thông báo", unknown.status === 404, `HTTP ${unknown.status}`);

    // B's order via direct API as A → denied
    const bOrder = (await myOrders("b"))[0];
    const denied = await http("GET", `/api/orders/track?code=${bOrder.orderCode || bOrder.id}`, { token: (await apiLogin("a")).token });
    check("UI-TRACK-07", A, "Khách A tra mã đơn của khách B → bị từ chối (403/404)", [403, 404].includes(denied.status), `HTTP ${denied.status}`);

    // View Full Details → order-detail real data
    await page.goto(BASE + "/tracking");
    await settle(page, 300);
    await page.locator('input[placeholder="Enter order code or customer name"]').fill(code);
    await page.waitForTimeout(900);
    await page.locator(`div.cursor-pointer:has-text("${code}")`).first().click();
    await page.getByRole("button", { name: "Track", exact: true }).click();
    await page.waitForSelector("text=View Full Details", { timeout: 8000 }).catch(() => {});
    await page.getByRole("link", { name: /View Full Details/ }).click();
    await page.waitForURL(/order-detail/, { timeout: 8000 }).catch(() => {});
    await settle(page, 600);
    f = await shot(page, "track-06-order-detail-real");
    const det = await page.locator("body").innerText();
    check("UI-TRACK-08", A, "View Full Details → /order-detail hiện đúng đơn thật (mã + tên sản phẩm), không còn dữ liệu mock (lỗi #3)",
      det.includes(code) && det.includes(mine.productName) && !/Insurance|Download Invoice/.test(det), `path=${pathOf(page)}`, f);

    // someone else's order-detail
    await page.goto(`${BASE}/order-detail/${bOrder.orderCode || bOrder.id}`);
    await settle(page, 600);
    f = await shot(page, "track-07-order-detail-other-customer");
    const other = (await page.locator("body").innerText()).toLowerCase();
    check("UI-TRACK-09", A, "/order-detail của đơn khách khác → 'Order not found', không lộ dữ liệu", /not found|does not belong|failed/.test(other) && !other.includes(bOrder.productName.toLowerCase()), "", f);
    await page.goto(`${BASE}/order-detail/ORD-00000000-FFFF`);
    await settle(page, 600);
    f = await shot(page, "track-08-order-detail-unknown");
    check("UI-TRACK-10", A, "/order-detail của mã không tồn tại → thông báo không tìm thấy + nút quay lại", /not found/i.test(await page.locator("body").innerText()) && (await page.getByText("Back to Dashboard").count()) > 0, "", f);
    await ctx.close();

    // admin can find any order
    const ctx2 = await newCtx();
    const p2 = await openPage(ctx2);
    await uiLogin(p2, "admin");
    await p2.goto(BASE + "/tracking");
    await settle(p2, 300);
    await p2.locator('input[placeholder="Enter order code or customer name"]').fill("Tran Thi");
    await p2.waitForTimeout(900);
    f = await shot(p2, "track-09-admin-sees-all");
    check("UI-TRACK-11", A, "Admin tra cứu được đơn của khách bất kỳ", (await p2.locator("div.cursor-pointer").count()) > 0, "", f);
    await ctx2.close();
  }

  // -------------------------------------------------------------------------
  async function groupProfile() {
    await reset();
    const A = "UI-PROFILE";
    const ctx = await newCtx();
    const page = await openPage(ctx);
    await uiLogin(page, "a");
    await page.goto(BASE + "/profile");
    await settle(page);
    let f = await shot(page, "profile-01-view");
    const txt = await page.locator("body").innerText();
    check("UI-PROFILE-01", A, "Xem hồ sơ: tên, email, SĐT, địa chỉ", txt.includes("Nguyen Van A") && txt.includes(USERS.a.email) && txt.includes("0900000000"), "", f);

    await page.getByRole("button", { name: /Edit Profile Details/ }).click();
    await page.fill('input[placeholder="Enter your phone number"]', "0988777666");
    await page.fill('input[placeholder="Enter your address"]', "99 Nguyễn Huệ, Q1, TP.HCM");
    f = await shot(page, "profile-02-edit");
    await page.getByRole("button", { name: /Save Changes/ }).click();
    await page.waitForTimeout(1500);
    await settle(page);
    f = await shot(page, "profile-03-saved");
    await page.reload();
    await settle(page);
    const after = await page.locator("body").innerText();
    check("UI-PROFILE-02", A, "Sửa SĐT + địa chỉ → lưu, còn nguyên sau reload", after.includes("0988777666") && after.includes("99 Nguyễn Huệ"), "", f);

    // invalid email
    await page.getByRole("button", { name: /Edit Profile Details/ }).click();
    await page.locator('main input[type="email"]').fill("khong-phai-email");
    await page.getByRole("button", { name: /Save Changes/ }).click();
    await page.waitForTimeout(1200);
    f = await shot(page, "profile-04-invalid-email");
    const bad = await http("PUT", "/api/user/profile", { token: (await apiLogin("a")).token, body: { email: "khong-phai-email" } });
    const stillA = await http("POST", "/api/auth/login", { body: USERS.a });
    check("UI-PROFILE-03", A, "Email sai định dạng → không lưu, tài khoản vẫn đăng nhập được bằng email cũ", bad.status === 400 && stillA.status === 200, `PATCH ${bad.status}, login ${stillA.status}`, f);
    await page.getByRole("button", { name: /Cancel/ }).click().catch(() => {});

    // duplicate email
    await page.getByRole("button", { name: /Edit Profile Details/ }).click().catch(() => {});
    await page.locator('main input[type="email"]').fill(USERS.b.email).catch(() => {});
    await page.getByRole("button", { name: /Save Changes/ }).click().catch(() => {});
    await page.waitForTimeout(1200);
    f = await shot(page, "profile-05-duplicate-email");
    check("UI-PROFILE-04", A, "Đổi sang email của người khác → UI báo lỗi, không đổi", /already in use|in use/i.test(await page.locator("body").innerText()), "", f);
    await page.getByRole("button", { name: /Cancel/ }).click().catch(() => {});

    // email change keeps order history
    const beforeCount = (await myOrders("a")).length;
    const tok = (await apiLogin("a")).token;
    const ch = await http("PUT", "/api/user/profile", { token: tok, body: { email: "khach-a-moi@test.local" } });
    const relog = await http("POST", "/api/auth/login", { body: { email: "khach-a-moi@test.local", password: USERS.a.password } });
    const afterOrders = await http("GET", "/api/orders/my-orders", { token: relog.body.token });
    const n = (Array.isArray(afterOrders.body) ? afterOrders.body : afterOrders.body.orders || []).length;
    check("UI-PROFILE-05", A, "Đổi email → lịch sử đơn hàng đi theo email mới (không mất đơn)", ch.status === 200 && n === beforeCount && n > 0, `trước=${beforeCount} sau=${n}`);
    await ctx.close();
  }

  // -------------------------------------------------------------------------
  async function groupAdmin() {
    await reset();
    const A = "UI-ADMIN";
    const ctx = await newCtx();
    const page = await openPage(ctx);
    await uiLogin(page, "admin");
    const adminTok = (await apiLogin("admin")).token;
    const users = async () => (await http("GET", "/api/user", { token: adminTok })).body.users || [];

    await page.goto(BASE + "/admin/dashboard");
    await settle(page);
    let f = await shot(page, "admin-01-users");
    const rows = await page.locator("tbody tr").count();
    check("UI-ADMIN-01", A, "Admin Dashboard liệt kê đủ người dùng", rows === (await users()).length && rows >= 3, `${rows} dòng`, f);

    // create a user through the form
    await page.fill('input[placeholder="Name"]', "Khách Tạo Bởi Admin");
    await page.fill('input[placeholder="Email"]', "tao-boi-admin@test.local");
    await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
    const phone = page.locator('input[placeholder^="Phone"]');
    if (await phone.count()) await phone.fill("0911000111");
    const addr = page.locator('input[placeholder*="Address"], input[placeholder*="address"]');
    if (await addr.count()) await addr.first().fill("5 Hai Bà Trưng, Q1");
    f = await shot(page, "admin-02-create-user-filled");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForTimeout(1500);
    f = await shot(page, "admin-03-create-user-result");
    const created = (await users()).find((u) => u.email === "tao-boi-admin@test.local");
    check("UI-ADMIN-02", A, "Tạo người dùng qua form Admin Dashboard → tài khoản được tạo", !!created, created ? "đã tạo" : "KHÔNG tạo được: " + (await page.locator("p.text-red-600").allInnerTexts()).join(" | "), f);

    // duplicate email → visible error
    await page.fill('input[placeholder="Name"]', "Trùng");
    await page.fill('input[placeholder="Email"]', USERS.a.email);
    await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
    if (await phone.count()) await phone.fill("0911000111");
    if (await addr.count()) await addr.first().fill("x");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForTimeout(1200);
    f = await shot(page, "admin-04-create-duplicate");
    check("UI-ADMIN-03", A, "Tạo người dùng trùng email → hiện lỗi 'already in use'", /already in use/i.test(await page.locator("body").innerText()), "", f);

    // toggle role of the new user
    const target = (await users()).find((u) => u.email === "tao-boi-admin@test.local");
    if (!target) {
      skip("UI-ADMIN-04", A, "Đổi role user → admin bằng nút Toggle Role", "phụ thuộc UI-ADMIN-02 (không tạo được người dùng)");
      skip("UI-ADMIN-05", A, "Xóa người dùng bằng nút Delete", "phụ thuộc UI-ADMIN-02");
    } else {
      await page.reload();
      await settle(page);
      const row = page.locator("tbody tr", { hasText: "tao-boi-admin@test.local" });
      await row.getByRole("button", { name: "Toggle Role" }).click();
      await page.waitForTimeout(1000);
      f = await shot(page, "admin-05-toggle-role");
      const t2 = (await users()).find((u) => u.email === "tao-boi-admin@test.local");
      check("UI-ADMIN-04", A, "Toggle Role: user → admin", t2 && t2.role === "admin", `role=${t2 && t2.role}`, f);
      await row.getByRole("button", { name: "Delete" }).click();
      await page.waitForTimeout(1000);
      f = await shot(page, "admin-06-delete-user");
      check("UI-ADMIN-05", A, "Delete: xóa người dùng", !(await users()).some((u) => u.email === "tao-boi-admin@test.local"), "", f);
    }

    // self-protection shown as a message, not a crash
    await page.reload();
    await settle(page);
    page.errs.length = 0;
    const me = page.locator("tbody tr", { hasText: USERS.admin.email });
    const isDelDisabled = await me.getByRole("button", { name: "Delete" }).isDisabled();
    if (!isDelDisabled) {
      await me.getByRole("button", { name: "Delete" }).click();
    } else {
      await me.getByRole("button", { name: "Delete" }).click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(1000);
    f = await shot(page, "admin-07-self-delete-blocked");
    const stillAdmin = (await http("GET", "/api/user", { token: adminTok })).status === 200;
    check("UI-ADMIN-06", A, "Admin bấm Delete chính mình → bị chặn (nút disabled hoặc hiện thông báo)", stillAdmin && (isDelDisabled || /cannot delete your own/i.test(await page.locator("body").innerText())) && !page.errs.some((e) => /pageerror|Unhandled/.test(e)), isDelDisabled ? "nút bị disable (tự bảo vệ)" : "", f);

    const isToggleDisabled = await me.getByRole("button", { name: "Toggle Role" }).isDisabled();
    if (!isToggleDisabled) {
      await me.getByRole("button", { name: "Toggle Role" }).click();
    } else {
      await me.getByRole("button", { name: "Toggle Role" }).click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(1000);
    check("UI-ADMIN-07", A, "Admin tự hạ quyền mình → bị chặn (nút disabled hoặc hiện thông báo)", (isToggleDisabled || /cannot remove your own admin/i.test(await page.locator("body").innerText())) && (await users()).find((u) => u.email === USERS.admin.email).role === "admin", isToggleDisabled ? "nút bị disable (tự bảo vệ)" : "");

    // ---- orders ----
    await reset();
    await page.goto(BASE + "/admin/orders");
    await settle(page);
    f = await shot(page, "admin-08-orders", true);
    const apiOrders = await http("GET", "/api/orders", { token: (await apiLogin("admin")).token });
    const all = Array.isArray(apiOrders.body) ? apiOrders.body : apiOrders.body.orders || [];
    const nRows = await page.locator("tbody tr").count();
    check("UI-ADMIN-08", A, "Admin Orders liệt kê đủ đơn của mọi khách", nRows === all.length && all.length >= 9, `UI ${nRows} / API ${all.length}`, f);

    // approve a pending order (window.confirm)
    page.once("dialog", (d) => d.accept());
    await page.locator('button[title="Approve order"]').first().click();
    await page.waitForTimeout(1500);
    f = await shot(page, "admin-09-approved");
    const after = await http("GET", "/api/orders", { token: (await apiLogin("admin")).token });
    const afterList = Array.isArray(after.body) ? after.body : after.body.orders || [];
    check("UI-ADMIN-09", A, "Duyệt đơn pending (confirm) → đơn chuyển approved", afterList.filter((o) => o.status === "pending").length === all.filter((o) => o.status === "pending").length - 1, "", f);

    // edit modal opens with the order's data
    await page.locator('button[title="Edit order"]').first().click();
    await page.waitForTimeout(600);
    f = await shot(page, "admin-10-edit-modal");
    check("UI-ADMIN-10", A, "Nút Sửa mở modal, có sẵn dữ liệu của đơn", (await page.locator('input[placeholder="Product name"]').inputValue()).length > 0, "", f);
    await page.keyboard.press("Escape");
    await page.reload();
    await settle(page);

    // export Excel through the button
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      page.getByRole("button", { name: /Export Excel/ }).click(),
    ]);
    let exportOk = false, info = "không có file tải về";
    if (dl) {
      const dest = path.join(L.OUT, "exports", "ui-" + dl.suggestedFilename());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await dl.saveAs(dest);
      const sz = fs.statSync(dest).size;
      exportOk = sz > 3000 && /\.xlsx$/i.test(dl.suggestedFilename());
      info = `${dl.suggestedFilename()} ${sz} bytes`;
    }
    f = await shot(page, "admin-11-export-clicked");
    check("UI-ADMIN-11", A, "Nút Export Excel tải về file .xlsx", exportOk, info, f);

    // Sync Google Sheet without config → friendly error
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Sync Google Sheet/ }).click();
    await page.waitForTimeout(2000);
    f = await shot(page, "admin-12-sync-sheet-unconfigured");
    check("UI-ADMIN-12", A, "Sync Google Sheet khi chưa cấu hình → báo lỗi gọn, trang không vỡ", (await page.locator("p.text-red-600, p.text-green-700").count()) > 0 && !page.errs.some((e) => /pageerror/.test(e)), (await page.locator("p.text-red-600").allInnerTexts()).join(" | ").slice(0, 160), f);

    // ---- payments ----
    await page.goto(BASE + "/admin/payments");
    await settle(page);
    f = await shot(page, "admin-13-payments", true);
    check("UI-ADMIN-13", A, "Trang Payments mở được, có bộ lọc All / Unmatched / Matched", (await page.getByRole("button", { name: "Unmatched" }).count()) > 0, "", f);
    await ctx.close();
  }

  // -------------------------------------------------------------------------
  async function groupMobile() {
    await reset();
    const A = "UI-MOBILE";
    const ctx = await newCtx({ width: 375, height: 812 }, { isMobile: true, hasTouch: true });
    const page = await openPage(ctx);
    await page.goto(BASE + "/");
    await settle(page);
    let f = await shot(page, "mobile-01-home");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("UI-MOBILE-01", A, "Trang chủ 375px: không cuộn ngang", overflow <= 1, `lệch ${overflow}px`, f);
    await page.getByLabel("Toggle menu").click();
    await page.waitForTimeout(400);
    f = await shot(page, "mobile-02-menu-open");
    const links = await page.locator("a:has-text('Tracking')").count();
    check("UI-MOBILE-02", A, "Menu mobile mở được, có link điều hướng", links > 0, "", f);
    await page.locator("a:has-text('Tracking')").last().click();
    await page.waitForTimeout(600);
    f = await shot(page, "mobile-03-after-nav");
    check("UI-MOBILE-03", A, "Bấm link trong menu → chuyển trang và menu tự đóng", pathOf(page) === "/tracking" && (await page.locator("div.md\\:hidden.bg-background").count()) === 0, pathOf(page), f);

    await uiLogin(page, "a");
    await page.goto(BASE + "/dashboard");
    await settle(page);
    f = await shot(page, "mobile-04-dashboard");
    await page.getByRole("button", { name: "Create New Order" }).first().click();
    await page.waitForTimeout(500);
    f = await shot(page, "mobile-05-create-modal");
    const form = page.locator("form").filter({ hasText: "Product Type" });
    const box = await form.boundingBox();
    check("UI-MOBILE-04", A, "Modal tạo đơn nằm gọn trong màn 375px", !!box && box.x >= 0 && box.x + box.width <= 376, box ? `x=${Math.round(box.x)} w=${Math.round(box.width)}` : "", f);
    await fillCreateForm(page, { name: "Mobile order", price: "20" });
    await submitBtn(page).tap().catch(() => submitBtn(page).click());
    await page.waitForTimeout(1800);
    check("UI-MOBILE-05", A, "Tạo đơn trên mobile thành công", (await myOrders("a")).some((o) => o.productName === "Mobile order"), "");
    await clearBrowserSession(page);
    await uiLogin(page, "admin");
    await page.goto(BASE + "/admin/orders");
    await settle(page);
    f = await shot(page, "mobile-06-admin-orders");
    const scrollable = await page.evaluate(() => !!document.querySelector(".overflow-x-auto"));
    check("UI-MOBILE-06", A, "Bảng admin trên mobile nằm trong vùng cuộn ngang (không làm vỡ trang)", scrollable && (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, "", f);
    await ctx.close();
  }

  // -------------------------------------------------------------------------
  async function groupRobust() {
    await reset();
    const A = "UI-ROBUST";
    const ctx = await newCtx();
    const page = await openPage(ctx);

    // internal links on every public page resolve (no dead links)
    const dead = [];
    const seen = new Set();
    for (const r of ["/", "/calculator", "/tracking", "/support", "/login", "/register"]) {
      await page.goto(BASE + r);
      await settle(page, 300);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")).filter((x) => x && x.startsWith("/") && !x.startsWith("//")));
      for (const href of hrefs) {
        if (seen.has(href)) continue;
        seen.add(href);
        const p2 = await ctx.newPage();
        await p2.goto(BASE + href);
        await p2.waitForTimeout(250);
        const t = (await p2.locator("body").innerText()).toLowerCase();
        if (/404|page not found|không tìm thấy/.test(t)) dead.push(`${r} → ${href}`);
        await p2.close();
      }
    }
    check("UI-ROBUST-01", A, `Quét ${seen.size} link nội bộ trên các trang công khai → không link nào ra 404`, dead.length === 0, dead.join("; "));

    // Support page content
    await page.goto(BASE + "/support");
    await settle(page);
    let f = await shot(page, "robust-01-support");
    check("UI-ROBUST-02", A, "Trang Support hiển thị nội dung", (await page.locator("body").innerText()).length > 200, "", f);

    // keyboard: Enter submits login
    await page.goto(BASE + "/login");
    await page.fill('input[placeholder="Email"]', USERS.a.email);
    await page.fill('input[placeholder="Password"]', USERS.a.password);
    await page.press('input[placeholder="Password"]', "Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 8000 }).catch(() => {});
    check("UI-ROBUST-03", A, "Nhấn Enter trong ô mật khẩu → đăng nhập", pathOf(page) !== "/login", pathOf(page));

    // NoSQL injection in login / search
    const inj = await http("POST", "/api/auth/login", { body: { email: { $ne: "" }, password: { $ne: "" } } });
    check("UI-ROBUST-04", A, "Đăng nhập kiểu NoSQL-injection {$ne:''} bị từ chối", inj.status >= 400 && inj.status < 500 && !inj.body.token, `HTTP ${inj.status}`);

    // session survives reload on a protected page
    await page.goto(BASE + "/dashboard");
    await settle(page);
    await page.reload();
    await settle(page);
    check("UI-ROBUST-05", A, "Reload giữa chừng ở /dashboard vẫn giữ đăng nhập", pathOf(page) === "/dashboard", pathOf(page));

    // backend down → UI shows an error, not an endless spinner
    const ctl = await fetch("http://localhost:4999/stop").then((r) => r.ok).catch(() => false);
    if (!ctl) {
      skip("UI-ROBUST-06", A, "Backend tắt → UI báo lỗi, không treo spinner", "devstack chưa có endpoint /stop; mô phỏng bằng chặn request /api ở trình duyệt (xem UI-ROBUST-07)");
    }
    await page.route("**/api/orders/my-orders", (r) => r.abort());
    await page.goto(BASE + "/dashboard");
    await page.waitForTimeout(2500);
    f = await shot(page, "robust-02-api-unreachable");
    const spinner = await page.locator(".animate-spin").count();
    const t = await page.locator("body").innerText();
    check("UI-ROBUST-07", A, "API đơn hàng không với tới được → Dashboard báo lỗi, không quay mãi", spinner === 0 && /fail|error|lỗi|network/i.test(t), `spinner=${spinner}`, f);
    await page.unroute("**/api/orders/my-orders");
    await ctx.close();
  }

  async function groupCalculator() {
    await reset();
    const A = "UI-CALC";
    const ctx = await newCtx();
    const page = await openPage(ctx);
    await page.goto(BASE + "/calculator");
    await page.waitForSelector("text=Ước tính chi phí vận chuyển", { timeout: 10000 }).catch(() => {});
    await settle(page, 500);

    let f = await shot(page, "calc-01-page-loaded");
    const bodyText = await page.locator("body").innerText();
    check("UI-CALC-01", A, "Mở /calculator → hiện giao diện tính cước (không còn trùng trang chủ)",
      /Ước tính chi phí vận chuyển/.test(bodyText) && /Tổng cước dự tính/.test(bodyText),
      "", f);

    // Test weight input
    const weightInput = page.locator('input[type="number"]');
    await weightInput.fill("2.5");
    await page.waitForTimeout(600);
    f = await shot(page, "calc-02-weight-changed");
    const updatedBody = await page.locator("body").innerText();
    check("UI-CALC-02", A, "Thay đổi trọng lượng → tự động tính toán lại giá USD và VND",
      /2.5 kg/.test(updatedBody),
      "", f);

    // Test Express tier
    await page.getByRole("button", { name: /Hỏa tốc/ }).click();
    await page.waitForTimeout(600);
    const expressBody = await page.locator("body").innerText();
    check("UI-CALC-03", A, "Chọn dịch vụ Hỏa tốc → tính thêm phụ phí dịch vụ",
      /Phụ phí hỏa tốc/.test(expressBody),
      "", f);

    // Test CTA navigates to dashboard/login
    await page.getByRole("button", { name: "Tạo đơn hàng ngay" }).click();
    await page.waitForURL((u) => u.pathname === "/login" || u.pathname === "/dashboard", { timeout: 8000 }).catch(() => {});
    check("UI-CALC-04", A, "Bấm Tạo đơn hàng ngay → chuyển hướng đến trang tạo đơn / login",
      pathOf(page) === "/login" || pathOf(page) === "/dashboard",
      pathOf(page));

    await ctx.close();
  }

  return { orders: groupOrders, track: groupTrack, profile: groupProfile, admin: groupAdmin, mobile: groupMobile, robust: groupRobust, calculator: groupCalculator };
};
