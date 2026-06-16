const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Moc Nhien Authentic";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      "Email is not configured. Set EMAIL_USER and EMAIL_PASS in your .env file."
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  return transporter;
}

async function verifyConnection() {
  try {
    const t = getTransporter();
    await t.verify();
    return true;
  } catch (err) {
    console.error("[Mailer] Connection verification failed:", err.message);
    return false;
  }
}

async function sendEmail(to, subject, html) {
  if (!to) throw new Error("Recipient address (to) is required.");
  if (!subject) throw new Error("Email subject is required.");
  if (!html) throw new Error("Email body (html) is required.");

  const recipients = Array.isArray(to) ? to : [to];

  console.log(
    `[Mailer] Sending email → to=${recipients.join(", ")} subject="${subject}"`
  );

  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
      to: recipients.join(", "),
      subject,
      html,
    });

    console.log(`[Mailer] ✓ Email sent  messageId=${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(
      `[Mailer] ✗ Failed to send email  to=${recipients.join(", ")} error=${err.message}`
    );
    throw err;
  }
}

module.exports = {
  sendEmail,
  verifyConnection,
};
