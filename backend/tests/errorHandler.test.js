import { describe, it, expect, afterEach } from "vitest";
const { errorHandler } = require("../middleware/errorHandler");

function run(err, statusCode = 200) {
  const res = {
    statusCode,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  errorHandler(err, {}, res, () => {});
  return res;
}

const original = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = original; });

describe("errorHandler", () => {
  it("hides internals and stack traces from 5xx responses in production", () => {
    process.env.NODE_ENV = "production";
    const res = run(new Error("connect ECONNREFUSED 10.0.0.5:27017"));
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Internal Server Error");
    expect(res.body.stack).toBeUndefined();
  });

  it("passes 4xx messages through in production", () => {
    process.env.NODE_ENV = "production";
    const err = Object.assign(new Error("Not allowed by CORS"), { statusCode: 403 });
    const res = run(err);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Not allowed by CORS");
  });

  it("turns Mongoose CastError / ValidationError into 400", () => {
    for (const name of ["CastError", "ValidationError"]) {
      const res = run(Object.assign(new Error("bad"), { name }));
      expect(res.statusCode).toBe(400);
    }
  });
});
