const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const path = require("path");
const { env } = require("./config/env");
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// ====================
// MIDDLEWARE
// ====================

// CORS - allow all origins for API access
app.use(cors({
  origin: "*",
  credentials: true
}));

// JSON body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// ====================
// HEALTH CHECKS
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

// 404 handler for unmatched API routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler (LAST)
app.use(errorHandler);

// ====================
// SERVER START
// ====================

const PORT = process.env.PORT || env.PORT || 4000;

async function startServer() {
  try {
    // Validate required env vars
    if (!env.MONGODB_URI) {
      throw new Error("Missing required env var: MONGODB_URI");
    }
    if (!env.JWT_SECRET) {
      throw new Error("Missing required env var: JWT_SECRET");
    }

    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await connectDB(env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    // Start server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

// Handle unhandled rejections
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

startServer();
