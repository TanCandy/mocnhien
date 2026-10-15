import { describe, it, expect, beforeAll, afterAll } from "vitest";
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { connectTestDb, disconnectTestDb } = require("./testDb");
const { env } = require("../config/env");

let app;
let User;
let admin;
let other;
let adminToken;

const sign = (u) =>
  jwt.sign({ userId: u._id, role: u.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: env.JWT_ISSUER });
const auth = () => ({ Authorization: `Bearer ${adminToken}` });

const validOrder = {
  productName: "Thing", productType: "general", warehouseAddress: "WH", staffName: "Lan",
  customerName: "Cust", contactType: "none", contactValue: "",
};

beforeAll(async () => {
  await connectTestDb("adminguards");
  app = require("../server");
  User = require("../models/User");
  admin = await User.create({
    name: "Admin", email: "guard-admin@test.com", password: "password123", role: "admin",
    phoneNumber: "1234567890", primaryAddress: "HQ",
  });
  other = await User.create({
    name: "Other", email: "guard-other@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Home",
  });
  adminToken = sign(admin);
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("admin user management guards", () => {
  it("refuses to let an admin delete their own account", async () => {
    const res = await request(app).delete(`/api/user/${admin._id}`).set(auth());
    expect(res.status).toBe(400);
    expect(await User.findById(admin._id)).not.toBeNull();
  });

  it("refuses to let an admin demote themselves", async () => {
    const res = await request(app).patch(`/api/user/${admin._id}`).set(auth()).send({ role: "user" });
    expect(res.status).toBe(400);
    expect((await User.findById(admin._id)).role).toBe("admin");
  });

  it("still lets an admin change another user's role", async () => {
    const res = await request(app).patch(`/api/user/${other._id}`).set(auth()).send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
    await request(app).patch(`/api/user/${other._id}`).set(auth()).send({ role: "user" });
  });

  it("answers 400 (not 500) for a malformed user id", async () => {
    expect((await request(app).patch("/api/user/not-an-id").set(auth()).send({ name: "x" })).status).toBe(400);
    expect((await request(app).delete("/api/user/not-an-id").set(auth())).status).toBe(400);
  });
});

describe("admin order endpoints — bad input is a 4xx, not a 500", () => {
  it("rejects an unknown contactType", async () => {
    const res = await request(app).post("/api/orders/admin").set(auth()).send({ ...validOrder, contactType: "fax", contactValue: "x" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing productType", async () => {
    const { productType, ...rest } = validOrder;
    const res = await request(app).post("/api/orders/admin").set(auth()).send(rest);
    expect(res.status).toBe(400);
  });

  it("still creates a valid order", async () => {
    const res = await request(app).post("/api/orders/admin").set(auth()).send(validOrder);
    expect(res.status).toBe(201);
  });

  it.each([
    ["put", "/api/orders/not-an-id"],
    ["delete", "/api/orders/not-an-id"],
    ["put", "/api/orders/not-an-id/approve"],
    ["post", "/api/orders/not-an-id/recalculate"],
  ])("%s %s with a malformed id answers 400/404", async (method, url) => {
    const res = await request(app)[method](url).set(auth()).send({});
    expect([400, 404]).toContain(res.status);
  });
});
