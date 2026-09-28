const express = require("express");
const authController = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register",         authRateLimiter, authController.register);
router.post("/login",            authRateLimiter, authController.login);
router.post("/forgot-password",  authRateLimiter, authController.forgotPassword);
router.post("/reset-password",   authRateLimiter, authController.resetPassword);
router.post("/logout",           authController.logout);

// REMOVED: /verify-otp, /resend-otp  (no email verification)

module.exports = router;
