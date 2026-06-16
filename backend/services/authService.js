const crypto = require("crypto");
const { sendEmail } = require("../utils/mailer");
const { env } = require("../config/env");

// REMOVED: OTP generation, OTP storage, OTP email, OTP verification helpers
// KEPT:    reset-token generation, hashing, and password-reset email only

const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Generate an opaque, URL-safe reset token. Returned RAW to the email. */
function generateResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/** Hash a token for safe DB storage (never store raw reset tokens). */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Build the absolute reset URL the user will click in the email. */
function buildResetUrl(rawToken) {
  const base = env.FRONTEND_BASE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
}

/** Persist a fresh password-reset token on a user record. */
async function issuePasswordResetToken(user) {
  const rawToken = generateResetToken();
  user.passwordResetToken = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  return { rawToken, expiresAt: user.passwordResetExpires };
}

/** Send the "Reset Password" email. */
async function sendPasswordResetEmail(to, name, resetLink) {
  const subject = "Reset Password";
  const html = `
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
  return sendEmail(to, subject, html);
}

module.exports = {
  RESET_TTL_MS,
  generateResetToken,
  hashToken,
  buildResetUrl,
  issuePasswordResetToken,
  sendPasswordResetEmail,
};
