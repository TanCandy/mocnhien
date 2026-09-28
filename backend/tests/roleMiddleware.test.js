import { describe, it, expect, vi } from "vitest";
const { roleMiddleware } = require("../middleware/roleMiddleware");

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("roleMiddleware", () => {
  it("returns 401 when req.user is missing", () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    roleMiddleware("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the user's role doesn't match", () => {
    const req = { user: { role: "user" } };
    const res = mockRes();
    const next = vi.fn();

    roleMiddleware("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the user's role matches", () => {
    const req = { user: { role: "admin" } };
    const res = mockRes();
    const next = vi.fn();

    roleMiddleware("admin")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
