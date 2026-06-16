const express = require("express");
const { sendTestEmail, checkEmailConfig } = require("../controllers/emailController");

const router = express.Router();

router.post("/send-test-email", sendTestEmail);
router.get("/email-status", checkEmailConfig);

module.exports = router;
