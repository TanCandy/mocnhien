const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const { roleMiddleware } = require("../middleware/roleMiddleware");
const { sendTestEmail, checkEmailConfig } = require("../controllers/emailController");

const router = express.Router();

// Admin-only: unauthenticated, this let anyone send arbitrary HTML email
// through the Resend account.
router.post("/send-test-email", authMiddleware, roleMiddleware("admin"), sendTestEmail);
router.get("/email-status", authMiddleware, roleMiddleware("admin"), checkEmailConfig);

module.exports = router;
