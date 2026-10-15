import { describe, it, expect, beforeAll, afterAll } from "vitest";
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { connectTestDb, disconnectTestDb } = require("./testDb");
const { env } = require("../config/env");

let app;
let User;
let Order;
let customer;
let other;

function signFor(user) {
  return jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
  });
}

function create(user, body) {
  return request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${signFor(user)}`)
    .send({
      productType: "general",
      productName: "Test item",
      warehouseAddress: "1 Warehouse Rd",
      staffName: "Lan",
      exchangeRate: 25000,
      ...body,
    });
}

beforeAll(async () => {
  await connectTestDb("orderPrice");
  app = require("../server");
  User = require("../models/User");
  Order = require("../models/Order");
  customer = await User.create({
    name: "Price Customer", email: "price-a@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Home",
  });
  other = await User.create({
    name: "Other Customer", email: "price-b@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Elsewhere",
  });
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("POST /api/orders — USD price parsing", () => {
  const cases = [
    ["a number", 1299, 1299],
    ["a plain numeric string", "1299", 1299],
    ["a string with a thousands separator", "1,299", 1299],
    ["a string with separators and decimals", "1,299.50", 1299.5],
    ["a multi-group string", "1,234,567.8", 1234567.8],
    ["a small decimal string", "48.5", 48.5],
  ];

  it.each(cases)("stores %s correctly", async (_label, input, expected) => {
    const res = await create(customer, { priceUSD: input });
    expect(res.status).toBe(201);
    expect(res.body.order.priceUSD).toBe(expected);
    const stored = await Order.findOne({ orderCode: res.body.order.id }).lean();
    expect(stored.priceUSD).toBe(expected);
    expect(stored.totalUSD).toBe(expected);
    expect(stored.priceVND).toBe(Math.round(expected * 25000));
    expect(stored.totalVND).toBe(Math.round(expected * 25000));
  });

  it("accepts an order without a price (VND stays 0)", async () => {
    const res = await create(customer, { priceUSD: undefined, exchangeRate: undefined });
    expect(res.status).toBe(201);
    const stored = await Order.findOne({ orderCode: res.body.order.id }).lean();
    expect(stored.priceUSD).toBe(0);
    expect(stored.priceVND).toBe(0);
  });

  it.each([["garbage", "abc"], ["empty", ""], ["zero", "0"], ["negative", -5]])(
    "treats a %s price as no price",
    async (_label, input) => {
      const res = await create(customer, { priceUSD: input });
      expect(res.status).toBe(201);
      const stored = await Order.findOne({ orderCode: res.body.order.id }).lean();
      expect(stored.priceUSD).toBe(0);
      expect(stored.priceVND).toBe(0);
    }
  );

  it("requires an exchange rate when a price is given", async () => {
    const res = await create(customer, { priceUSD: "1,299", exchangeRate: 0 });
    expect(res.status).toBe(400);
  });

  it("requires warehouse address and staff name", async () => {
    expect((await create(customer, { priceUSD: 10, warehouseAddress: "  " })).status).toBe(400);
    expect((await create(customer, { priceUSD: 10, staffName: "" })).status).toBe(400);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/orders").send({ productName: "x" });
    expect(res.status).toBe(401);
  });

  it("only lists the caller's own orders", async () => {
    await create(other, { priceUSD: "1,000" });
    const mine = await request(app)
      .get("/api/orders/my-orders")
      .set("Authorization", `Bearer ${signFor(customer)}`);
    expect(mine.status).toBe(200);
    expect(mine.body.orders.length).toBeGreaterThan(0);
    expect(mine.body.orders.every((o) => o.userEmail === undefined || o.userEmail === customer.email)).toBe(true);
    const all = await Order.find({ userEmail: other.email }).lean();
    expect(all.length).toBe(1);
  });
});
