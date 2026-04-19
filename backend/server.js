const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

// Load .env file from backend folder
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// ============================================
// API ROUTES
// ============================================

// Mount all API routes under /api/*
app.use("/api", apiRoutes);

// ============================================
// STATIC FILES & SPA FALLBACK
// ============================================

// Path to frontend dist folder (root of project)
const distPath = path.join(__dirname, "../dist");

// Serve static frontend build files
app.use(express.static(distPath));

// Catch-all route for SPA - MUST be the LAST route
// Use /* instead of * to avoid path-to-regexp crash
app.get("/*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      // Fallback if index.html doesn't exist
      res.status(200).send(`
        <html>
          <head><title>Mộc Nhiên Authentic</title></head>
          <body>
            <h1>Mộc Nhiên Authentic</h1>
            <p>Backend is running. Frontend not built yet.</p>
            <p>Run: npm run build</p>
          </body>
        </html>
      `);
    }
  });
});

// ============================================
// ERROR HANDLERS (at the very end)
// ============================================

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
