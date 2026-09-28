const express = require("express");
const authController = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiter");
const { validate } = require("../middleware/validate");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validation/schemas");

const router = express.Router();

router.post("/register",         authRateLimiter, validate(registerSchema), authController.register);
router.post("/login",            authRateLimiter, validate(loginSchema), authController.login);
router.post("/forgot-password",  authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password",   authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post("/logout",           authController.logout);

// REMOVED: /verify-otp, /resend-otp  (no email verification)

module.exports = router;
