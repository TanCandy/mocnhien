const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register",         authController.register);
router.post("/login",            authController.login);
router.post("/forgot-password",  authController.forgotPassword);
router.post("/reset-password",   authController.resetPassword);
router.post("/logout",           authController.logout);

// REMOVED: /verify-otp, /resend-otp  (no email verification)

module.exports = router;
