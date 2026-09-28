import { describe, it, expect, beforeAll, afterAll } from "vitest";
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { connectTestDb, disconnectTestDb } = require("./testDb");
const { env } = require("../config/env");

let app;
let User;
let Order;
let adminToken;
let adminUser;
let otherUserId;

function signFor(user) {
  return jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
  });
}

beforeAll(async () => {
  await connectTestDb("orderValidation");
  app = require("../server");
  User = require("../models/User");
  Order = require("../models/Order");

  adminUser = await User.create({
    name: "Admin",
    email: "order-admin@test.com",
    password: "password123",
    role: "admin",
    phoneNumber: "1234567890",
    primaryAddress: "HQ",
  });
  adminToken = signFor(adminUser);

  const otherUser = await User.create({
    name: "Other User",
    email: "order-other@test.com",
    password: "password123",
    phoneNumber: "1234567890",
    primaryAddress: "123 Test St",
  });
  otherUserId = otherUser._id.toString();
});

afterAll(async () => {
  await disconnectTestDb();
});

const basePayload = {
  productName: "Sample Product",
  productType: "general",
  warehouseAddress: "123 Warehouse Rd",
  staffName: "Staff A",
  customerName: "Customer A",
};

describe("POST /api/orders/admin validation", () => {
  it("rejects a missing productName", async () => {
    const { productName, ...rest } = basePayload;
    const res = await request(app)
      .post("/api/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(rest);
    expect(res.status).toBe(400);
  });

  it("rejects a missing warehouseAddress", async () => {
    const { warehouseAddress, ...rest } = basePayload;
    const res = await request(app)
      .post("/api/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(rest);
    expect(res.status).toBe(400);
  });

  it("rejects a missing staffName", async () => {
    const { staffName, ...rest } = basePayload;
    const res = await request(app)
      .post("/api/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(rest);
    expect(res.status).toBe(400);
  });

  it("rejects a missing customerName", async () => {
    const { customerName, ...rest } = basePayload;
    const res = await request(app)
      .post("/api/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(rest);
    expect(res.status).toBe(400);
  });

  it("creates an order with a complete valid payload", async () => {
    const res = await request(app)
      .post("/api/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(basePayload);
    expect(res.status).toBe(201);
    expect(res.body.order.orderCode).toBeTruthy();
  });

  it("rejects a non-admin caller", async () => {
    const res = await request(app)
      .post("/api/orders/admin")
      .set("Authorization", `Bearer ${signFor({ _id: otherUserId, role: "user" })}`)
      .send(basePayload);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/orders/:id ownership regression (P1-1 fix)", () => {
  it("does not let the update payload reassign order ownership", async () => {
    const created = await Order.create({
      user: adminUser._id,
      userEmail: "order-admin@test.com",
      orderCode: "ORD-OWNERSHIP-TEST",
      productType: "test",
      productName: "Product",
      warehouseAddress: "Warehouse",
      staffName: "Staff",
      customerName: "Customer",
      status: "pending",
    });

    const res = await request(app)
      .put(`/api/orders/${created._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ user: otherUserId, customerName: "Updated Name" });

    expect(res.status).toBe(200);

    const fromDb = await Order.findById(created._id).lean();
    expect(fromDb.user.toString()).toBe(adminUser._id.toString());
    expect(fromDb.customerName).toBe("Updated Name");
  });
});
