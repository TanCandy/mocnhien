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

// ============================================
// MIDDLEWARE (order matters!)
// ============================================

// CORS — allow frontend calls
const corsOptions = {
  origin: process.env.FRONTEND_URL || process.env.NODE_ENV === "production"
    ? false  // In production, only same-origin
    : "http://localhost:3000",
  credentials: true,
};
app.use(cors(corsOptions));

// Cookie parser (must be before routes)
app.use(cookieParser());

// JSON body parser
app.use(express.json({ limit: "1mb" }));

// ============================================
// HEALTH CHECK ROUTES (before API routes)
// ============================================

// Root route — simple health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend is running", environment: env.NODE_ENV });
});

// Health check endpoint (important for Render)
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// ============================================
// API ROUTES
// ============================================

// Mount all API routes under /api/*
app.use("/api", apiRoutes);

// ============================================
// STATIC FILES & SPA FALLBACK (MUST be last)
// ============================================

// Serve static frontend build files
app.use(express.static(path.join(__dirname, "../dist")));

// Catch-all route for SPA - MUST be the LAST route
// Use regex pattern instead of "*" to avoid path-to-regexp issues
app.use((req, res, next) => {
  // Only handle GET requests that haven't been matched
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../dist/index.html"), (err) => {
      if (err) {
        // If no index.html exists, send a simple response
        res.status(200).send("Mộc Nhiên Authentic - Backend Running");
      }
    });
  } else {
    // For API routes that weren't found, let it fall through to 404
    next();
  }
});

// ============================================
// ERROR HANDLERS (MUST be at the end)
// ============================================

// 404 handler - only for unmatched API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found", path: req.path });
});

// Central error handler
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

async function start() {
  // Validate required environment variables
  if (!env.JWT_SECRET) {
    throw new Error("Missing required env var: JWT_SECRET");
  }
  if (!env.MONGODB_URI) {
    throw new Error("Missing required env var: MONGODB_URI");
  }

  // Render provides PORT environment variable
  const PORT = process.env.PORT || env.PORT || 4000;

  console.log("🔌 Connecting to MongoDB...");
  await connectDB(env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Environment: ${env.NODE_ENV}`);
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
