const rateLimit = require("express-rate-limit");

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
  // Test suites make many rapid auth requests from the same in-memory
  // "IP" — real rate limiting only matters at runtime, not under test.
  skip: () => process.env.NODE_ENV === "test",
});

module.exports = { authRateLimiter };
