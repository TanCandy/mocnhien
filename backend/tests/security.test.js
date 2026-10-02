import { describe, it, expect, beforeAll, afterAll } from "vitest";
const request = require("supertest");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const { connectTestDb, disconnectTestDb } = require("./testDb");
const { env } = require("../config/env");

let app;
let User;
let Order;
let admin;
let customer;
let stranger;

function signFor(user) {
  return jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
  });
}
const as = (user) => ({ Authorization: `Bearer ${signFor(user)}` });

const orderPayload = {
  productName: "Sample Product",
  productType: "general",
  warehouseAddress: "123 Warehouse Rd",
  staffName: "Staff A",
  customerName: "Customer A",
  contactType: "email",
  contactValue: "sec-customer@test.com",
  priceUSD: "100",
  exchangeRate: 25000,
};

beforeAll(async () => {
  await connectTestDb("security");
  app = require("../server");
  User = require("../models/User");
  Order = require("../models/Order");

  admin = await User.create({
    name: "Admin", email: "sec-admin@test.com", password: "password123",
    role: "admin", phoneNumber: "1234567890", primaryAddress: "HQ",
  });
  customer = await User.create({
    name: "Customer", email: "sec-customer@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Home",
  });
  stranger = await User.create({
    name: "Stranger", email: "sec-stranger@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Elsewhere",
  });
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("privilege escalation", () => {
  it("public registration ignores a role field", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Sneaky", email: "sneaky@test.com", password: "password123",
      phoneNumber: "1234567890", primaryAddress: "x", role: "admin",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");
    expect((await User.findOne({ email: "sneaky@test.com" })).role).toBe("user");
  });

  it("the test-email endpoint is admin-only", async () => {
    const anon = await request(app).post("/api/send-test-email").send({ to: "a@b.c" });
    expect(anon.status).toBe(401);
    const user = await request(app).post("/api/send-test-email").set(as(customer)).send({ to: "a@b.c" });
    expect(user.status).toBe(403);
    const status = await request(app).get("/api/email-status").set(as(customer));
    expect(status.status).toBe(403);
  });
});

describe("CORS", () => {
  it("rejects unknown origins with 403 (not 500)", async () => {
    const res = await request(app).get("/api/orders/my-orders").set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
  });
});

describe("order access", () => {
  it("lets a customer open an admin-created order addressed to their email", async () => {
    const created = await request(app).post("/api/orders/admin").set(as(admin)).send(orderPayload);
    expect(created.status).toBe(201);
    const id = created.body.order._id;

    const own = await request(app).get(`/api/orders/${id}`).set(as(customer));
    expect(own.status).toBe(200);
    const other = await request(app).get(`/api/orders/${id}`).set(as(stranger));
    expect(other.status).toBe(403);
  });

  it("treats search input as text, not a regex", async () => {
    const res = await request(app).get("/api/orders/search?q=(((a").set(as(admin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("admin order payment math", () => {
  it("derives the total server-side and records partial payments on approved orders", async () => {
    const created = await request(app).post("/api/orders/admin").set(as(admin)).send(orderPayload);
    const id = created.body.order._id;
    expect(created.body.order.totalVND).toBe(2500000);
    expect(created.body.order.remainingAmount).toBe(2500000);

    // Approved order, partial payment, stale totalVND from the form is ignored
    const upd = await request(app).put(`/api/orders/${id}`).set(as(admin)).send({
      status: "approved", paidAmount: 1000000, totalVND: 1,
    });
    expect(upd.status).toBe(200);
    expect(upd.body.order.paidAmount).toBe(1000000);
    expect(upd.body.order.remainingAmount).toBe(1500000);
    expect(upd.body.order.paymentPercent).toBe(40);
    expect(upd.body.order.paymentStatus).toBe("pending");

    // Price raised after the deposit → balance follows, deposit kept
    const repriced = await request(app).put(`/api/orders/${id}`).set(as(admin)).send({ priceUSD: "200" });
    expect(repriced.body.order.totalVND).toBe(5000000);
    expect(repriced.body.order.paidAmount).toBe(1000000);
    expect(repriced.body.order.remainingAmount).toBe(4000000);

    // Explicit "paid" settles the balance
    const settled = await request(app).put(`/api/orders/${id}`).set(as(admin)).send({ paymentStatus: "paid" });
    expect(settled.body.order.paymentStatus).toBe("paid");
    expect(settled.body.order.paidAmount).toBe(5000000);
    expect(settled.body.order.remainingAmount).toBe(0);
  });

  it("an unrelated edit does not touch payment fields", async () => {
    const created = await request(app).post("/api/orders/admin").set(as(admin)).send(orderPayload);
    const id = created.body.order._id;
    await Order.updateOne({ _id: id }, { $set: { paidAmount: 700000 } }); // e.g. webhook credit

    const upd = await request(app).put(`/api/orders/${id}`).set(as(admin)).send({ uspsTracking: "9400" });
    expect(upd.status).toBe(200);
    expect(upd.body.order.paidAmount).toBe(700000);
  });

  it("refuses a payment edit made from a form opened before a transfer landed", async () => {
    const created = await request(app).post("/api/orders/admin").set(as(admin)).send(orderPayload);
    const id = created.body.order._id;
    await Order.updateOne({ _id: id }, { $set: { paidAmount: 700000 } }); // webhook credit after the form opened

    const stale = await request(app).put(`/api/orders/${id}`).set(as(admin)).send({
      paidAmount: 500000, expectedPaidAmount: 0,
    });
    expect(stale.status).toBe(409);
    expect((await Order.findById(id).lean()).paidAmount).toBe(700000);

    const fresh = await request(app).put(`/api/orders/${id}`).set(as(admin)).send({
      paidAmount: 900000, expectedPaidAmount: 700000,
    });
    expect(fresh.status).toBe(200);
    expect(fresh.body.order.paidAmount).toBe(900000);
  });

  it("rejects an invalid status with 400", async () => {
    const created = await request(app).post("/api/orders/admin").set(as(admin)).send(orderPayload);
    const res = await request(app).put(`/api/orders/${created.body.order._id}`).set(as(admin)).send({ status: "bogus" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/orders/export", () => {
  it("is admin-only", async () => {
    const res = await request(app).get("/api/orders/export").set(as(customer));
    expect(res.status).toBe(403);
  });

  it("returns a valid xlsx with one row per order plus a totals row", async () => {
    const count = await Order.countDocuments();
    const res = await request(app)
      .get("/api/orders/export")
      .set(as(admin))
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toMatch(/orders-\d{8}-\d{4}\.xlsx/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet("Orders");
    expect(ws.rowCount).toBe(count + 2); // header + orders + totals
    expect(wb.getWorksheet("Payments")).toBeTruthy();
  });

  it("filters by status", async () => {
    const created = await request(app).post("/api/orders/admin").set(as(admin)).send(orderPayload);
    await request(app).put(`/api/orders/${created.body.order._id}`).set(as(admin)).send({ status: "delivered" });

    const res = await request(app).get("/api/orders/export?status=delivered").set(as(admin)).buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet("Orders");
    expect(ws.rowCount).toBe(3); // header + 1 delivered order + totals
    expect(ws.getRow(2).getCell(2).value).toBe(created.body.order.orderCode);
  });
});

describe("POST /api/orders/sheets/resync", () => {
  it("reports a clear 400 when the sheet webhook is not configured", async () => {
    const res = await request(app).post("/api/orders/sheets/resync").set(as(admin));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/WEBHOOK_URL/);
  });
});
