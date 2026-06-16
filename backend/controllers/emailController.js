const { sendTestEmail, isValidEmail } = require("../utils/email");

async function sendTestEmailRoute(req, res) {
  const { to, subject, message } = req.body || {};

  if (!to || !isValidEmail(to)) {
    return res.status(400).json({
      success: false,
      message: "A valid recipient email address (`to`) is required.",
    });
  }

  try {
    const result = await sendTestEmail(to, subject, message);
    return res.status(200).json({
      success: true,
      message: "Test email sent successfully.",
      id: result.id,
      to,
      subject: subject || "Moc Nhien Authentic — Test Email",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to send test email.",
      error: err.message,
    });
  }
}

async function checkEmailConfig(_req, res) {
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({
      success: false,
      configured: false,
      message: "Email is not configured. Set RESEND_API_KEY in your environment.",
    });
  }

  return res.status(200).json({
    success: true,
    configured: true,
    message: "Resend is configured (RESEND_API_KEY present).",
  });
}

module.exports = {
  sendTestEmail: sendTestEmailRoute,
  checkEmailConfig,
};
