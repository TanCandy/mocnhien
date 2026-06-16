const { sendEmail, verifyConnection } = require("../utils/mailer");

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

async function sendTestEmail(req, res) {
  const { to, subject, message } = req.body || {};

  if (!to || !isValidEmail(to)) {
    return res.status(400).json({
      success: false,
      message: "A valid recipient email address (`to`) is required.",
    });
  }

  const finalSubject = (subject || "Moc Nhien Authentic — Test Email").trim();
  const userMessage = (message || "This is a test email from the Moc Nhien Authentic backend.").trim();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6b4423; margin-bottom: 16px;">Moc Nhien Authentic</h2>
      <p>${userMessage.replace(/\n/g, "<br>")}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #888;">
        Sent at ${new Date().toISOString()} from the Moc Nhien Authentic backend.
      </p>
    </div>
  `;

  try {
    const result = await sendEmail(to, finalSubject, html);
    return res.status(200).json({
      success: true,
      message: "Test email sent successfully.",
      messageId: result.messageId,
      to,
      subject: finalSubject,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to send test email.",
      error: err.message,
    });
  }
}

async function checkEmailConfig(req, res) {
  const hasCreds = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  if (!hasCreds) {
    return res.status(503).json({
      success: false,
      configured: false,
      message: "Email is not configured. Set EMAIL_USER and EMAIL_PASS in your .env file.",
    });
  }

  const ok = await verifyConnection();
  return res.status(ok ? 200 : 503).json({
    success: ok,
    configured: true,
    message: ok ? "SMTP connection is healthy." : "SMTP connection failed.",
  });
}

module.exports = {
  sendTestEmail,
  checkEmailConfig,
};
