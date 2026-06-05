console.log("Starting server...");

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

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
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// ====================
// CORS — Railway & local dev
// ====================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
  process.env.PUBLIC_FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all — restrict via Railway firewall if needed
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
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
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ====================
// API ROUTES
// ====================
app.use("/api", apiRoutes);

// ====================
// SERVE FRONTEND SPA — fallback for non-API routes
// app.use() (no path) catches unmatched requests without path-to-regexp
// ====================
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) res.status(200).json({ status: "ok", note: "Frontend not built" });
  });
});

app.use(errorHandler);

// ====================
// SERVER START — always run regardless of DB status
// ====================
const PORT = process.env.PORT || 3000;

// Warn about missing required env vars (but don't block startup)
if (!process.env.MONGODB_URI) {
  console.warn("WARNING: MONGODB_URI not set — database features will be unavailable");
}
if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET not set — using fallback (INSECURE in production)");
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "dev-only-insecure-fallback-secret";
}

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.warn("Skipping DB connection — MONGODB_URI not set");
    return;
  }
  try {
    console.log("Connecting to MongoDB...");
    await connectDB(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.warn("Server will continue running without database connection");
  }
}

// Start HTTP server FIRST, then connect DB in background
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});

// Connect DB after server is already listening
connectDatabase().catch((err) => {
  console.error("connectDatabase error:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});
