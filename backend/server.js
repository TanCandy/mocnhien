console.log("Starting server...");

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Load .env from backend directory (production) or project root (development)
const envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
}

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT || "NOT SET (will use default)");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "SET" : "NOT SET");

const { env } = require("./config/env");
const { logger } = require("./config/logger");
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

// ====================
// ERROR TRACKING — Sentry, no-op unless SENTRY_DSN is set.
// ====================
const Sentry = require("@sentry/node");
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: env.NODE_ENV });
}

const app = express();

// ====================
// REVERSE PROXY — behind Caddy/nginx/a PaaS router, req.ip and req.protocol
// must come from X-Forwarded-* or every client shares the proxy's IP (which
// breaks per-IP rate limiting). TRUST_PROXY = number of proxy hops (e.g. 1),
// or "true"/"false". Unset = don't trust (safe for direct exposure).
// ====================
if (process.env.TRUST_PROXY) {
  const raw = process.env.TRUST_PROXY.trim();
  const hops = Number(raw);
  app.set("trust proxy", Number.isInteger(hops) ? hops : raw === "true");
}

// ====================
// SECURITY HEADERS — helmet with a CSP matching this app's actual sources
// (Vite build output loaded from dist/, Google Fonts stylesheet, Google
// profile-photo images, same-origin XHR/fetch to this API).
// ====================
app.use(helmet({
  // TLS is terminated at the hosting platform's proxy, not in this process —
  // an HSTS header from here would wrongly pin plain-http deployments/local
  // testing to https-only and break asset loading.
  hsts: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      // Don't force https upgrades — TLS termination happens at the host
      // platform's proxy (or not at all in local/dev), not in this app.
      upgradeInsecureRequests: null,
    },
  },
}));

// ====================
// CORS — explicit allowlist only, no wildcard fallback.
// Scoped to /api: static assets (built with `crossorigin` script/link tags)
// send an Origin header even for same-origin requests, and this app's own
// serving origin is never in ALLOWED_ORIGINS — applying CORS globally would
// reject its own JS/CSS bundle with a CORS error.
// ====================
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

// The public site URL (used in emails) is always an allowed origin, so a
// self-hosted deploy only has to set it once.
for (const url of [process.env.CLIENT_URL, process.env.FRONTEND_BASE_URL]) {
  try {
    if (url) allowedOrigins.push(new URL(url).origin);
  } catch {
    // ignore malformed URL — config validation is not this block's job
  }
}

app.use("/api", cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const err = new Error("Not allowed by CORS");
    err.statusCode = 403;
    return callback(err);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ====================
// STATIC FILES — Serve built frontend in production
// ====================
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

// ====================
// HEALTH CHECKS — these always respond
// ====================
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "API is running" });
});

app.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  if (!dbConnected) {
    return res.status(503).json({ ok: false, db: "disconnected", timestamp: new Date().toISOString() });
  }
  res.json({ ok: true, db: "connected", timestamp: new Date().toISOString() });
});

// ====================
// API ROUTES
// ====================
app.use("/api", apiRoutes);

// ====================
// SERVE FRONTEND SPA — fallback for non-API routes
// app.use() (no path) acts as a catch-all WITHOUT invoking path-to-regexp,
// so it works safely with Express 5 / path-to-regexp v7.
// Must come AFTER API routes so /api/* never reaches here.
// ====================
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'), (err) => {
    if (err) res.status(200).json({ status: 'ok', note: 'Frontend not built' });
  });
});

app.use(errorHandler);

// ====================
// SERVER START — always run regardless of DB status
// ====================
const PORT = process.env.PORT || 3000;

// Warn about missing optional env vars (but don't block startup).
// JWT_SECRET is enforced at require-time via required("JWT_SECRET") in
// config/env.js — the process will not reach this point without it.
if (!process.env.MONGODB_URI) {
  console.warn("WARNING: MONGODB_URI not set — database features will be unavailable");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DB_CONNECT_MAX_ATTEMPTS = 5;
const DB_CONNECT_BASE_DELAY_MS = 1000;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.warn("Skipping DB connection — MONGODB_URI not set");
    return;
  }

  for (let attempt = 1; attempt <= DB_CONNECT_MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Connecting to MongoDB (attempt ${attempt}/${DB_CONNECT_MAX_ATTEMPTS})...`);
      await connectDB(process.env.MONGODB_URI);
      console.log("MongoDB connected successfully");
      return;
    } catch (err) {
      const isLastAttempt = attempt === DB_CONNECT_MAX_ATTEMPTS;
      logger.error({ err: err.message, attempt }, "MongoDB connection attempt failed");
      if (isLastAttempt) {
        logger.error("MongoDB connection failed after all retries — server will continue running without a database connection");
        return;
      }
      const delay = DB_CONNECT_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
}

// Only boot the HTTP listener / DB connection / fatal-error exit handlers
// when this file is run directly (`node server.js`). When it's `require`d
// (e.g. by the test suite via supertest), the caller owns the process
// lifecycle and just wants the configured `app`.
if (require.main === module) {
  // Start HTTP server FIRST, then connect DB in background
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  });

  // Connect DB after server is already listening
  connectDatabase().catch((err) => {
    console.error("connectDatabase error:", err.message);
  });

  // Both handlers exit the process — the container orchestrator's restart
  // policy (`restart: unless-stopped` in docker-compose.yml) brings it back
  // up. Continuing to run after either event risks operating in a corrupted
  // in-memory state.
  process.on("unhandledRejection", (err) => {
    logger.error({ err }, "Unhandled Rejection — exiting");
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught Exception — exiting");
    process.exit(1);
  });
}

module.exports = app;
