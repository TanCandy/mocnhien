const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { env } = require("../config/env");
const User = require("../models/User");
const authService = require("../services/authService");
const { sendResetEmail } = require("../utils/email");

// =============================================
//  TOKEN / COOKIE HELPERS
// =============================================
function signToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, issuer: env.JWT_ISSUER }
  );
}

function appendAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// =============================================
//  REGISTER  (SIMPLIFIED — no email verification)
//  - User can log in immediately after registering
// =============================================
async function register(req, res) {
  const { name, email, password, role, phoneNumber, primaryAddress } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, and password are required." });
  }
  if (!phoneNumber) return res.status(400).json({ message: "phoneNumber is required." });
  if (!primaryAddress || String(primaryAddress).trim() === "") {
    return res.status(400).json({ message: "primaryAddress is required." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const phoneRegex = /^[\d\s\-+()]{8,15}$/;
  if (!phoneRegex.test(String(phoneNumber).trim())) {
    return res.status(400).json({ message: "Invalid phone number format." });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return res.status(409).json({ message: "Email already in use." });

  // Create the user. The pre-save hook hashes the password with bcrypt.
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password,
    role: role === "admin" ? "admin" : "user",
    phoneNumber: String(phoneNumber).trim(),
    primaryAddress: String(primaryAddress).trim(),
  });

  // Issue a JWT immediately — no verification step required
  const token = signToken(user);
  appendAuthCookie(res, token);

  return res.status(201).json({
    message: "Account created successfully.",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      primaryAddress: user.primaryAddress,
      createdAt: user.createdAt,
    },
  });
}

// =============================================
//  LOGIN  (SIMPLIFIED — no isVerified check)
// =============================================
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required." });
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) return res.status(401).json({ message: "Invalid credentials." });

  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials." });

  const token = signToken(user);
  appendAuthCookie(res, token);
  return res.status(200).json({
    message: "Logged in successfully.",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      primaryAddress: user.primaryAddress,
      createdAt: user.createdAt,
    },
  });
}

// =============================================
//  FORGOT PASSWORD
//  - Always returns the same generic message (no email enumeration)
// =============================================
async function forgotPassword(req, res) {
  const { email } = req.body || {};
  const generic = {
    message: "If an account with that email exists, a password reset link has been sent.",
  };

  if (!email) return res.status(400).json({ message: "email is required." });

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return res.status(200).json(generic); // Do not reveal existence

  try {
    const { rawToken } = await authService.issuePasswordResetToken(user);
    try {
      await sendResetEmail(user.email, rawToken, user.name);
    } catch (emailErr) {
      console.error("[ForgotPassword] Email failed:", emailErr.message);
      return res.status(500).json({ message: "Failed to send reset email." });
    }
    return res.status(200).json(generic);
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return res.status(500).json({ message: "Failed to process request." });
  }
}

// =============================================
//  RESET PASSWORD
//  - Verifies token + expiry, then updates the password (bcrypt via pre-save hook)
// =============================================
async function resetPassword(req, res) {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: "token and newPassword are required." });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const hashed = authService.hashToken(String(token));
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired reset token." });
  }

  // Setting `password` triggers the pre-save bcrypt hook
  user.password = String(newPassword);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  // Auto-login the user after a successful reset
  const jwtToken = signToken(user);
  appendAuthCookie(res, jwtToken);

  return res.status(200).json({
    message: "Password has been reset successfully. You are now logged in.",
    token: jwtToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}

// =============================================
//  LOGOUT
// =============================================
async function logout(req, res) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.status(200).json({ message: "Logged out." });
}

// REMOVED: verifyOtp, resendOtp (no email verification)

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
};
