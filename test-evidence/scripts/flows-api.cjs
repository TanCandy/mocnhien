// API-level flow matrix (auth, profile, orders, admin, payments, permissions, public).
// Needs devstack.cjs running.  Run: node test-evidence/scripts/flows-api.cjs [group...]
const path = require("path");
const jwt = require(path.resolve(__dirname, "../../backend/node_modules/jsonwebtoken"));
const L = require("./lib.cjs");
const { check, skip, http, login, reset, restart, API } = L;

const SECRET = "e2e-local-secret-not-for-production-use-0123456789";
const ISSUER = "moc-nhien-authentic";
const KEY = { Authorization: "Apikey e2e-sepay-key" };
const fakeId = "64b000000000000000000000";
const only = process.argv.slice(2);
const want = (g) => only.length === 0 || only.includes(g);
const orderOf = (r) => r.body.order || r.body;

async function tokens() {
  const [admin, a, b] = await Promise.all([login("admin"), login("a"), login("b")]);
  return { admin, a, b, T: { admin: admin.token, a: a.token, b: b.token } };
}
const find = async (T, code) => ((await http("GET", "/api/orders/search?q=" + code, { token: T.admin })).body.orders || []).find((o) => o.orderCode === code);
const findAny = async (T, code) => {
  const r = await http("GET", "/api/orders/track?code=" + code, { token: T.admin });
  return r.body.order;
};
const createOrder = (token, over = {}) =>
  http("POST", "/api/orders", {
    token,
    body: { productType: "general", productName: "Test item", warehouseAddress: "1 WH Rd", staffName: "Lan", exchangeRate: 25000, ...over },
  });
const evt = (id, amount, content, extra = {}) => ({
  id, gateway: "MSB", transactionDate: "2026-10-02 10:00:00", accountNumber: "80002725995",
  transferType: "in", transferAmount: amount, content, referenceCode: "FT" + id, ...extra,
});

async function groupAuth() {
  await reset();
  const A = "AUTH";
  const good = { email: "khach-a@test.local", password: L.PASS };
  let r = await http("POST", "/api/auth/login", { body: good });
  check("AUTH-01", A, "Khách đăng nhập đúng → 200 + token, role=user", r.status === 200 && r.body.token && r.body.user?.role === "user", `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/login", { body: L.USERS.admin });
  check("AUTH-02", A, "Admin đăng nhập đúng → role=admin", r.status === 200 && r.body.user?.role === "admin", `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/login", { body: { ...good, password: "sai-mat-khau" } });
  const wrong = r;
  check("AUTH-03", A, "Sai mật khẩu → 401", r.status === 401, `HTTP ${r.status} ${r.body.message}`);
  r = await http("POST", "/api/auth/login", { body: { email: "khong-ton-tai@test.local", password: "x123456" } });
  check("AUTH-04", A, "Email không tồn tại → 401, cùng thông báo với sai MK (không lộ tài khoản)", r.status === 401 && r.body.message === wrong.body.message, `HTTP ${r.status} ${r.body.message}`);
  r = await http("POST", "/api/auth/login", { body: { email: good.email } });
  check("AUTH-05", A, "Đăng nhập thiếu mật khẩu → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/login", { body: { email: { $ne: "" }, password: { $ne: "" } } });
  check("AUTH-06", A, "NoSQL injection ở login ({\"$ne\":\"\"}) bị từ chối", r.status === 400 || r.status === 401, `HTTP ${r.status}`);

  await restart(); // reset in-memory auth rate limiter (10 req/15 min budget)
  const reg = { name: "Khach Moi", email: "khach-moi@test.local", password: "Abc12345", phoneNumber: "0911222333", primaryAddress: "12 Le Loi, Q1" };
  r = await http("POST", "/api/auth/register", { body: { ...reg, role: "admin" } });
  check("AUTH-07", A, "Đăng ký thành công → 201, role luôn là user (dù gửi role=admin)", r.status === 201 && r.body.user?.role === "user" && r.body.token, `HTTP ${r.status} role=${r.body.user?.role}`);
  r = await http("POST", "/api/auth/register", { body: reg });
  check("AUTH-08", A, "Đăng ký email trùng → 409", r.status === 409, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/register", { body: { ...reg, email: "x1@test.local", password: "123" } });
  check("AUTH-09", A, "Đăng ký mật khẩu < 6 ký tự → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/register", { body: { ...reg, email: "x2@test.local", phoneNumber: "" } });
  check("AUTH-10", A, "Đăng ký thiếu SĐT → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/register", { body: { ...reg, email: "x3@test.local", primaryAddress: "" } });
  check("AUTH-11", A, "Đăng ký thiếu địa chỉ → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/register", { body: { ...reg, email: "x4@test.local", phoneNumber: "abc" } });
  check("AUTH-12", A, "Đăng ký SĐT sai định dạng → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/register", { body: { ...reg, email: "khong-phai-email" } });
  check("AUTH-13", A, "Đăng ký email sai định dạng → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/login", { body: { email: "khach-moi@test.local", password: "Abc12345" } });
  check("AUTH-14", A, "Tài khoản vừa đăng ký đăng nhập được", r.status === 200, `HTTP ${r.status}`);

  await restart(); // reset in-memory auth rate limiter (budget)
  const f1 = await http("POST", "/api/auth/forgot-password", { body: { email: good.email } });
  const f2 = await http("POST", "/api/auth/forgot-password", { body: { email: "khong-co@test.local" } });
  check("AUTH-15", A, "Quên mật khẩu: email có/không tồn tại trả cùng phản hồi (không lộ email)", f1.status === f2.status && f1.body.message === f2.body.message && f1.status === 200, `có=${f1.status} không=${f2.status}`);
  r = await http("POST", "/api/auth/forgot-password", { body: {} });
  check("AUTH-16", A, "Quên mật khẩu thiếu email → 400", r.status === 400, `HTTP ${r.status}`);

  const tk = await (await fetch("http://localhost:4999/reset-token?email=khach-b@test.local")).text();
  r = await http("POST", "/api/auth/reset-password", { body: { token: tk, newPassword: "12345" } });
  check("AUTH-17", A, "Reset MK < 6 ký tự → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/reset-password", { body: { token: "token-sai", newPassword: "Moi-Pass-456" } });
  check("AUTH-18", A, "Reset với token sai → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/reset-password", { body: { token: tk, newPassword: "Moi-Pass-456" } });
  check("AUTH-19", A, "Reset với token hợp lệ → 200 và tự đăng nhập (trả token)", r.status === 200 && !!r.body.token, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/login", { body: { email: "khach-b@test.local", password: L.PASS } });
  check("AUTH-20", A, "Mật khẩu cũ không còn dùng được sau reset", r.status === 401, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/login", { body: { email: "khach-b@test.local", password: "Moi-Pass-456" } });
  check("AUTH-21", A, "Mật khẩu mới đăng nhập được", r.status === 200, `HTTP ${r.status}`);
  r = await http("POST", "/api/auth/reset-password", { body: { token: tk, newPassword: "Lai-Lan-789" } });
  check("AUTH-22", A, "Token reset chỉ dùng được 1 lần", r.status === 400, `HTTP ${r.status}`);
  const exp = await (await fetch("http://localhost:4999/reset-token?email=khach-a@test.local&expired=1")).text();
  r = await http("POST", "/api/auth/reset-password", { body: { token: exp, newPassword: "Moi-Pass-456" } });
  check("AUTH-23", A, "Token reset hết hạn → 400", r.status === 400, `HTTP ${r.status}`);

  await restart(); // reset in-memory auth rate limiter (budget)
  r = await http("POST", "/api/auth/logout");
  check("AUTH-24", A, "Logout → 200 (xóa cookie)", r.status === 200, `HTTP ${r.status}`);

  const lg = await http("POST", "/api/auth/login", { body: good });
  const me = (t) => http("GET", "/api/user/profile", { token: t });
  r = await me();
  check("AUTH-25", A, "Gọi API không có token → 401", r.status === 401, `HTTP ${r.status}`);
  r = await me("abc.def.ghi");
  check("AUTH-26", A, "Token rác → 401", r.status === 401, `HTTP ${r.status}`);
  const uid = lg.body.user._id || lg.body.user.id;
  r = await me(jwt.sign({ sub: uid, id: uid }, "secret-khac", { issuer: ISSUER }));
  check("AUTH-27", A, "Token ký bằng secret khác (giả mạo) → 401", r.status === 401, `HTTP ${r.status}`);
  r = await me(jwt.sign({ sub: uid, id: uid }, SECRET, { issuer: ISSUER, expiresIn: -10 }));
  check("AUTH-28", A, "Token đã hết hạn → 401", r.status === 401, `HTTP ${r.status}`);
  r = await me(lg.body.token);
  check("AUTH-29", A, "Token hợp lệ → 200", r.status === 200 && r.body.user?.email === good.email, `HTTP ${r.status}`);
  const adm = await login("admin");
  const nu = await http("POST", "/api/user", { token: adm.token, body: { name: "Tam", email: "tam@test.local", password: "Abc12345", phoneNumber: "0900000001", primaryAddress: "x" } });
  const tl = await http("POST", "/api/auth/login", { body: { email: "tam@test.local", password: "Abc12345" } });
  await http("DELETE", "/api/user/" + (nu.body.user._id || nu.body.user.id), { token: adm.token });
  r = await me(tl.body.token);
  check("AUTH-30", A, "Token của user đã bị xóa → 401", r.status === 401, `HTTP ${r.status}`);

  // rate limit — must stay last in the group (burns the 10/15-min budget)
  await restart();
  let last = 0, firstBlocked = 0;
  for (let i = 1; i <= 12; i++) {
    const x = await http("POST", "/api/auth/login", { body: { ...good, password: "sai" + i } });
    last = x.status;
    if (x.status === 429 && !firstBlocked) firstBlocked = i;
  }
  check("AUTH-31", A, "Rate limit: sai liên tục → 429 từ lần thứ 11", firstBlocked === 11, `chặn từ lần ${firstBlocked || "không bị chặn"}, lần 12 → HTTP ${last}`);
}

async function groupProfile() {
  await reset();
  const { T } = await tokens();
  const A = "PROFILE";
  let r = await http("PUT", "/api/user/profile", { token: T.a, body: { phoneNumber: "0987654321", primaryAddress: "99 Nguyen Hue, Q1" } });
  check("PRF-01", A, "Sửa SĐT + địa chỉ → 200", r.status === 200 && r.body.user.phoneNumber === "0987654321", `HTTP ${r.status}`);
  r = await http("GET", "/api/user/profile", { token: T.a });
  check("PRF-02", A, "Thay đổi được lưu (đọc lại profile)", r.body.user.primaryAddress === "99 Nguyen Hue, Q1", r.body.user?.primaryAddress);
  r = await http("PUT", "/api/user/profile", { token: T.a, body: {} });
  check("PRF-03", A, "Sửa profile body rỗng → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("PUT", "/api/user/profile", { token: T.a, body: { email: "khach-b@test.local" } });
  check("PRF-04", A, "Đổi sang email đã có người dùng → 409", r.status === 409, `HTTP ${r.status}`);
  r = await http("PUT", "/api/user/profile", { token: T.a, body: { phoneNumber: "0987654321", role: "admin" } });
  const pr = await http("GET", "/api/user/profile", { token: T.a });
  check("PRF-05", A, "Khách không tự nâng quyền được qua profile (role vẫn là user)", pr.body.user.role === "user", `role=${pr.body.user.role}`);
  r = await http("PUT", "/api/user/profile", { token: T.a, body: { email: "khong-phai-email" } });
  check("PRF-06", A, "Đổi email sang chuỗi không hợp lệ bị từ chối (400)", r.status === 400, `HTTP ${r.status} (nếu 200 = lỗi: email rác được lưu)`);
  await reset();
  const t2 = await tokens();
  r = await http("PATCH", "/api/me", { token: t2.T.a, body: { name: "Ten Moi" } });
  check("PRF-07", A, "PATCH /api/me đổi tên → 200", r.status === 200 && r.body.user.name === "Ten Moi", `HTTP ${r.status}`);
  r = await http("PATCH", "/api/me", { token: t2.T.a, body: { name: "   " } });
  check("PRF-08", A, "PATCH /api/me tên rỗng → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("PATCH", "/api/me", { token: t2.T.a, body: { role: "admin" } });
  const g = await http("GET", "/api/user/profile", { token: t2.T.a });
  check("PRF-09", A, "PATCH /api/me không đổi được role", g.body.user.role === "user", `role=${g.body.user.role}`);
  // email change vs orders (orders are matched by userEmail)
  const before = (await http("GET", "/api/orders/my-orders", { token: t2.T.a })).body.count;
  await http("PUT", "/api/user/profile", { token: t2.T.a, body: { email: "khach-a-moi@test.local" } });
  const re = await http("POST", "/api/auth/login", { body: { email: "khach-a-moi@test.local", password: L.PASS } });
  const after = re.body.token ? (await http("GET", "/api/orders/my-orders", { token: re.body.token })).body.count : -1;
  check("PRF-10", A, "Đổi email xong vẫn thấy đơn hàng cũ của mình", after === before, `trước=${before} sau=${after} (nếu 0 = đơn mồ côi vì khớp theo userEmail)`);
}

async function groupOrders() {
  await reset();
  const { T } = await tokens();
  const A = "ORDER";
  const rate = 25600;
  let r = await createOrder(T.a, { priceUSD: 899, exchangeRate: rate });
  let o = orderOf(r);
  check("ORD-01", A, "Khách tạo đơn 899 USD → 201, pending, total = 899 × tỷ giá", r.status === 201 && o.status === "pending" && o.totalVND === 899 * rate, `HTTP ${r.status} totalVND=${o.totalVND}`);
  check("ORD-02", A, "Mã đơn đúng định dạng ORD-xxxxxxxx-xxxx", /^ORD-[0-9A-Z]{8}-[0-9A-F]{4}$/i.test(o.orderCode || ""), o.orderCode);
  r = await createOrder(T.a, { priceUSD: "1,299", exchangeRate: rate });
  o = orderOf(r);
  check("ORD-03", A, "Giá nhập \"1,299\" (có dấu phẩy) → lưu 1.299 USD (lỗi #1 đã sửa)", o.totalVND === 1299 * rate && o.priceUSD === 1299, `totalVND=${o.totalVND} (kỳ vọng ${1299 * rate})`);
  r = await createOrder(T.a, { priceUSD: "12,500.50", exchangeRate: rate });
  o = orderOf(r);
  check("ORD-04", A, "Giá \"12,500.50\" → 12.500,5 USD", o.priceUSD === 12500.5 && o.totalVND === Math.round(12500.5 * rate), `priceUSD=${o.priceUSD}`);
  r = await createOrder(T.a, { exchangeRate: undefined });
  o = orderOf(r);
  check("ORD-05", A, "Đơn không có giá → tạo được, tổng = 0", r.status === 201 && (o.totalVND || 0) === 0, `HTTP ${r.status}`);
  r = await createOrder(T.a, { warehouseAddress: "  " });
  check("ORD-06", A, "Thiếu địa chỉ kho → 400", r.status === 400, `HTTP ${r.status}`);
  r = await createOrder(T.a, { staffName: "" });
  check("ORD-07", A, "Thiếu tên nhân viên → 400", r.status === 400, `HTTP ${r.status}`);
  r = await createOrder(T.a, { productName: "" });
  check("ORD-08", A, "Thiếu tên sản phẩm → 400", r.status === 400, `HTTP ${r.status}`);
  r = await createOrder(T.a, { priceUSD: 50, exchangeRate: 0 });
  check("ORD-09", A, "Có giá nhưng tỷ giá = 0 → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/orders", { body: { productName: "x" } });
  check("ORD-10", A, "Tạo đơn khi chưa đăng nhập → 401", r.status === 401, `HTTP ${r.status}`);
  r = await createOrder(T.a, { productLink: "khong-co-https.com/abc", priceUSD: 10 });
  check("ORD-11", A, "Link sản phẩm không có https:// → vẫn tạo được (không crash)", r.status === 201, `HTTP ${r.status}`);

  const mineA = (await http("GET", "/api/orders/my-orders", { token: T.a })).body;
  const mineB = (await http("GET", "/api/orders/my-orders", { token: T.b })).body;
  check("ORD-12", A, "my-orders: khách A chỉ thấy đơn của A", mineA.orders.every((x) => x.userEmail ? x.userEmail === "khach-a@test.local" : true) && mineA.count === mineA.orders.length, `A=${mineA.count}`);
  const aCodes = new Set(mineA.orders.map((x) => x.orderCode));
  check("ORD-13", A, "my-orders: A và B không có đơn chung", mineB.orders.every((x) => !aCodes.has(x.orderCode)), `B=${mineB.count}`);

  const bOrder = mineB.orders[0];
  r = await http("GET", "/api/orders/" + (bOrder._id || bOrder.id), { token: T.a });
  check("ORD-14", A, "Khách A xem đơn của khách B theo id → 403/404", r.status === 403 || r.status === 404, `HTTP ${r.status}`);
  r = await http("GET", "/api/orders/track?code=" + bOrder.orderCode, { token: T.a });
  check("ORD-15", A, "Khách A tracking mã đơn của B → 404", r.status === 404, `HTTP ${r.status}`);
  r = await http("GET", "/api/orders/track?code=" + bOrder.orderCode, { token: T.admin });
  check("ORD-16", A, "Admin tracking mã đơn bất kỳ → 200 + timeline", r.status === 200 && Array.isArray(r.body.order?.timeline) && r.body.order.timeline.length > 0, `HTTP ${r.status}`);
  r = await http("GET", "/api/orders/track?code=ORD-KHONG-TON-TAI", { token: T.a });
  check("ORD-17", A, "Tracking mã không tồn tại → 404", r.status === 404, `HTTP ${r.status}`);
  r = await http("GET", "/api/orders/track", { token: T.a });
  check("ORD-18", A, "Tracking thiếu mã → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("GET", "/api/orders/track?code=" + mineA.orders[0].orderCode, { token: T.a });
  check("ORD-19", A, "Khách tracking đơn của mình → 200", r.status === 200, `HTTP ${r.status}`);

  r = await http("GET", "/api/orders/search?q=ORD-20260806", { token: T.a });
  check("ORD-20", A, "Search theo mã (khách A) trả đúng đơn của A", r.status === 200 && (r.body.orders || r.body).some?.((x) => x.orderCode === "ORD-20260806-A001"), `HTTP ${r.status}`);
  r = await http("GET", "/api/orders/search?q=ORD-0819", { token: T.a });
  const leak = (r.body.orders || r.body || []).filter?.((x) => x.orderCode === "ORD-20260819-A001") || [];
  check("ORD-21", A, "Search của khách A không lộ đơn của B (ORD-20260819-A001)", leak.length === 0, `leak=${leak.length}`);
  for (const q of [".*", "(", "[a-", "\\"]) {
    r = await http("GET", "/api/orders/search?q=" + encodeURIComponent(q), { token: T.a });
    if (r.status >= 500) { check("ORD-22", A, `Search regex đặc biệt không gây 500 (q=${q})`, false, `HTTP ${r.status}`); break; }
    if (q === "\\") check("ORD-22", A, "Search với ký tự regex đặc biệt (.*, (, [a-, \\) không gây 500", true, "4 truy vấn đều < 500");
  }
  r = await http("GET", "/api/orders/search?q=ORD&q=x", { token: T.a });
  check("ORD-23", A, "Search tham số lặp (?q=a&q=b) không gây 500", r.status < 500, `HTTP ${r.status}`);
  r = await http("GET", "/api/orders/khong-phai-objectid", { token: T.admin });
  check("ORD-24", A, "GET đơn với id không hợp lệ → 404 (không 500)", r.status === 404, `HTTP ${r.status}`);
  r = await createOrder(T.a, { productName: "<script>alert(1)</script><img src=x onerror=alert(2)>", priceUSD: 5 });
  check("ORD-25", A, "Tên SP chứa <script> được lưu nguyên văn (UI phải escape — kiểm ở flows-ui)", r.status === 201, `HTTP ${r.status}`);

  // payments info / QR
  const mine = orderOf(await createOrder(T.a, { priceUSD: 100, exchangeRate: 25000 }));
  r = await http("GET", "/api/payments/orders/" + (mine._id || mine.id), { token: T.a });
  check("ORD-26", A, "Thông tin thanh toán + QR của đơn mình: số tiền đúng, nội dung chứa mã đơn", r.status === 200 && r.body.qr?.amount === 2500000 && r.body.transferContent.replace(/[^A-Z0-9]/gi, "").includes(mine.orderCode.replace(/[^A-Z0-9]/gi, "")), `state=${r.body.state} amount=${r.body.qr?.amount} content=${r.body.transferContent}`);
  r = await http("GET", "/api/payments/orders/" + (bOrder._id || bOrder.id), { token: T.a });
  check("ORD-27", A, "Khách A xem QR/thanh toán của đơn B → 403", r.status === 403, `HTTP ${r.status}`);
  r = await http("GET", "/api/payments/orders/" + fakeId, { token: T.a });
  check("ORD-28", A, "Thanh toán của đơn không tồn tại → 404", r.status === 404, `HTTP ${r.status}`);

  // customer cannot mutate
  const id = mine._id || mine.id;
  const ops = [["PUT", "/api/orders/" + id, { status: "delivered" }], ["DELETE", "/api/orders/" + id], ["PUT", `/api/orders/${id}/approve`], ["POST", `/api/orders/${id}/recalculate`], ["POST", "/api/orders/admin", { productName: "x" }]];
  const codes = [];
  for (const [m, u, b] of ops) codes.push((await http(m, u, { token: T.a, body: b })).status);
  check("ORD-29", A, "Khách không sửa/xóa/duyệt/tính lại/tạo-admin được đơn → 403", codes.every((c) => c === 403), codes.join(","));
  const still = await findAny(T, mine.orderCode);
  check("ORD-30", A, "Đơn vẫn nguyên vẹn sau các lần thử trái phép", still && still.status === "pending", still?.status);

  // concurrency: two quick submits = two orders (documented behaviour; the UI must disable the button)
  const [c1, c2] = await Promise.all([createOrder(T.a, { productName: "Song song", priceUSD: 1 }), createOrder(T.a, { productName: "Song song", priceUSD: 1 })]);
  check("ORD-31", A, "2 yêu cầu tạo đơn đồng thời → 2 mã đơn khác nhau, không lỗi trùng mã", c1.status === 201 && c2.status === 201 && orderOf(c1).orderCode !== orderOf(c2).orderCode, `${c1.status}/${c2.status}`);
}

async function groupAdmin() {
  await reset();
  const { T } = await tokens();
  const A = "ADMIN";
  let r = await http("GET", "/api/orders", { token: T.admin });
  const list = r.body.orders || r.body;
  check("ADM-01", A, "Admin liệt kê toàn bộ đơn (9 đơn seed)", r.status === 200 && list.length === 9, `HTTP ${r.status} n=${list.length}`);
  r = await http("GET", "/api/orders?status=delivered", { token: T.admin });
  const d = r.body.orders || r.body;
  check("ADM-02", A, "Lọc theo trạng thái delivered", d.length === 4 && d.every((x) => x.status === "delivered"), `n=${d.length}`);

  r = await http("POST", "/api/orders/admin", { token: T.admin, body: { productType: "general", productName: "Admin tạo email", warehouseAddress: "WH", staffName: "Lan", customerName: "Khach A", contactType: "email", contactValue: "khach-a@test.local", priceUSD: "1,250", exchangeRate: 25000, tracking_code: "TRK-ADM-1" } });
  let ao = orderOf(r);
  check("ADM-03", A, "Admin tạo đơn (contact email, giá \"1,250\") → 201, total đúng", r.status === 201 && ao.totalVND === 1250 * 25000, `HTTP ${r.status} total=${ao.totalVND}`);
  const mineA = (await http("GET", "/api/orders/my-orders", { token: T.a })).body.orders;
  check("ADM-04", A, "Đơn admin tạo cho email khách xuất hiện ở my-orders của khách", mineA.some((x) => x.orderCode === ao.orderCode), "");
  r = await http("POST", "/api/orders/admin", { token: T.admin, body: { productType: "general", productName: "Admin SĐT", warehouseAddress: "WH", staffName: "Lan", customerName: "Khach SDT", contactType: "phone", contactValue: "0912345678" } });
  check("ADM-05", A, "Admin tạo đơn contact = phone → 201", r.status === 201, `HTTP ${r.status} ${r.body.message || ""}`);
  r = await http("POST", "/api/orders/admin", { token: T.admin, body: { productType: "general", productName: "Admin none", warehouseAddress: "WH", staffName: "Lan", customerName: "Khach none", contactType: "none" } });
  check("ADM-06", A, "Admin tạo đơn contact = none → 201", r.status === 201, `HTTP ${r.status} ${r.body.message || ""}`);
  r = await http("POST", "/api/orders/admin", { token: T.admin, body: { productType: "general", productName: "x", warehouseAddress: "WH", staffName: "Lan", customerName: "", contactType: "none" } });
  check("ADM-07", A, "Admin tạo đơn thiếu tên khách → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/orders/admin", { token: T.admin, body: { productType: "general", productName: "x", warehouseAddress: "WH", staffName: "Lan", customerName: "K", contactType: "fax" } });
  check("ADM-08", A, "contactType không hợp lệ → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/orders/admin", { token: T.admin, body: { productType: "general", productName: "x", warehouseAddress: "WH", staffName: "Lan", customerName: "K", contactType: "none", tracking_code: "TRK-ADM-1" } });
  check("ADM-09", A, "Trùng tracking_code → 409", r.status === 409, `HTTP ${r.status}`);

  r = await http("POST", "/api/orders/admin", { token: T.admin, body: { productName: "x", warehouseAddress: "WH", staffName: "Lan", customerName: "K", contactType: "none" } });
  check("ADM-09b", A, "Admin tạo đơn thiếu productType → 400 (không 500)", r.status === 400, `HTTP ${r.status} ${r.body.message || ""}`);
  const id = ao._id || ao.id;
  r = await http("PUT", `/api/orders/${id}/approve`, { token: T.admin });
  check("ADM-10", A, "Duyệt đơn pending → approved", r.status === 200, `HTTP ${r.status} ${r.body.message || ""}`);
  r = await http("PUT", `/api/orders/${id}/approve`, { token: T.admin });
  check("ADM-11", A, "Duyệt lần 2 → 400 (chỉ duyệt đơn pending)", r.status === 400, `HTTP ${r.status}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { priceUSD: "2,000", exchangeRate: 26000 } });
  ao = orderOf(r);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { status: "shipping" } });
  check("ADM-13-shipping", A, "Chuyển trạng thái → shipping", r.status === 200 && orderOf(r).status === "shipping", `HTTP ${r.status} status=${orderOf(r).status}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { uspsTracking: "9400111899223344556677" } });
  check("ADM-14", A, "Cập nhật mã USPS", r.status === 200 && orderOf(r).uspsTracking === "9400111899223344556677", `HTTP ${r.status}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { status: "shipping", paidAmount: 20000000 } });
  ao = orderOf(r);
  check("ADM-15", A, "Nhập tiền cọc 20.000.000 → còn nợ 32.000.000, chưa paid", r.status === 200 && ao.paidAmount === 20000000 && ao.remainingAmount === 32000000 && ao.paymentStatus !== "paid", `paid=${ao.paidAmount} remain=${ao.remainingAmount} pay=${ao.paymentStatus}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { paidAmount: 30000000, expectedPaidAmount: 1 } });
  check("ADM-16", A, "expectedPaidAmount lệch (có chuyển khoản chen vào) → 409, không ghi đè", r.status === 409, `HTTP ${r.status}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { paidAmount: 52000000, expectedPaidAmount: 20000000 } });
  check("ADM-17", A, "Trả đủ 52.000.000 → paymentStatus = paid", r.status === 200 && orderOf(r).paymentStatus === "paid", `pay=${orderOf(r).paymentStatus}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { status: "delivered" } });
  check("ADM-13-delivered", A, "Chuyển trạng thái → delivered", r.status === 200 && orderOf(r).status === "delivered", `HTTP ${r.status} status=${orderOf(r).status}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { priceUSD: "" } });
  check("ADM-18", A, "Xóa giá (rỗng) → không crash", r.status < 500, `HTTP ${r.status}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { exchangeRate: 0, priceUSD: 10 } });
  check("ADM-19", A, "Tỷ giá = 0 → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("PUT", `/api/orders/${fakeId}`, { token: T.admin, body: { status: "shipping" } });
  check("ADM-20", A, "Sửa đơn không tồn tại → 404", r.status === 404, `HTTP ${r.status}`);
  r = await http("PUT", `/api/orders/khong-hop-le`, { token: T.admin, body: { status: "shipping" } });
  check("ADM-21", A, "Sửa đơn với id không hợp lệ → 4xx (không 500)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await http("PUT", `/api/orders/${id}`, { token: T.admin, body: { status: "hoan-toan-sai" } });
  check("ADM-22", A, "Trạng thái không hợp lệ bị từ chối (4xx)", r.status >= 400 && r.status < 500, `HTTP ${r.status} (nếu 200 = lỗi: trạng thái rác được lưu)`);

  const seeded = await findAny(T, "ORD-20261001-A001");
  r = await http("PUT", `/api/orders/${seeded._id || seeded.id}`, { token: T.admin, body: { priceUSD: 80, exchangeRate: 25000 } });
  r = await http("POST", `/api/orders/${seeded._id || seeded.id}/recalculate`, { token: T.admin });
  check("ADM-23", A, "Recalculate VND từ USD × tỷ giá", r.status === 200, `HTTP ${r.status} ${r.body.message || ""}`);
  const noPrice = orderOf(await http("POST", "/api/orders/admin", { token: T.admin, body: { productType: "general", productName: "Khong gia", warehouseAddress: "WH", staffName: "L", customerName: "K", contactType: "none" } }));
  r = await http("POST", `/api/orders/${noPrice._id || noPrice.id}/recalculate`, { token: T.admin });
  check("ADM-24", A, "Recalculate đơn không có giá USD → 400", r.status === 400, `HTTP ${r.status}`);

  r = await http("DELETE", `/api/orders/${noPrice._id || noPrice.id}`, { token: T.admin });
  check("ADM-25", A, "Xóa đơn → 200", r.status === 200, `HTTP ${r.status}`);
  r = await http("DELETE", `/api/orders/${noPrice._id || noPrice.id}`, { token: T.admin });
  check("ADM-26", A, "Xóa lại đơn đã xóa → 404", r.status === 404, `HTTP ${r.status}`);
  r = await http("DELETE", `/api/orders/khong-hop-le`, { token: T.admin });
  check("ADM-27", A, "Xóa với id không hợp lệ → 400", r.status === 400, `HTTP ${r.status}`);

  r = await http("POST", "/api/orders/sheets/resync", { token: T.admin });
  check("ADM-28", A, "Sync Google Sheet khi chưa cấu hình → báo lỗi gọn (không 500 crash)", r.status < 500 || /not configured|chưa|disabled/i.test(JSON.stringify(r.body)), `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  r = await http("GET", "/api/dashboard/summary", { token: T.admin });
  check("ADM-29", A, "Dashboard summary → 200", r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
  r = await http("GET", "/api/dashboard/summary", { token: T.a });
  check("ADM-30", A, "Dashboard summary của khách → 200 (số liệu của riêng khách)", r.status === 200, `HTTP ${r.status}`);

  // Users
  const A2 = "ADMIN-USERS";
  r = await http("GET", "/api/user", { token: T.admin });
  check("USR-01", A2, "Admin liệt kê user (3 user), không lộ password", r.status === 200 && r.body.users.length === 3 && r.body.users.every((u) => !("password" in u)), `HTTP ${r.status}`);
  const nu = { name: "Nhan Vien", email: "nv@test.local", password: "Abc12345", phoneNumber: "0900000009", primaryAddress: "Q3" };
  r = await http("POST", "/api/user", { token: T.admin, body: nu });
  const uid = r.body.user?._id || r.body.user?.id;
  check("USR-02", A2, "Admin tạo user → 201, không trả password", r.status === 201 && !("password" in r.body.user), `HTTP ${r.status}`);
  r = await http("POST", "/api/user", { token: T.admin, body: nu });
  check("USR-03", A2, "Tạo user trùng email → 409", r.status === 409, `HTTP ${r.status}`);
  r = await http("POST", "/api/user", { token: T.admin, body: { ...nu, email: "n2@test.local", phoneNumber: "" } });
  check("USR-04", A2, "Tạo user thiếu SĐT → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("PATCH", "/api/user/" + uid, { token: T.admin, body: { role: "admin" } });
  check("USR-05", A2, "Đổi role user → admin", r.status === 200 && r.body.user.role === "admin", `HTTP ${r.status}`);
  r = await http("PATCH", "/api/user/" + uid, { token: T.admin, body: { role: "user", name: "Nhan Vien 2" } });
  check("USR-06", A2, "Hạ role admin → user + đổi tên", r.status === 200 && r.body.user.role === "user" && r.body.user.name === "Nhan Vien 2", `HTTP ${r.status}`);
  r = await http("PATCH", "/api/user/" + uid, { token: T.admin, body: { password: "hack" } });
  const relog = await http("POST", "/api/auth/login", { body: { email: "nv@test.local", password: "Abc12345" } });
  check("USR-07", A2, "PATCH user không đổi được mật khẩu/email (mass-assignment)", relog.status === 200, `đăng nhập MK cũ → HTTP ${relog.status}`);
  r = await http("PATCH", "/api/user/" + fakeId, { token: T.admin, body: { name: "x" } });
  check("USR-08", A2, "Sửa user không tồn tại → 404", r.status === 404, `HTTP ${r.status}`);
  r = await http("PATCH", "/api/user/khong-hop-le", { token: T.admin, body: { name: "x" } });
  check("USR-09", A2, "Sửa user id không hợp lệ → 4xx (không 500)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await http("DELETE", "/api/user/khong-hop-le", { token: T.admin });
  check("USR-10", A2, "Xóa user id không hợp lệ → 4xx (không 500)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await http("DELETE", "/api/user/" + uid, { token: T.admin });
  check("USR-11", A2, "Xóa user → 200", r.status === 200, `HTTP ${r.status}`);
  r = await http("DELETE", "/api/user/" + uid, { token: T.admin });
  check("USR-12", A2, "Xóa lại user → 404", r.status === 404, `HTTP ${r.status}`);
  const adminId = T.admin && (await login("admin")).user.id;
  r = await http("DELETE", "/api/user/" + adminId, { token: T.admin });
  check("USR-13", A2, "Admin không được tự xóa chính mình", r.status >= 400 && r.status < 500, `HTTP ${r.status} (nếu 200 = admin tự xóa được tài khoản của mình)`);
  if (r.status < 400) await reset();
  const t2 = await tokens();
  const adminId2 = t2.admin.user._id || t2.admin.user.id;
  r = await http("PATCH", "/api/user/" + adminId2, { token: t2.T.admin, body: { role: "user" } });
  check("USR-14", A2, "Admin không được tự hạ quyền chính mình (tránh hệ thống không còn admin)", r.status >= 400 && r.status < 500, `HTTP ${r.status} (nếu 200 = admin tự hạ quyền được)`);
  if (r.status < 400) await reset();
}

async function groupPayments() {
  await reset();
  const { T } = await tokens();
  const A = "PAYMENT";
  const hook = (e, h = KEY) => http("POST", "/api/payments/webhook/sepay", { body: e, headers: h });
  const target = await findAny(T, "ORD-20261001-A001"); // 59.99 × 25600 = 1,535,744 , paid 0, pending
  await http("PUT", `/api/orders/${target._id || target.id}/approve`, { token: T.admin });
  const code = "ORD-20261001-A001";
  const total = Math.round(59.99 * 25600);
  const content = code.replace(/-/g, "");
  let r = await hook(evt(7001, 1000, content), { Authorization: "Apikey sai" });
  check("PAY-01", A, "Webhook sai API key → 401", r.status === 401, `HTTP ${r.status}`);
  r = await hook(evt(7001, 1000, content), {});
  check("PAY-02", A, "Webhook không có key → 401", r.status === 401, `HTTP ${r.status}`);
  r = await hook({ ...evt(7002, 1000, content), id: undefined });
  check("PAY-03", A, "Webhook thiếu mã giao dịch → 400", r.status === 400, `HTTP ${r.status}`);
  r = await hook(evt(7003, 500000, content));
  let o = await findAny(T, code);
  check("PAY-04", A, "Chuyển khoản một phần 500.000 → cộng vào đơn, chưa paid", r.status === 200 && o.paidAmount === 500000 && o.paymentStatus !== "paid", `HTTP ${r.status} paid=${o.paidAmount} ${o.paymentStatus}`);
  r = await hook(evt(7003, 500000, content));
  o = await findAny(T, code);
  check("PAY-05", A, "Webhook gửi trùng cùng mã GD → không cộng 2 lần", o.paidAmount === 500000, `paid=${o.paidAmount}`);
  r = await hook(evt(7004, 300000, `thanh toan don ${code.toLowerCase()} cam on`));
  o = await findAny(T, code);
  check("PAY-06", A, "Nội dung chữ thường, có chữ thừa vẫn khớp mã đơn; cộng dồn 2 lần chuyển", o.paidAmount === 800000, `paid=${o.paidAmount}`);
  r = await hook(evt(7005, 50000, "CHUYEN KHOAN KHONG RO"));
  check("PAY-07", A, "Chuyển khoản không có mã đơn → 200, lưu vào Unmatched", r.status === 200, `HTTP ${r.status}`);
  r = await hook(evt(7006, 1000, content, { transferType: "out" }));
  check("PAY-08", A, "Giao dịch chuyển ra (out) bị bỏ qua", r.status === 200 && /outgoing/.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  r = await hook(evt(7007, 0, content));
  check("PAY-09", A, "Số tiền ≤ 0 bị bỏ qua", r.status === 200 && /non-positive/.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  r = await hook(evt(7008, 70000, content, { accountNumber: "11112222" }));
  check("PAY-10", A, "Chuyển vào tài khoản khác bị bỏ qua", r.status === 200 && /other account/.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  const remain = total - 800000;
  r = await hook(evt(7009, remain + 100000, content));
  o = await findAny(T, code);
  check("PAY-11", A, "Chuyển dư tiền → đơn thành paid, còn nợ = 0", o.paymentStatus === "paid" && (o.remainingAmount || 0) === 0, `paid=${o.paidAmount} ${o.paymentStatus} remain=${o.remainingAmount}`);

  r = await http("GET", "/api/payments", { token: T.admin });
  check("PAY-12", A, "Admin xem danh sách giao dịch (có webhookConfigured)", r.status === 200 && r.body.payments.length >= 4 && r.body.webhookConfigured === true, `HTTP ${r.status} n=${r.body.payments?.length}`);
  r = await http("GET", "/api/payments?status=unmatched", { token: T.admin });
  const um = r.body.payments || [];
  check("PAY-13", A, "Lọc Unmatched: chỉ trả giao dịch chưa khớp", um.length === 1 && um.every((p) => p.status === "unmatched"), `n=${um.length}`);
  r = await http("GET", "/api/payments?status=matched", { token: T.admin });
  check("PAY-14", A, "Lọc Matched: không lẫn giao dịch Unmatched", (r.body.payments || []).every((p) => p.status === "matched"), `n=${r.body.payments?.length}`);

  const other = await findAny(T, "ORD-20261002-A001"); // 144 × 25600 = 3,686,400, paid 1,000,000
  const pid = um[0]._id;
  r = await http("POST", `/api/payments/${pid}/assign`, { token: T.admin, body: {} });
  check("PAY-15", A, "Gán giao dịch thiếu orderCode → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", `/api/payments/${pid}/assign`, { token: T.admin, body: { orderCode: "ORD-SAI-MA" } });
  check("PAY-16", A, "Gán vào mã đơn không tồn tại → lỗi 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status} ${r.body.message || ""}`);
  r = await http("POST", `/api/payments/${pid}/assign`, { token: T.admin, body: { orderCode: "ORD-20261002-A001" } });
  const after = await findAny(T, "ORD-20261002-A001");
  check("PAY-17", A, "Gán giao dịch Unmatched vào đơn → paidAmount tăng 50.000", r.status === 200 && after.paidAmount === (other.paidAmount || 0) + 50000, `HTTP ${r.status} ${other.paidAmount} → ${after.paidAmount}`);
  r = await http("POST", `/api/payments/${pid}/assign`, { token: T.admin, body: { orderCode: "ORD-20261002-A001" } });
  const after2 = await findAny(T, "ORD-20261002-A001");
  check("PAY-18", A, "Gán lại giao dịch đã gán → bị từ chối, không cộng 2 lần", r.status >= 400 && after2.paidAmount === after.paidAmount, `HTTP ${r.status} paid=${after2.paidAmount}`);
  r = await http("POST", `/api/payments/${fakeId}/assign`, { token: T.admin, body: { orderCode: "ORD-20261002-A001" } });
  check("PAY-19", A, "Gán giao dịch không tồn tại → 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await http("GET", "/api/payments", { token: T.a });
  check("PAY-20", A, "Khách xem danh sách giao dịch → 403", r.status === 403, `HTTP ${r.status}`);
  r = await http("POST", `/api/payments/${pid}/assign`, { token: T.a, body: { orderCode: "ORD-20260806-A001" } });
  check("PAY-21", A, "Khách gán giao dịch → 403", r.status === 403, `HTTP ${r.status}`);
  const done = await http("GET", "/api/payments/orders/" + (target._id || target.id), { token: T.a });
  check("PAY-22", A, "Đơn đã thanh toán đủ: state=paid, không còn QR", done.status === 200 && done.body.state === "paid" && done.body.qr === null, `state=${done.body.state}`);
}

async function groupPublic() {
  await reset();
  const { T } = await tokens();
  const A = "PUBLIC";
  let r = await http("POST", "/api/quotes", { body: { weightKg: 2 } });
  check("PUB-01", A, "Báo giá vận chuyển 2 kg → 200 có giá", r.status === 200 && JSON.stringify(r.body).length > 5, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
  r = await http("POST", "/api/quotes", { body: {} });
  check("PUB-02", A, "Báo giá thiếu cân nặng → 400", r.status === 400, `HTTP ${r.status}`);
  r = await http("POST", "/api/quotes", { body: { weightKg: -5 } });
  check("PUB-03", A, "Báo giá cân nặng âm → không trả giá âm / không 500", r.status < 500 && !(r.status === 200 && Number(r.body.total ?? r.body.price ?? 0) < 0), `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
  r = await fetch(API + "/health");
  check("PUB-04", A, "/health → 200", r.status === 200, `HTTP ${r.status}`);
  const x = await http("GET", "/api/khong-co-endpoint-nay");
  check("PUB-05", A, "Endpoint /api lạ → 404 JSON", x.status === 404 && !!x.body.error, `HTTP ${x.status}`);
  r = await fetch(API + "/api/user/profile", { headers: { Origin: "https://evil.example" } });
  check("PUB-06", A, "CORS: origin lạ bị chặn (không có Access-Control-Allow-Origin)", !r.headers.get("access-control-allow-origin"), `HTTP ${r.status} ACAO=${r.headers.get("access-control-allow-origin")}`);
  r = await fetch(API + "/api/khong-co", { headers: { Origin: "http://localhost:3000" } });
  check("PUB-07", A, "CORS: origin frontend được phép", r.headers.get("access-control-allow-origin") === "http://localhost:3000", r.headers.get("access-control-allow-origin"));
  r = await fetch(API + "/health");
  check("PUB-08", A, "Header bảo mật (helmet): có x-content-type-options, không lộ x-powered-by", r.headers.get("x-content-type-options") === "nosniff" && !r.headers.get("x-powered-by"), `nosniff=${r.headers.get("x-content-type-options")} powered=${r.headers.get("x-powered-by")}`);
  r = await fetch(API + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + T.a }, body: "{khong-phai-json" });
  check("PUB-09", A, "Body JSON hỏng → 400 (không 500); stack chỉ hiện ở dev, production được test riêng ở errorHandler.test.js", r.status === 400, `HTTP ${r.status}`);
  r = await fetch(API + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + T.a }, body: JSON.stringify({ productName: "x".repeat(1_200_000) }) });
  check("PUB-10", A, "Body > 1 MB bị từ chối (413)", r.status === 413, `HTTP ${r.status}`);
}

async function groupMatrix() {
  await reset();
  const { T } = await tokens();
  const A = "PERMISSION";
  const ep = [
    ["GET", "/api/user"], ["POST", "/api/user", {}], ["PATCH", "/api/user/" + fakeId, {}], ["DELETE", "/api/user/" + fakeId],
    ["POST", "/api/orders/admin", {}], ["PUT", "/api/orders/" + fakeId, {}], ["DELETE", "/api/orders/" + fakeId],
    ["PUT", `/api/orders/${fakeId}/approve`], ["POST", `/api/orders/${fakeId}/recalculate`],
    ["GET", "/api/orders/export"], ["POST", "/api/orders/sheets/resync"],
    ["GET", "/api/payments"], ["POST", `/api/payments/${fakeId}/assign`, { orderCode: "x" }],
    ["POST", "/api/send-test-email", {}], ["GET", "/api/email-status"],
  ];
  const authed = [["GET", "/api/orders/my-orders"], ["GET", "/api/orders"], ["GET", "/api/user/profile"], ["GET", "/api/me"], ["GET", "/api/dashboard/summary"], ["GET", "/api/orders/track?code=x"], ["GET", "/api/orders/search?q=x"], ["GET", `/api/payments/orders/${fakeId}`], ["POST", "/api/orders", {}]];
  const rows = [];
  let bad = 0;
  for (const [m, u, b] of ep) {
    const anon = (await http(m, u, { body: b })).status;
    const cust = (await http(m, u, { token: T.a, body: b })).status;
    const sendMail = u === "/api/send-test-email";
    const adm = sendMail ? "—" : (await http(m, u, { token: T.admin, body: b })).status;
    const ok = anon === 401 && cust === 403 && (adm === "—" || (adm !== 401 && adm !== 403));
    if (!ok) bad++;
    rows.push({ endpoint: `${m} ${u.replace(fakeId, ":id")}`, anon, cust, adm, ok });
  }
  for (const [m, u, b] of authed) {
    const anon = (await http(m, u, { body: b })).status;
    const cust = (await http(m, u, { token: T.a, body: b })).status;
    const ok = anon === 401 && cust !== 401 && cust !== 403;
    if (!ok) bad++;
    rows.push({ endpoint: `${m} ${u.replace(fakeId, ":id")}`, anon, cust, adm: "(= khách)", ok });
  }
  require("fs").writeFileSync(path.join(L.LOGS, "permission-matrix.json"), JSON.stringify(rows, null, 2));
  check("SEC-01", A, `Ma trận phân quyền ${rows.length} endpoint × {ẩn danh, khách, admin}: admin-only ⇒ 401/403/≠403`, bad === 0, bad ? rows.filter((x) => !x.ok).map((x) => `${x.endpoint}(${x.anon}/${x.cust}/${x.adm})`).join("; ") : `${rows.length}/${rows.length} đúng`);
  skip("SEC-02", A, "Gửi email thật (send-test-email / forgot-password đến hộp thư)", "Cần SMTP/Resend thật — không có trong môi trường test; chỉ kiểm tra phản hồi API");
  skip("SEC-03", A, "Đồng bộ Google Sheets thật", "Cần Service Account + Spreadsheet ID thật; kiểm tra khi chưa cấu hình ở ADM-28");
}

(async () => {
  const groups = { auth: groupAuth, profile: groupProfile, orders: groupOrders, admin: groupAdmin, payments: groupPayments, public: groupPublic, matrix: groupMatrix };
  for (const [name, fn] of Object.entries(groups)) {
    if (!want(name)) continue;
    console.log(`\n=== ${name} ===`);
    try {
      await fn();
    } catch (e) {
      check(`ERR-${name}`, name, `Nhóm ${name} bị lỗi script`, false, e.stack || e);
    }
  }
  L.save(only.length ? `flows-api-${only.join("-")}.json` : "flows-api.json");
  const ok = L.results.filter((x) => x.ok === true).length, fail = L.results.filter((x) => x.ok === false).length, sk = L.results.filter((x) => x.ok === null).length;
  console.log(`\n${ok} pass, ${fail} fail, ${sk} skip / ${L.results.length}`);
})();
