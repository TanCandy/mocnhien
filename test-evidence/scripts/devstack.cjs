// Local test stack: in-memory MongoDB + seed data + the real backend on :4000.
// Control port :4999  ->  GET /restart (new backend process, resets the in-memory
// auth rate limiter)  |  GET /reseed (drop all data, seed again, restart backend).
// Test-only fixtures; nothing here touches a real database.
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");
const BE = path.join(ROOT, "backend");
const req = (p) => require(path.join(BE, "node_modules", p));

const ENV = {
  NODE_ENV: "development",
  PORT: "4000",
  JWT_SECRET: "e2e-local-secret-not-for-production-use-0123456789",
  ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:4000",
  CLIENT_URL: "http://localhost:3000",
  FRONTEND_BASE_URL: "http://localhost:3000",
  SEPAY_WEBHOOK_API_KEY: "e2e-sepay-key",
  PAYMENT_BANK_BIN: "970426",
  PAYMENT_BANK_NAME: "MSB",
  PAYMENT_ACCOUNT_NUMBER: "80002725995",
  PAYMENT_ACCOUNT_NAME: "LE THI DIEU",
};

async function seed() {
  const User = require(path.join(BE, "models/User"));
  const Order = require(path.join(BE, "models/Order"));
  const Payment = require(path.join(BE, "models/Payment"));
  await Promise.all([User.deleteMany({}), Order.deleteMany({}), Payment.deleteMany({})]);
  const mk = (name, email, role) =>
    User.create({ name, email, password: "E2e-Pass-123", role, phoneNumber: "0900000000", primaryAddress: "1 Test St, HCMC" });
  const admin = await mk("Admin E2E", "admin-e2e@test.local", "admin");
  const c1 = await mk("Nguyen Van A", "khach-a@test.local", "user");
  const c2 = await mk("Tran Thi B", "khach-b@test.local", "user");
  const rows = [
    // [code, user, name, link, usd, rate, paid, status, createdAt, staff, kg]
    ["ORD-20260806-A001", c1, "Nike Air Force 1", "https://www.nike.com/t/air-force-1", 120, 25400, 3048000, "delivered", "2026-08-06T03:00:00Z", "Lan", 1.2],
    ["ORD-20260819-A001", c2, "Túi Coach Tabby", "https://www.coach.com/tabby", 295, 25400, 0, "shipping", "2026-08-19T05:00:00Z", "Minh", 0.9],
    ["ORD-20260903-A001", c1, "iPhone 16 case", "", 35, 25500, 892500, "delivered", "2026-09-03T02:00:00Z", "Lan", null],
    ["ORD-20260912-A001", c2, "Vitamin D3 (3 chai)", "https://www.iherb.com/pr/d3", 48.5, 25500, 600000, "approved", "2026-09-12T08:30:00Z", "Hà", 1.5],
    ["ORD-20260930-A001", c1, "Áo Patagonia", "https://www.patagonia.com/fleece", 149, 25500, 3799500, "approved", "2026-09-30T18:30:00Z", "Minh", 0.8],
    ["ORD-20261001-A001", c1, "Laptop stand", "https://amazon.com/dp/B0TEST1", 59.99, 25600, 0, "pending", "2026-10-01T02:00:00Z", "Lan", 2.0],
    ["ORD-20261001-A002", c2, "Son Mac Ruby Woo", "", 22, 25600, 563200, "delivered", "2026-10-01T09:00:00Z", "Hà", 0.1],
    ["ORD-20261002-A001", c2, "Giày Hoka Clifton", "https://www.hoka.com/clifton", 144, 25600, 1000000, "shipping", "2026-10-02T04:00:00Z", "Minh", 1.1],
    ["ORD-20261002-A002", c1, "Sách tiếng Anh (5 cuốn)", "not-a-link", 87.2, 25600, 2232320, "delivered", "2026-10-02T06:00:00Z", "Lan", 3.4],
  ];
  for (const [code, user, name, link, usd, rate, paid, status, at, staff, kg] of rows) {
    const vnd = Math.round(usd * rate);
    await Order.create({
      orderCode: code, user: user._id, userEmail: user.email, productType: "general", productName: name,
      productLink: link || undefined, warehouseAddress: "1 Warehouse Rd, CA 90001", staffName: staff,
      customerName: user.name, contactType: "email", contactValue: user.email, status,
      priceUSD: usd, totalUSD: usd, exchangeRate: rate, priceVND: vnd, totalVND: vnd, paidAmount: paid,
      remainingAmount: Math.max(0, vnd - paid), paymentStatus: paid >= vnd ? "paid" : "pending",
      weightKg: kg || undefined, createdAt: new Date(at), updatedAt: new Date(at),
    });
  }
  return { rows: rows.length, admin };
}

(async () => {
  const { MongoMemoryServer } = req("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create({ instance: { port: 27018 } });
  Object.assign(process.env, ENV, { MONGODB_URI: mongod.getUri("moc-nhien-e2e") });
  delete process.env.WEBHOOK_URL;

  const mongoose = req("mongoose");
  await mongoose.connect(process.env.MONGODB_URI);
  await require(path.join(BE, "models/Payment")).init();
  console.log("[devstack] seeded 3 users, " + (await seed()).rows + " orders");

  let child = null;
  let restarting = false;
  const start = () => {
    child = spawn(process.execPath, ["server.js"], { cwd: BE, env: process.env, stdio: "inherit" });
    child.on("exit", (c) => {
      if (!restarting) { console.log("[devstack] backend exited", c); process.exit(c || 0); }
    });
    console.log("[devstack] backend spawned on :4000");
  };
  const restart = () => new Promise((resolve) => {
    restarting = true;
    child.once("exit", () => { restarting = false; start(); setTimeout(resolve, 2500); });
    child.kill();
  });
  start();

  http.createServer(async (rq, rs) => {
    try {
      // /reset-token?email=..&expired=1 -> plants a password-reset token (returns the raw token)
      if (rq.url.startsWith("/reset-token")) {
        const q = new URL(rq.url, "http://x").searchParams;
        const crypto = require("crypto");
        const authService = require(path.join(BE, "services/authService"));
        const raw = crypto.randomBytes(24).toString("hex");
        const User = require(path.join(BE, "models/User"));
        await User.updateOne(
          { email: q.get("email") },
          { passwordResetToken: authService.hashToken(raw), passwordResetExpires: new Date(Date.now() + (q.get("expired") ? -60000 : 3600000)) }
        );
        return rs.end(raw);
      }
      if (rq.url === "/reseed") await seed();
      if (rq.url === "/restart" || rq.url === "/reseed") await restart();
      rs.end("ok");
    } catch (e) { rs.statusCode = 500; rs.end(String(e)); }
  }).listen(4999);
  console.log("[devstack] control on :4999 (/restart, /reseed)");
  process.on("SIGINT", () => { child && child.kill(); process.exit(0); });
})().catch((e) => { console.error(e); process.exit(1); });
