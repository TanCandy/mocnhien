import { describe, it, expect, beforeAll, afterAll } from "vitest";
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { connectTestDb, disconnectTestDb } = require("./testDb");
const { env } = require("../config/env");

let app;
let User;
let Order;
let user;
let token;

const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await connectTestDb("profile");
  app = require("../server");
  User = require("../models/User");
  Order = require("../models/Order");
  user = await User.create({
    name: "Profile User", email: "profile-a@test.com", password: "password123",
    phoneNumber: "1234567890", primaryAddress: "Home",
  });
  token = jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
  });
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("PUT /api/user/profile — email", () => {
  it.each(["not-an-email", "a@b", "two words@x.com", "@x.com"])("rejects %s", async (bad) => {
    const res = await request(app).put("/api/user/profile").set(auth()).send({ email: bad });
    expect(res.status).toBe(400);
    const fresh = await User.findById(user._id).lean();
    expect(fresh.email).toBe("profile-a@test.com");
  });

  it("keeps the customer's orders reachable after the email changes", async () => {
    await Order.create({
      user: user._id, userEmail: "profile-a@test.com", orderCode: "ORD-PROFILE-0001",
      productType: "general", productName: "Old order", warehouseAddress: "WH", staffName: "Lan",
      customerName: user.name, contactType: "email", contactValue: "profile-a@test.com",
    });
    // an order an admin addressed to this customer's email (owned by someone else)
    await Order.create({
      user: new (require("mongoose").Types.ObjectId)(), userEmail: "profile-a@test.com", orderCode: "ORD-PROFILE-0002",
      productType: "general", productName: "Admin-made order", warehouseAddress: "WH", staffName: "Lan",
      customerName: user.name, contactType: "email", contactValue: "profile-a@test.com",
    });
    await Order.create({
      user: new (require("mongoose").Types.ObjectId)(), userEmail: "someone-else@test.com", orderCode: "ORD-PROFILE-0003",
      productType: "general", productName: "Not mine", warehouseAddress: "WH", staffName: "Lan",
      customerName: "Else", contactType: "email", contactValue: "someone-else@test.com",
    });

    const upd = await request(app).put("/api/user/profile").set(auth()).send({ email: "Profile-New@Test.com" });
    expect(upd.status).toBe(200);
    expect(upd.body.user.email).toBe("profile-new@test.com");

    const mine = await request(app).get("/api/orders/my-orders").set(auth());
    expect(mine.status).toBe(200);
    expect(mine.body.orders.map((o) => o.orderCode).sort()).toEqual(["ORD-PROFILE-0001", "ORD-PROFILE-0002"]);

    const moved = await Order.findOne({ orderCode: "ORD-PROFILE-0002" }).lean();
    expect(moved.contactValue).toBe("profile-new@test.com");
    const untouched = await Order.findOne({ orderCode: "ORD-PROFILE-0003" }).lean();
    expect(untouched.userEmail).toBe("someone-else@test.com");
  });

  it("changing only the phone does not touch orders", async () => {
    const res = await request(app).put("/api/user/profile").set(auth()).send({ phoneNumber: "0900111222" });
    expect(res.status).toBe(200);
    const mine = await request(app).get("/api/orders/my-orders").set(auth());
    expect(mine.body.count).toBe(2);
  });
});
