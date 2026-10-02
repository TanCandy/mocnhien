import { describe, it, expect, beforeAll, afterAll } from "vitest";
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { connectTestDb, disconnectTestDb } = require("./testDb");
const { env } = require("../config/env");
const { buildVietQRPayload, crc16 } = require("../services/vietqr");
const { extractOrderCodeCandidates } = require("../services/paymentService");
const { computePaymentFields } = require("../services/orderMath");

let app;
let User;
let Order;
let Payment;
let admin;
let customer;
let stranger;

function signFor(user) {
  return jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
  });
}

const KEY = "test-sepay-key";
let txnSeq = 1000;

function sepay(body, key = KEY) {
  const req = request(app).post("/api/payments/webhook/sepay");
  if (key !== null) req.set("Authorization", `Apikey ${key}`);
  return req.send({
    id: ++txnSeq,
    gateway: "MSB",
    transactionDate: "2026-10-02 14:02:37",
    accountNumber: "80002725995",
    code: null,
    transferType: "in",
    accumulated: 0,
    subAccount: null,
    referenceCode: `FT${txnSeq}`,
    description: "",
    ...body,
  });
}

async function makeOrder(overrides = {}) {
  return Order.create({
    user: customer._id,
    userEmail: customer.email,
    orderCode: `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "X")}-${Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0")}`,
    productType: "general",
    productName: "Coach bag",
    customerName: "Customer",
    warehouseAddress: "WH",
    priceUSD: 100,
    totalUSD: 100,
    exchangeRate: 25000,
    priceVND: 2500000,
    totalVND: 2500000,
    ...overrides,
  });
}

beforeAll(async () => {
  await connectTestDb("payments");
  app = require("../server");
  User = require("../models/User");
  Order = require("../models/Order");
  Payment = require("../models/Payment");
  await Payment.init(); // build the unique index before idempotency tests

  admin = await User.create({
    name: "Admin", email: "pay-admin@test.com", password: "password123",
    role: "admin", phoneNumber: "1234567890", primaryAddress: "HQ",
  });
  customer = await User.create({
    name: "Customer", email: "pay-customer@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Home",
  });
  stranger = await User.create({
    name: "Stranger", email: "pay-stranger@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Elsewhere",
  });
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("VietQR payload", () => {
  it("computes CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("reproduces the bank-issued static MSB QR byte-for-byte", () => {
    expect(buildVietQRPayload({ bankBin: "970426", accountNumber: "80002725995" })).toBe(
      "00020101021138550010A000000727012500069704260111800027259950208QRIBFTTA53037045802VN63043674"
    );
  });

  it("builds a dynamic QR with amount, content and a valid checksum", () => {
    const p = buildVietQRPayload({
      bankBin: "970426", accountNumber: "80002725995", amount: 1500000, description: "ORDMG8X2K1A3F9C",
    });
    expect(p.startsWith("000201010212")).toBe(true);
    expect(p).toContain("54071500000");
    expect(p).toContain("62190815ORDMG8X2K1A3F9C");
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
});

describe("order code extraction from transfer content", () => {
  it.each([
    ["ORD-MG8X2K1A-3F9C", ["ORD-MG8X2K1A-3F9C"]],
    ["ordmg8x2k1a3f9c", ["ORD-MG8X2K1A-3F9C"]],
    ["MBVCB.1234.ORD MG8X2K1A 3F9C.CT tu 0123 NGUYEN VAN A", ["ORD-MG8X2K1A-3F9C"]],
    ["no code here", []],
  ])("%s", (content, expected) => {
    expect(extractOrderCodeCandidates(content)).toEqual(expected);
  });

  it("keeps scanning past a false 'ORD' prefix (e.g. WORDS)", () => {
    expect(extractOrderCodeCandidates("WORDSABCDEFGHIJ ORDMG8X2K1A3F9C")).toContain("ORD-MG8X2K1A-3F9C");
  });
});

describe("computePaymentFields", () => {
  it("floors the percentage and never reports paid without a price", () => {
    expect(computePaymentFields(1000, 999)).toMatchObject({ paymentPercent: 99, remainingAmount: 1, paymentStatus: "pending" });
    expect(computePaymentFields(0, 500)).toMatchObject({ paymentPercent: 0, paymentStatus: "pending" });
    expect(computePaymentFields(1000, 1200)).toMatchObject({ paymentPercent: 100, remainingAmount: 0, paymentStatus: "paid" });
  });
});

describe("POST /api/payments/webhook/sepay", () => {
  it("rejects a missing or wrong API key", async () => {
    expect((await sepay({ transferAmount: 1, content: "x" }, null)).status).toBe(401);
    expect((await sepay({ transferAmount: 1, content: "x" }, "wrong")).status).toBe(401);
  });

  it("applies partial payments, ignores redeliveries and settles the order", async () => {
    const order = await makeOrder();
    const content = `${order.orderCode.replace(/-/g, "")} chuyen tien`;

    const first = await sepay({ id: 555001, transferAmount: 1000000, content });
    expect(first.status).toBe(200);
    expect(first.body.matched).toBe(order.orderCode);

    let fresh = await Order.findById(order._id).lean();
    expect(fresh.paidAmount).toBe(1000000);
    expect(fresh.remainingAmount).toBe(1500000);
    expect(fresh.paymentPercent).toBe(40);
    expect(fresh.paymentStatus).toBe("pending");

    // Same SePay transaction id again → not double-counted
    const dup = await sepay({ id: 555001, transferAmount: 1000000, content });
    expect(dup.status).toBe(200);
    expect(dup.body.duplicate).toBe(true);
    fresh = await Order.findById(order._id).lean();
    expect(fresh.paidAmount).toBe(1000000);

    await sepay({ transferAmount: 1500000, content: `MBVCB.99.${order.orderCode}.CT` });
    fresh = await Order.findById(order._id).lean();
    expect(fresh.paidAmount).toBe(2500000);
    expect(fresh.remainingAmount).toBe(0);
    expect(fresh.paymentStatus).toBe("paid");
    expect(await Payment.countDocuments({ order: order._id })).toBe(2);
  });

  it("finishes crediting a stored-but-unapplied transfer on redelivery", async () => {
    const order = await makeOrder();
    // Simulate a crash after the Payment insert but before the order update.
    await Payment.create({
      provider: "sepay", providerTxnId: "777001", order: order._id, orderCode: order.orderCode,
      amount: 500000, status: "matched",
    });
    const res = await sepay({ id: 777001, transferAmount: 500000, content: order.orderCode });
    expect(res.body.duplicate).toBe(true);
    const fresh = await Order.findById(order._id).lean();
    expect(fresh.paidAmount).toBe(500000);

    // …and a further redelivery still doesn't double-count.
    await sepay({ id: 777001, transferAmount: 500000, content: order.orderCode });
    expect((await Order.findById(order._id).lean()).paidAmount).toBe(500000);
  });

  it("ignores outgoing transfers and transfers to other accounts", async () => {
    const before = await Payment.countDocuments();
    const out = await sepay({ transferType: "out", transferAmount: 100000, content: "ORDAAAAAAAA0000" });
    expect(out.body.ignored).toBe("outgoing");
    const other = await sepay({ accountNumber: "999999", transferAmount: 100000, content: "x" });
    expect(other.body.ignored).toBe("other account");
    expect(await Payment.countDocuments()).toBe(before);
  });

  it("stores unmatched transfers for an admin to assign exactly once", async () => {
    const order = await makeOrder();
    const res = await sepay({ id: 888001, transferAmount: 300000, content: "chuyen tien mua hang" });
    expect(res.status).toBe(200);
    const payment = await Payment.findOne({ providerTxnId: "888001" });
    expect(payment.status).toBe("unmatched");

    const list = await request(app)
      .get("/api/payments?status=unmatched")
      .set("Authorization", `Bearer ${signFor(admin)}`);
    expect(list.status).toBe(200);
    expect(list.body.payments.some((p) => p._id === String(payment._id))).toBe(true);

    const userTry = await request(app)
      .post(`/api/payments/${payment._id}/assign`)
      .set("Authorization", `Bearer ${signFor(customer)}`)
      .send({ orderCode: order.orderCode });
    expect(userTry.status).toBe(403);

    const assign = await request(app)
      .post(`/api/payments/${payment._id}/assign`)
      .set("Authorization", `Bearer ${signFor(admin)}`)
      .send({ orderCode: order.orderCode });
    expect(assign.status).toBe(200);
    expect((await Order.findById(order._id).lean()).paidAmount).toBe(300000);

    const again = await request(app)
      .post(`/api/payments/${payment._id}/assign`)
      .set("Authorization", `Bearer ${signFor(admin)}`)
      .send({ orderCode: order.orderCode });
    expect(again.status).toBe(409);
    expect((await Order.findById(order._id).lean()).paidAmount).toBe(300000);
  });
});

describe("GET /api/payments/orders/:id", () => {
  it("gives the owner a QR for the outstanding balance", async () => {
    const order = await makeOrder({ paidAmount: 1000000 });
    const res = await request(app)
      .get(`/api/payments/orders/${order._id}`)
      .set("Authorization", `Bearer ${signFor(customer)}`);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("partial");
    expect(res.body.remainingAmount).toBe(1500000);
    expect(res.body.transferContent).toBe(order.orderCode.replace(/-/g, ""));
    expect(res.body.qr.amount).toBe(1500000);
    expect(res.body.qr.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(res.body.bank.accountNumber).toBe("80002725995");
  });

  it("works for an order addressed to the customer's email but created by an admin", async () => {
    const order = await makeOrder({ user: admin._id });
    const res = await request(app)
      .get(`/api/payments/orders/${order.orderCode}`)
      .set("Authorization", `Bearer ${signFor(customer)}`);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("due");
  });

  it("forbids other users and returns no QR once paid", async () => {
    const order = await makeOrder({ paidAmount: 2500000, paymentStatus: "paid" });
    const denied = await request(app)
      .get(`/api/payments/orders/${order._id}`)
      .set("Authorization", `Bearer ${signFor(stranger)}`);
    expect(denied.status).toBe(403);

    const paid = await request(app)
      .get(`/api/payments/orders/${order._id}`)
      .set("Authorization", `Bearer ${signFor(customer)}`);
    expect(paid.body.state).toBe("paid");
    expect(paid.body.qr).toBeNull();
  });

  it("offers an amount-less QR while the price is not set", async () => {
    const order = await makeOrder({ priceUSD: 0, totalUSD: 0, priceVND: 0, totalVND: 0, exchangeRate: 0 });
    const res = await request(app)
      .get(`/api/payments/orders/${order._id}`)
      .set("Authorization", `Bearer ${signFor(customer)}`);
    expect(res.body.state).toBe("no_price");
    expect(res.body.qr.amount).toBe(0);
  });
});
