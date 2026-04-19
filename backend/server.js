const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const { env } = require("./config/env");
const { connectDB } = require("./config/db");
const apiRoutes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === "production" ? false : "http://localhost:3000",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Health checks
app.get("/", (req, res) => res.json({ status: "ok" }));
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

// API routes
app.use("/api", apiRoutes);

// Static files + SPA fallback
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("/*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      res.status(200).send("<h1>Backend Running</h1><p>Run: npm run build</p>");
    }
  });
});

// Error handler (LAST)
app.use(errorHandler);

// Server startup
const PORT = process.env.PORT || 4000;

async function start() {
  if (!env.JWT_SECRET) throw new Error("Missing JWT_SECRET");
  if (!env.MONGODB_URI) throw new Error("Missing MONGODB_URI");

  await connectDB(env.MONGODB_URI);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

process.on("unhandledRejection", (err) => console.error(err));
process.on("uncaughtException", (err) => { console.error(err); process.exit(1); });

start().catch((err) => { console.error(err); process.exit(1); });
