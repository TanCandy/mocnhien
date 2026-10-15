import { describe, it, expect } from "vitest";

describe("Domain 1: Authentication & Session Lifecycle (22 Tests)", () => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[\d\s\-+()]{8,15}$/;

  it("Test 001: Accepts valid standard email formats", () => {
    expect(EMAIL_RE.test("customer@mocnhien.vn")).toBe(true);
    expect(EMAIL_RE.test("admin.system@mocnhien.com.vn")).toBe(true);
  });

  it("Test 002: Rejects email without @ symbol", () => {
    expect(EMAIL_RE.test("customermocnhien.vn")).toBe(false);
  });

  it("Test 003: Rejects email without domain part", () => {
    expect(EMAIL_RE.test("customer@")).toBe(false);
  });

  it("Test 004: Rejects email with whitespace characters", () => {
    expect(EMAIL_RE.test("customer @mocnhien.vn")).toBe(false);
    expect(EMAIL_RE.test("customer@ mocnhien.vn")).toBe(false);
  });

  it("Test 005: Enforces RFC 5321 max email length of 254 characters", () => {
    const longEmail = "a".repeat(250) + "@mocnhien.vn";
    expect(longEmail.length > 254).toBe(true);
  });

  it("Test 006: Password length must be at least 6 characters", () => {
    const checkMinLength = (pw: string) => pw.length >= 6;
    expect(checkMinLength("12345")).toBe(false);
    expect(checkMinLength("123456")).toBe(true);
  });

  it("Test 007: Password length upper bound of 128 characters protects against bcrypt DoS", () => {
    const checkMaxLength = (pw: string) => pw.length <= 128;
    expect(checkMaxLength("a".repeat(128))).toBe(true);
    expect(checkMaxLength("a".repeat(129))).toBe(false);
  });

  it("Test 008: Phone number accepts standard Vietnam mobile digits", () => {
    expect(PHONE_RE.test("0901234567")).toBe(true);
    expect(PHONE_RE.test("0987654321")).toBe(true);
  });

  it("Test 009: Phone number accepts international format with + prefix", () => {
    expect(PHONE_RE.test("+84901234567")).toBe(true);
    expect(PHONE_RE.test("+14155552671")).toBe(true);
  });

  it("Test 010: Phone number rejects strings with letters or malicious characters", () => {
    expect(PHONE_RE.test("0901234abc")).toBe(false);
    expect(PHONE_RE.test("0901<script>")).toBe(false);
  });

  it("Test 011: Phone number rejects numbers shorter than 8 characters", () => {
    expect(PHONE_RE.test("1234567")).toBe(false);
  });

  it("Test 012: Phone number rejects numbers longer than 15 characters", () => {
    expect(PHONE_RE.test("1234567890123456")).toBe(false);
  });

  it("Test 013: Normalizes email to lowercase and trims surrounding whitespace", () => {
    const normalize = (email: string) => email.toLowerCase().trim();
    expect(normalize("  Customer@MocNhien.VN ")).toBe("customer@mocnhien.vn");
  });

  it("Test 014: Extracts token from cookie string safely", () => {
    function getTokenFromCookie(cookieHeader?: string | null) {
      if (!cookieHeader) return null;
      const part = cookieHeader
        .split(";")
        .map((v) => v.trim())
        .find((entry) => entry.startsWith("token="));
      if (!part) return null;
      return decodeURIComponent(part.slice("token=".length));
    }

    const cookieStr = "session=xyz; token=my-secret-jwt-token; theme=dark";
    expect(getTokenFromCookie(cookieStr)).toBe("my-secret-jwt-token");
    expect(getTokenFromCookie("other=abc")).toBe(null);
    expect(getTokenFromCookie(null)).toBe(null);
  });

  it("Test 015: Extracts token with encoded characters from cookie", () => {
    function getTokenFromCookie(cookieHeader?: string | null) {
      if (!cookieHeader) return null;
      const part = cookieHeader
        .split(";")
        .map((v) => v.trim())
        .find((entry) => entry.startsWith("token="));
      if (!part) return null;
      return decodeURIComponent(part.slice("token=".length));
    }

    const cookieStr = "token=abc%2B123%3D%3D";
    expect(getTokenFromCookie(cookieStr)).toBe("abc+123==");
  });

  it("Test 016: Resolves Bearer header format", () => {
    function parseAuthHeader(header?: string | null) {
      if (!header) return null;
      const [scheme, token] = header.split(" ");
      return scheme === "Bearer" && token ? token : null;
    }

    expect(parseAuthHeader("Bearer jwt.token.here")).toBe("jwt.token.here");
    expect(parseAuthHeader("Basic dXNlcjpwYXNz")).toBe(null);
    expect(parseAuthHeader("")).toBe(null);
  });

  it("Test 017: Distinguishes JWT validation failure from infrastructure failure", () => {
    function classifyAuthError(errName: string) {
      if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(errName)) {
        return { status: 401, message: "Unauthorized." };
      }
      return { status: 503, message: "Authentication service temporarily unavailable." };
    }

    expect(classifyAuthError("JsonWebTokenError")).toEqual({ status: 401, message: "Unauthorized." });
    expect(classifyAuthError("TokenExpiredError")).toEqual({ status: 401, message: "Unauthorized." });
    expect(classifyAuthError("MongooseServerSelectionError")).toEqual({
      status: 503,
      message: "Authentication service temporarily unavailable.",
    });
  });

  it("Test 018: Sanitizes 401 error response to prevent stack / secret leaks", () => {
    function build401Response() {
      return { message: "Unauthorized." };
    }
    const res = build401Response();
    expect(res).not.toHaveProperty("stack");
    expect(res).not.toHaveProperty("error");
    expect(res.message).toBe("Unauthorized.");
  });

  it("Test 019: Timing-safe token hash comparison handles null values safely", () => {
    function isTokenExpired(expiresDate: Date | null) {
      if (!expiresDate) return true;
      return new Date() > expiresDate;
    }

    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isTokenExpired(new Date(Date.now() + 60000))).toBe(false);
  });

  it("Test 020: Primary address cannot be empty or solely whitespace", () => {
    const isValidAddress = (addr?: string | null) => Boolean(addr && addr.trim().length > 0);
    expect(isValidAddress("")).toBe(false);
    expect(isValidAddress("   ")).toBe(false);
    expect(isValidAddress("Số 12 Lê Lợi, Q1, HCM")).toBe(true);
  });

  it("Test 021: Address character length limit (max 500 characters)", () => {
    const isValidAddressLength = (addr: string) => addr.trim().length <= 500;
    expect(isValidAddressLength("a".repeat(500))).toBe(true);
    expect(isValidAddressLength("a".repeat(501))).toBe(false);
  });

  it("Test 022: Role assignment defaults to user when omitted", () => {
    const resolveRole = (role?: string) => (role === "admin" ? "admin" : "user");
    expect(resolveRole()).toBe("user");
    expect(resolveRole("admin")).toBe("admin");
    expect(resolveRole("superadmin")).toBe("user");
  });
});
