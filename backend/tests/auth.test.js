import { describe, it, expect, beforeAll, afterAll } from "vitest";
const request = require("supertest");
const { connectTestDb, disconnectTestDb } = require("./testDb");

let app;
let User;

beforeAll(async () => {
  await connectTestDb("auth");
  app = require("../server");
  User = require("../models/User");
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("POST /api/auth/register", () => {
  it("rejects a missing email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      password: "password123",
      phoneNumber: "1234567890",
      primaryAddress: "123 Test St",
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "not-an-email",
      password: "password123",
      phoneNumber: "1234567890",
      primaryAddress: "123 Test St",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a password shorter than 6 characters", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "shortpw@test.com",
      password: "123",
      phoneNumber: "1234567890",
      primaryAddress: "123 Test St",
    });
    expect(res.status).toBe(400);
  });

  it("creates an account with a valid payload and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "register-happy@test.com",
      password: "password123",
      phoneNumber: "1234567890",
      primaryAddress: "123 Test St",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("register-happy@test.com");
    expect(res.body.user.role).toBe("user");
  });

  it("rejects a duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User Again",
      email: "register-happy@test.com",
      password: "password123",
      phoneNumber: "1234567890",
      primaryAddress: "123 Test St",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login Test",
      email: "login-test@test.com",
      password: "correct-password",
      phoneNumber: "1234567890",
      primaryAddress: "123 Test St",
    });
  });

  it("rejects an unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@test.com",
      password: "whatever",
    });
    expect(res.status).toBe(401);
  });

  it("rejects the wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login-test@test.com",
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
  });

  it("logs in with the correct password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login-test@test.com",
      password: "correct-password",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns a generic message for an unknown email (no enumeration)", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({
      email: "does-not-exist@test.com",
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account with that email exists/i);
  });

  it("answers an existing email exactly like an unknown one, even when the email provider fails", async () => {
    // No RESEND_API_KEY in tests → sending throws. A 500 here would reveal
    // that the account exists (unknown emails get 200).
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "nobody-here@test.com" });
    const known = await request(app).post("/api/auth/forgot-password").send({ email: "login-test@test.com" });
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("rejects an invalid/expired token", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({
      token: "not-a-real-token",
      newPassword: "newpassword123",
    });
    expect(res.status).toBe(400);
  });

  it("resets the password given a valid token and allows login with the new password", async () => {
    const authService = require("../services/authService");
    const user = await User.findOne({ email: "login-test@test.com" });
    const { rawToken } = await authService.issuePasswordResetToken(user);

    const resetRes = await request(app).post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "brand-new-password",
    });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.token).toBeTruthy();

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "login-test@test.com",
      password: "brand-new-password",
    });
    expect(loginRes.status).toBe(200);
  });
});
