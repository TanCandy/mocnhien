const { Resend } = require("resend");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const FROM_ADDRESS = process.env.RESEND_FROM || "Moc Nhien Authentic <onboarding@resend.dev>";
const FROM_NAME_FALLBACK = process.env.RESEND_FROM_NAME || "Moc Nhien Authentic";

let resend = null;

function getClient() {
  if (resend) return resend;
  if (!RESEND_API_KEY) {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY in your environment (and CLIENT_URL)."
    );
  }
  resend = new Resend(RESEND_API_KEY);
  return resend;
}

function buildResetLink(token) {
  const base = String(CLIENT_URL).replace(/\/$/, "");
  return `${base}/reset-password?token=${token}`;
}

function buildResetHtml(resetLink, name) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6b4423; margin: 0 0 16px;">Reset your password</h2>
      <p>Hi ${name || "there"},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>15 minutes</strong>.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}"
           style="background: #6b4423; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">
          Reset my password
        </a>
      </p>
      <p>Or paste this link into your browser:</p>
      <p style="word-break: break-all; color: #555;">${resetLink}</p>
      <p style="font-size: 12px; color: #888; margin-top: 24px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
}

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

async function sendEmail({ to, subject, html, from }) {
  if (!isValidEmail(to)) throw new Error("A valid recipient email address is required.");
  if (!subject) throw new Error("Email subject is required.");
  if (!html) throw new Error("Email body (html) is required.");

  const client = getClient();
  const fromAddress = from || FROM_ADDRESS;

  console.log(`[Email] Sending via Resend → to=${to} subject="${subject}"`);

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error(`[Email] ✗ Resend error: ${error.message || JSON.stringify(error)}`);
      throw new Error(error.message || "Resend returned an error.");
    }

    console.log(`[Email] ✓ Sent  id=${data && data.id}`);
    return { success: true, id: data && data.id };
  } catch (err) {
    console.error(`[Email] ✗ Failed to send  to=${to} error=${err.message}`);
    throw err;
  }
}

async function sendResetEmail(email, token, name) {
  const resetLink = buildResetLink(token);
  return sendEmail({
    to: email,
    subject: "Reset Password",
    html: buildResetHtml(resetLink, name),
  });
}

async function sendTestEmail(email, subject, message) {
  const safeSubject = (subject || `${FROM_NAME_FALLBACK} — Test Email`).trim();
  const safeMessage = (message || `This is a test email from ${FROM_NAME_FALLBACK}.`).trim();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6b4423; margin-bottom: 16px;">${FROM_NAME_FALLBACK}</h2>
      <p>${safeMessage.replace(/\n/g, "<br>")}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #888;">
        Sent at ${new Date().toISOString()} via Resend.
      </p>
    </div>
  `;
  return sendEmail({ to: email, subject: safeSubject, html });
}

module.exports = {
  getClient,
  buildResetLink,
  buildResetHtml,
  sendEmail,
  sendResetEmail,
  sendTestEmail,
  isValidEmail,
};
