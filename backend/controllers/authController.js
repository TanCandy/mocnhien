const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { env } = require("../config/env");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
    }
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

async function register(req, res) {
  const { name, email, password, role, phoneNumber, primaryAddress } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, and password are required." });
  }
  if (!phoneNumber) {
    return res.status(400).json({ message: "phoneNumber is required." });
  }
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

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) return res.status(409).json({ message: "Email already in use." });

  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password,
    role: role === "admin" ? "admin" : "user",
    phoneNumber: String(phoneNumber).trim(),
    primaryAddress: String(primaryAddress).trim(),
  });

  const token = signToken(user);
  appendAuthCookie(res, token);
  return res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, phoneNumber: user.phoneNumber, primaryAddress: user.primaryAddress, createdAt: user.createdAt },
  });
}

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
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
  });
}

async function logout(req, res) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.status(200).json({ message: "Logged out." });
}

module.exports = {
  register,
  login,
  logout,
};

