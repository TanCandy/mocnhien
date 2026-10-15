const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { logger } = require("../config/logger");
const User = require("../models/User");

function getTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const tokenPart = cookieHeader
    .split(";")
    .map((v) => v.trim())
    .find((entry) => entry.startsWith("token="));
  if (!tokenPart) return null;
  return decodeURIComponent(tokenPart.slice("token=".length));
}

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    let token = req.cookies?.token || getTokenFromCookie(req.headers.cookie);
    if (!token && header) {
      const [scheme, headerToken] = header.split(" ");
      if (scheme === "Bearer" && headerToken) token = headerToken;
    }
    if (!token) return res.status(401).json({ message: "Missing authentication token." });

    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });

    const user = await User.findById(payload.userId).select("_id email name role").lean();
    if (!user) return res.status(401).json({ message: "User not found." });

    req.user = user;
    return next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError") {
      return res.status(401).json({ message: "Unauthorized." });
    }
    logger.error({ err: err.message }, "[AuthMiddleware] database or internal error");
    return res.status(503).json({ message: "Authentication service temporarily unavailable." });
  }
}

module.exports = { authMiddleware };

