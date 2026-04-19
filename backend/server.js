const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

// Load .env file - works in both development and production
dotenv.config({
  path: path.join(__dirname, ".env"),
});

const { env } = require("./config/env");
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// ✅ CORS — allow frontend calls from any origin in development
// In production, Render sets FRONTEND_URL environment variable
const corsOptions = {
  origin: process.env.FRONTEND_URL || process.env.NODE_ENV === "production"
    ? false  // In production, only same-origin
    : "http://localhost:3000",
  credentials: true,
};
app.use(cors(corsOptions));

// ✅ Must come BEFORE routes so cookies are parsed on every request
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Root route — simple health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend is running", environment: env.NODE_ENV });
});

// Health check endpoint (important for Render)
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// Mount all API routes under /api/*
app.use("/api", apiRoutes);



// serve static frontend build
app.use(express.static(path.join(__dirname, "../dist")));

// fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});


// 404 — unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: "Not Found", path: req.path });
});

// Central error handler
app.use(errorHandler);

async function start() {
  // Validate required environment variables
  if (!env.JWT_SECRET) {
    throw new Error("Missing required env var: JWT_SECRET");
  }
  if (!env.MONGODB_URI) {
    throw new Error("Missing required env var: MONGODB_URI");
  }

  // Render provides PORT environment variable
  // Fall back to env.PORT (from .env) for local development
  const PORT = process.env.PORT || env.PORT || 4000;

  console.log("🔌 Connecting to MongoDB...");
  await connectDB(env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 API server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
  });
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
  console.error(err.stack);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});

// Start server with error handling
start().catch((err) => {
  console.error("❌ Failed to start server:", err.message);
  console.error(err.stack);
  process.exit(1);
});


