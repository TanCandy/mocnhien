// Browser UI flows (real Chrome via playwright-core) with screenshots + assertions.
//   node test-evidence/scripts/flows-ui.cjs [group...]     groups: auth guard orders track profile admin mobile robust
// Needs devstack.cjs (backend :4000, control :4999) and the Vite dev server (:3000) running.
// Results -> logs/flows-ui[-groups].json ; screenshots -> screenshots/ui-*.png
const path = require("path");
const fs = require("fs");
const L = require("./lib.cjs");
const { BASE, API, CHROME, USERS, SHOTS, check, skip, http, login: apiLogin, reset, restart, control } = L;

const { chromium } = L.playwright();
const groups = process.argv.slice(2);
const want = (g) => groups.length === 0 || groups.includes(g);

let browser;
const fakeId = "64b000000000000000000000";

async function newCtx(vp = { width: 1366, height: 850 }, extra = {}) {
  return browser.newContext({ viewport: vp, locale: "en-US", ...extra });
}
/** Open a page that records console errors / failed requests. */
async function openPage(ctx) {
  const page = await ctx.newPage();
  page.errs = [];
  page.bad = [];
  page.on("console", (m) => { if (m.type() === "error") page.errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => page.errs.push("pageerror: " + String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400) page.bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, "")}`); });
  return page;
}
const shot = async (page, name, full = false) => {
  const file = `ui-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS, file), fullPage: full });
  return file;
};
const settle = async (page, ms = 500) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};
const pathOf = (page) => new URL(page.url()).pathname;

async function uiLogin(page, who, { wait = true } = {}) {
  const u = typeof who === "string" ? USERS[who] : who;
  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', u.email);
  await page.fill('input[placeholder="Password"]', u.password);
  await Promise.all([
    wait ? page.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 10000 }).catch(() => {}) : Promise.resolve(),
    page.click("form button"),
  ]);
  await settle(page);
}
const clearBrowserSession = async (page) => {
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
};
const tokenInStorage = (page) => page.evaluate(() => localStorage.getItem("auth_token"));

// ---------------------------------------------------------------------------
async function groupAuth() {
  await reset();
  const A = "UI-AUTH";
  const ctx = await newCtx();
  const page = await openPage(ctx);

  await page.goto(BASE + "/login");
  await page.fill('input[placeholder="Email"]', USERS.a.email);
  await page.fill('input[placeholder="Password"]', "sai-mat-khau");
  await page.click("form button");
  await page.waitForTimeout(1200);
  let f = await shot(page, "auth-01-login-wrong-password");
  const errText = (await page.locator("form").innerText()).toLowerCase();
  check("UI-AUTH-01", A, "Đăng nhập sai mật khẩu → ở lại /login, hiện lỗi, không lưu token",
    pathOf(page) === "/login" && /invalid|incorrect|failed|sai/.test(errText) && !(await tokenInStorage(page)), `path=${pathOf(page)}`, f);

  await uiLogin(page, "a");
  f = await shot(page, "auth-02-customer-logged-in");
  check("UI-AUTH-02", A, "Khách đăng nhập đúng → rời /login, có token", pathOf(page) !== "/login" && !!(await tokenInStorage(page)), `→ ${pathOf(page)}`, f);
  const nav = (await page.locator("nav, header").first().innerText()).toLowerCase();
  check("UI-AUTH-03", A, "Navbar khách: có Logout, không có mục Admin", /logout/.test(nav) && !/admin/.test(nav), nav.replace(/\s+/g, " ").slice(0, 120));

  // reload keeps the session
  await page.goto(BASE + "/profile");
  await settle(page);
  await page.reload();
  await settle(page);
  check("UI-AUTH-04", A, "Reload /profile giữa chừng vẫn giữ đăng nhập", pathOf(page) === "/profile" && (await page.locator("text=" + USERS.a.email).count()) > 0, pathOf(page));

  // logout
  await page.getByRole("button", { name: /^logout$/i }).first().click();
  await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
  await settle(page);
  f = await shot(page, "auth-03-after-logout");
  check("UI-AUTH-05", A, "Logout → về /login, xóa token + session", pathOf(page) === "/login" && !(await tokenInStorage(page)), `path=${pathOf(page)}`, f);
  await page.goto(BASE + "/profile");
  await settle(page);
  check("UI-AUTH-06", A, "Sau logout, /profile bị chặn → /login", pathOf(page) === "/login", pathOf(page));

  // admin login lands on admin area
  await clearBrowserSession(page);
  await uiLogin(page, "admin");
  f = await shot(page, "auth-04-admin-logged-in");
  check("UI-AUTH-07", A, "Admin đăng nhập → /admin/dashboard", pathOf(page) === "/admin/dashboard", pathOf(page), f);
  const anav = (await page.locator("nav, header").first().innerText()).toLowerCase();
  check("UI-AUTH-08", A, "Navbar admin có mục quản trị (Orders/Payments)", /orders/.test(anav) && /payments/.test(anav), anav.replace(/\s+/g, " ").slice(0, 140));
  // already logged in → /login bounces away
  await page.goto(BASE + "/login");
  await settle(page);
  check("UI-AUTH-09", A, "Đã đăng nhập mà vào /login → bị chuyển đi", pathOf(page) !== "/login", pathOf(page));
  await clearBrowserSession(page);

  // register through the UI
  await page.goto(BASE + "/register");
  await page.fill('input[placeholder="Full name"]', "Khách Mới UI");
  await page.fill('input[placeholder="Email"]', "khach-moi-ui@test.local");
  await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
  await page.fill('input[placeholder^="Phone"]', "0911222333");
  await page.fill('input[placeholder="Primary Address"]', "12 Lê Lợi, Q1, TP.HCM");
  f = await shot(page, "auth-05-register-filled");
  await page.click("form button");
  await page.waitForTimeout(2000);
  await settle(page);
  f = await shot(page, "auth-06-register-result");
  const reg = await http("POST", "/api/auth/login", { body: { email: "khach-moi-ui@test.local", password: "E2e-Pass-123" } });
  check("UI-AUTH-10", A, "Đăng ký qua UI → tài khoản role=user đăng nhập được", reg.status === 200 && reg.body.user?.role === "user", `HTTP ${reg.status} → ${pathOf(page)}`, f);
  await clearBrowserSession(page);

  // register validation: duplicate email, weak password
  await page.goto(BASE + "/register");
  await page.fill('input[placeholder="Full name"]', "Trùng Email");
  await page.fill('input[placeholder="Email"]', USERS.a.email);
  await page.fill('input[placeholder="Password"]', "E2e-Pass-123");
  await page.fill('input[placeholder^="Phone"]', "0911222333");
  await page.fill('input[placeholder="Primary Address"]', "x");
  await page.click("form button");
  await page.waitForTimeout(1200);
  f = await shot(page, "auth-07-register-duplicate-email");
  check("UI-AUTH-11", A, "Đăng ký email đã tồn tại → báo lỗi, ở lại /register", pathOf(page) === "/register" && /already|in use|exist|tồn tại/i.test(await page.locator("body").innerText()), pathOf(page), f);
  await page.fill('input[placeholder="Email"]', "yeu@test.local");
  await page.fill('input[placeholder="Password"]', "123");
  await page.click("form button");
  await page.waitForTimeout(1000);
  check("UI-AUTH-12", A, "Đăng ký mật khẩu quá ngắn → bị từ chối", pathOf(page) === "/register" && !(await tokenInStorage(page)), pathOf(page));

  // forgot password: same reply for existing and unknown emails
  const replies = [];
  for (const email of [USERS.a.email, "khong-ton-tai@test.local"]) {
    await page.goto(BASE + "/forgot-password");
    await page.fill('input[placeholder="Email"]', email);
    await page.click("form button");
    await page.waitForTimeout(1500);
    replies.push((await page.locator("body").innerText()).replace(/\s+/g, " "));
    if (email === USERS.a.email) f = await shot(page, "auth-08-forgot-password-sent");
  }
  const strip = (t) => t.replace(/khach-a@test\.local|khong-ton-tai@test\.local/g, "");
  check("UI-AUTH-13", A, "Quên mật khẩu: email có/không tồn tại → cùng một thông báo (không lộ tài khoản)", strip(replies[0]) === strip(replies[1]) && /sent|link|check/i.test(replies[0]), replies[0].slice(-120), f);
  await restart(); // reset the in-memory rate limiter

  // reset password with a real token
  const tk = { token: (await (await fetch("http://localhost:4999/reset-token?email=" + encodeURIComponent(USERS.b.email))).text()).trim() };
  await page.goto(`${BASE}/reset-password?token=${tk.token}`);
  await settle(page);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill("Mat-Khau-Moi-9");
  await pw.nth(1).fill("Mat-Khau-Moi-9");
  f = await shot(page, "auth-09-reset-password-form");
  await page.click("form button");
  await page.waitForTimeout(2000);
  await settle(page);
  f = await shot(page, "auth-10-reset-password-done");
  const relog = await http("POST", "/api/auth/login", { body: { email: USERS.b.email, password: "Mat-Khau-Moi-9" } });
  const oldlog = await http("POST", "/api/auth/login", { body: USERS.b });
  check("UI-AUTH-14", A, "Đặt lại mật khẩu bằng token hợp lệ → đăng nhập mật khẩu mới, mật khẩu cũ hết hiệu lực", relog.status === 200 && oldlog.status === 401, `new=${relog.status} old=${oldlog.status}`, f);
  const reuse = await http("POST", "/api/auth/reset-password", { body: { token: tk.token, newPassword: "Khac-Nua-12345" } });
  check("UI-AUTH-15", A, "Token đặt lại đã dùng → không dùng lại được", reuse.status === 400, `HTTP ${reuse.status}`);
  const tk2 = { token: (await (await fetch("http://localhost:4999/reset-token?email=" + encodeURIComponent(USERS.a.email) + "&expired=1")).text()).trim() };
  await page.goto(`${BASE}/reset-password?token=${tk2.token}`);
  await settle(page);
  const pw2 = page.locator('input[type="password"]');
  await pw2.nth(0).fill("Mat-Khau-Moi-9");
  await pw2.nth(1).fill("Mat-Khau-Moi-9");
  await page.click("form button");
  await page.waitForTimeout(1500);
  f = await shot(page, "auth-11-reset-password-expired");
  check("UI-AUTH-16", A, "Token hết hạn → UI báo lỗi, không đổi mật khẩu", /invalid|expired|hết hạn/i.test(await page.locator("body").innerText()) && (await http("POST", "/api/auth/login", { body: USERS.a })).status === 200, "", f);

  await ctx.close();
}

// ---------------------------------------------------------------------------
async function groupGuard() {
  await reset();
  const A = "UI-GUARD";
  const ctx = await newCtx();
  const page = await openPage(ctx);
  const A_orders = (await http("GET", "/api/orders/my-orders", { token: (await apiLogin("a")).token })).body;
  const mineId = (A_orders.orders || A_orders)[0]._id;

  for (const [id, route] of [["01", "/dashboard"], ["02", "/profile"], ["03", `/order-detail/${mineId}`], ["04", "/admin/orders"], ["05", "/admin/payments"], ["06", "/admin/dashboard"]]) {
    await page.goto(BASE + route);
    await settle(page, 300);
    const f = await shot(page, `guard-${id}-anon-${route.replace(/[^a-z]+/gi, "-").slice(1, 24)}`);
    check(`UI-GUARD-${id}`, A, `Chưa đăng nhập vào ${route.replace(mineId, ":id")} → chuyển /login`, pathOf(page) === "/login", pathOf(page), f);
  }

  await uiLogin(page, "a");
  for (const [id, route] of [["07", "/admin/orders"], ["08", "/admin/payments"], ["09", "/admin/dashboard"]]) {
    await page.goto(BASE + route);
    await settle(page, 300);
    const f = await shot(page, `guard-${id}-customer-${route.replace(/[^a-z]+/gi, "-").slice(1, 24)}`);
    check(`UI-GUARD-${id}`, A, `Khách vào ${route} → bị đẩy ra khỏi khu admin`, !pathOf(page).startsWith("/admin"), pathOf(page), f);
  }

  // forged / expired token in localStorage → bounced to /login and token dropped
  await clearBrowserSession(page);
  await page.goto(BASE + "/login");
  await page.evaluate(() => localStorage.setItem("auth_token", "token.gia.mao"));
  await page.goto(BASE + "/profile");
  await settle(page);
  check("UI-GUARD-10", A, "Token giả trong localStorage → /profile chuyển /login và token bị xóa", pathOf(page) === "/login" && !(await tokenInStorage(page)), `${pathOf(page)} token=${await tokenInStorage(page)}`);

  // 404
  await clearBrowserSession(page);
  await page.goto(BASE + "/trang-khong-ton-tai");
  await settle(page);
  const f404 = await shot(page, "guard-11-not-found");
  const body404 = (await page.locator("body").innerText()).toLowerCase();
  check("UI-GUARD-11", A, "URL lạ → trang 404 có link về trang chủ", /404|not found|không tìm thấy/.test(body404) && (await page.locator('a[href="/"]').count()) > 0, body404.replace(/\s+/g, " ").slice(0, 100), f404);
  await page.goto(BASE + "/order-detail/" + fakeId);
  await settle(page, 300);
  check("UI-GUARD-12", A, "/order-detail/:id khi chưa đăng nhập → /login", pathOf(page) === "/login", pathOf(page));

  // console / network hygiene on public pages (the 401 /api/user/profile noise is gone)
  const pub = ["/", "/calculator", "/tracking", "/support", "/login", "/register", "/forgot-password"];
  const dirty = [];
  for (const r of pub) {
    const p = await openPage(ctx);
    await p.goto(BASE + r);
    await settle(p, 400);
    if (p.errs.length || p.bad.length) dirty.push(`${r}: ${[...p.errs, ...p.bad].join(" | ").slice(0, 160)}`);
    await p.close();
  }
  check("UI-GUARD-13", A, "7 trang công khai: console sạch, không request 4xx/5xx (không còn 401 /api/user/profile)", dirty.length === 0, dirty.join(" ;; "));
  await ctx.close();
}

const all = { auth: groupAuth, guard: groupGuard };
module.exports = { all, newCtx, openPage, shot, settle, pathOf, uiLogin, clearBrowserSession, tokenInStorage, setBrowser: (b) => (browser = b), want };

if (require.main === module) {
  (async () => {
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ executablePath: CHROME, headless: true });
    }
    const extra = require("./flows-ui-more.cjs");
    Object.assign(all, extra.register(module.exports));
    for (const g of Object.keys(all)) {
      if (!want(g)) continue;
      console.log(`\n=== ui:${g} ===`);
      try {
        await all[g]();
      } catch (e) {
        console.error(`[flows-ui:${g}] ERROR:`, e.stack || e);
        check("UI-" + g.toUpperCase() + "-CRASH", "UI-" + g.toUpperCase(), "Nhóm flow bị lỗi script: " + String(e).split("\n")[0], false, String(e).slice(0, 280));
      }
    }
    await browser.close();
    const r = L.results;
    L.save(groups.length ? `flows-ui-${groups.join("-")}.json` : "flows-ui.json");
    console.log(`\n${r.filter((x) => x.ok === true).length} pass, ${r.filter((x) => x.ok === false).length} fail, ${r.filter((x) => x.ok === null).length} skip / ${r.length}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
