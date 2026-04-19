const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, ".env"),
});

const { env } = require("./config/env");
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// ✅ CORS — allow frontend dev server to call this backend
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// ✅ Must come BEFORE routes so cookies are parsed on every request
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Root route — simple health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend is running", port: env.PORT });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// Mount all API routes under /api/*
app.use("/api", apiRoutes);

// 404 — unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: "Not Found", path: req.path });
});

// Central error handler
app.use(errorHandler);

// Port conflict detection helper
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = require("net").createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function start() {
  // Validate required environment variables
  if (!env.JWT_SECRET) {
    throw new Error("Missing required env var: JWT_SECRET");
  }
  if (!env.MONGODB_URI) {
    throw new Error("Missing required env var: MONGODB_URI");
  }

  const PORT = env.PORT;

  // Check if port is already in use
  const portInUse = await isPortInUse(PORT);
  if (portInUse) {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`   Please stop the other process or use a different port.`);
    console.error(`   You can kill the process with: npx kill-port ${PORT}`);
    process.exit(1);
  }

  console.log("🔌 Connecting to MongoDB...");
  await connectDB(env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
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


