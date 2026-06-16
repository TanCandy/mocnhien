const crypto = require("crypto");
const email = require("../utils/email");
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
  const base = email.buildResetLink(rawToken);
  return base;
}

/** Persist a fresh password-reset token on a user record. */
async function issuePasswordResetToken(user) {
  const rawToken = generateResetToken();
  user.passwordResetToken = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  return { rawToken, expiresAt: user.passwordResetExpires };
}

/** Send the "Reset Password" email via Resend. */
async function sendPasswordResetEmail(to, _name, resetLink) {
  const token = new URL(resetLink).searchParams.get("token");
  return email.sendResetEmail(to, token);
}

module.exports = {
  RESET_TTL_MS,
  generateResetToken,
  hashToken,
  buildResetUrl,
  issuePasswordResetToken,
  sendPasswordResetEmail,
};
