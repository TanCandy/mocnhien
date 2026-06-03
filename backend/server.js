console.log("Starting server...");

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

// Load .env from backend directory (production) or project root (development)
const envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });

// Also try project root for Railway dev setups
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
}

console.log("Environment loaded");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "SET" : "NOT SET");

const { env } = require("./config/env");
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

console.log("Imports complete");

const app = express();

// ====================
// CORS — Railway & local dev
// ====================
// Allow requests from Railway-provided frontend domain and localhost dev
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,        // Railway injects this
  process.env.PUBLIC_FRONTEND_URL, // Alternative Railway var
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    // or from an allowed origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(null, true); // Allow all for now — restrict via Railway firewall if needed
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

// ====================
// SERVE FRONTEND SPA — fallback for all non-API routes
// ====================
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) res.status(200).json({ status: "ok", note: "Frontend not built — run `npm run build` first" });
    });
  } else {
    res.status(404).json({ error: "Endpoint not found" });
  }
});

app.use(errorHandler);

// ====================
// SERVER START
// ====================
// Railway injects PORT as an env var
const PORT = process.env.PORT || env.PORT || 4000;
console.log("PORT:", PORT);

// Graceful env var validation
const missingVars = [];
if (!process.env.MONGODB_URI) missingVars.push("MONGODB_URI");
if (!process.env.JWT_SECRET) missingVars.push("JWT_SECRET");

if (missingVars.length > 0) {
  console.error(`Missing required env vars: ${missingVars.join(", ")}`);
  console.error("Set them in Railway Dashboard → Variables, or create a .env file.");
  // Don't exit in dev — allow dev to use local .env
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

async function startServer() {
  try {
    if (process.env.MONGODB_URI) {
      console.log("Connecting to MongoDB...");
      await connectDB(process.env.MONGODB_URI);
      console.log("MongoDB connected");
    } else {
      console.warn("MONGODB_URI not set — skipping DB connection");
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      console.log(`Health: http://0.0.0.0:${PORT}/health`);
      if (process.env.NODE_ENV === "production") {
        console.log(`Frontend: http://0.0.0.0:${PORT}`);
      }
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});

startServer();
