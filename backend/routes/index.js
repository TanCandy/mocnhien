const express = require("express");

const authController = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiter");
const { validate } = require("../middleware/validate");
const { forgotPasswordSchema, resetPasswordSchema } = require("../validation/schemas");
const authRoutes = require("./authRoutes");
const meRoutes = require("./meRoutes");
const orderRoutes = require("./orderRoutes");
const quoteRoutes = require("./quoteRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const userRoutes = require("./userRoutes");
const emailRoutes = require("./emailRoutes");
const paymentRoutes = require("./paymentRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/me", meRoutes);
router.use("/orders", orderRoutes);
router.use("/quotes", quoteRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/user", userRoutes);
router.use("/payments", paymentRoutes);
router.use("/", emailRoutes);

// Direct paths (bypass /auth prefix) — matches what the frontend calls
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

// 404 handler for unmatched /api/* routes
router.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

module.exports = router;

