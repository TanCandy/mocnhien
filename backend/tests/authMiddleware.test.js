import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
const jwt = require("jsonwebtoken");
const { connectTestDb, disconnectTestDb } = require("./testDb");
const { env } = require("../config/env");

let authMiddleware;
let User;

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => {
  await connectTestDb("authMiddleware");
  ({ authMiddleware } = require("../middleware/authMiddleware"));
  User = require("../models/User");
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("authMiddleware", () => {
  it("returns 401 when no token is present", async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for a malformed/invalid token", async () => {
    const req = { headers: { authorization: "Bearer not-a-valid-token" } };
    const res = mockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and populates req.user for a valid token", async () => {
    const user = await User.create({
      name: "Middleware Test",
      email: "middleware-test@test.com",
      password: "password123",
      phoneNumber: "1234567890",
      primaryAddress: "123 Test St",
    });

    const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeTruthy();
    expect(req.user.email).toBe("middleware-test@test.com");
  });
});
