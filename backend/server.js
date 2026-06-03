console.log("Starting server...");

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

console.log("Environment loaded");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "SET" : "NOT SET");

const { env } = require("./config/env");
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

console.log("Imports complete");

const app = express();

// ====================
// MIDDLEWARE
// ====================

app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(express.json());
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

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use(errorHandler);

// ====================
// SERVER START
// ====================

const PORT = process.env.PORT || env.PORT || 4000;
console.log("PORT:", PORT);

async function startServer() {
  console.log("Starting server...");
  
  if (!process.env.MONGODB_URI) {
    console.error("❌ Missing MONGODB_URI");
    process.exit(1);
  }
  
  if (!process.env.JWT_SECRET) {
    console.error("❌ Missing JWT_SECRET");
    process.exit(1);
  }

  try {
    console.log("🔌 Connecting to MongoDB...");
    await connectDB(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});

startServer();
