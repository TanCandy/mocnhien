const express = require("express");

const authController = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiter");
const authRoutes = require("./authRoutes");
const meRoutes = require("./meRoutes");
const orderRoutes = require("./orderRoutes");
const quoteRoutes = require("./quoteRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const userRoutes = require("./userRoutes");
const emailRoutes = require("./emailRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/me", meRoutes);
router.use("/orders", orderRoutes);
router.use("/quotes", quoteRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/user", userRoutes);
router.use("/", emailRoutes);

// Direct paths (bypass /auth prefix) — matches what the frontend calls
router.post("/forgot-password", authRateLimiter, authController.forgotPassword);
router.post("/reset-password", authRateLimiter, authController.resetPassword);

// 404 handler for unmatched /api/* routes
router.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

module.exports = router;

