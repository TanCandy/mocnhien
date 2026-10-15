const mongoose = require("mongoose");
const User = require("../models/User");
const Order = require("../models/Order");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\-+()]{8,15}$/;

async function getProfile(req, res) {
  const user = await User.findById(req.user._id).select("_id name email role phoneNumber primaryAddress createdAt").lean();
  return res.status(200).json({ user });
}

async function listUsers(req, res) {
  const users = await User.find().select("_id name email role phoneNumber primaryAddress createdAt").sort({ createdAt: -1 }).lean();
  return res.status(200).json({ users });
}

async function createUser(req, res) {
  const { name, email, password, role, phoneNumber, primaryAddress } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, password are required." });
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
  if (String(password).length > 128) {
    return res.status(400).json({ message: "Password is too long (max 128 characters)." });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  if (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  const trimmedPhone = String(phoneNumber).trim();
  if (!PHONE_RE.test(trimmedPhone)) {
    return res.status(400).json({ message: "Invalid phone number format." });
  }

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) return res.status(409).json({ message: "Email already in use." });

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: String(password),
    role: role === "admin" ? "admin" : "user",
    phoneNumber: trimmedPhone,
    primaryAddress: String(primaryAddress).trim(),
  });

  return res.status(201).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role, phoneNumber: user.phoneNumber, primaryAddress: user.primaryAddress, createdAt: user.createdAt },
  });
}

async function updateUser(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid user id." });
  const { name, role, phoneNumber, primaryAddress } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (role !== undefined) {
    patch.role = role === "admin" ? "admin" : "user";
    // An admin demoting themselves could leave the system with no admin.
    if (String(id) === String(req.user._id) && patch.role !== "admin") {
      return res.status(400).json({ message: "You cannot remove your own admin role." });
    }
  }
  if (phoneNumber !== undefined) patch.phoneNumber = String(phoneNumber).trim();
  if (primaryAddress !== undefined) patch.primaryAddress = String(primaryAddress).trim();

  const user = await User.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
    .select("_id name email role phoneNumber primaryAddress createdAt")
    .lean();
  if (!user) return res.status(404).json({ message: "User not found." });

  return res.status(200).json({ user });
}

async function updateProfile(req, res) {
  const userId = req.user._id;
  const { email, phoneNumber, primaryAddress } = req.body || {};

  if (!email && !phoneNumber && !primaryAddress) {
    return res.status(400).json({ message: "At least one field must be provided." });
  }

  const patch = {};
  if (email !== undefined) {
    const normalized = String(email).toLowerCase().trim();
    if (!normalized) return res.status(400).json({ message: "Email cannot be empty." });
    if (normalized.length > 254 || !EMAIL_RE.test(normalized)) {
      return res.status(400).json({ message: "Invalid email format." });
    }
    const existing = await User.findOne({ email: normalized, _id: { $ne: userId } }).lean();
    if (existing) return res.status(409).json({ message: "Email is already in use." });
    patch.email = normalized;
  }
  if (phoneNumber !== undefined) {
    const trimmedPhone = String(phoneNumber).trim();
    if (trimmedPhone && !PHONE_RE.test(trimmedPhone)) {
      return res.status(400).json({ message: "Invalid phone number format." });
    }
    patch.phoneNumber = trimmedPhone;
  }
  if (primaryAddress !== undefined) {
    const trimmedAddr = String(primaryAddress).trim();
    if (trimmedAddr.length > 500) {
      return res.status(400).json({ message: "Address is too long (max 500 characters)." });
    }
    patch.primaryAddress = trimmedAddr;
  }

  const previous = patch.email ? await User.findById(userId).select("email").lean() : null;

  const updatedUser = await User.findByIdAndUpdate(userId, patch, { new: true, runValidators: true })
    .select("_id name email role phoneNumber primaryAddress createdAt")
    .lean();

  if (!updatedUser) return res.status(404).json({ message: "User not found." });

  // Orders are looked up by userEmail (my-orders, tracking, ownership checks),
  // so follow the customer to their new address or their history disappears.
  if (previous && previous.email && previous.email !== updatedUser.email) {
    await Order.updateMany({ userEmail: previous.email }, { $set: { userEmail: updatedUser.email } });
    await Order.updateMany(
      { contactType: "email", contactValue: previous.email },
      { $set: { contactValue: updatedUser.email } }
    );
  }

  return res.status(200).json({ user: updatedUser });
}

async function deleteUser(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid user id." });
  if (String(id) === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }
  const user = await User.findByIdAndDelete(id).lean();
  if (!user) return res.status(404).json({ message: "User not found." });

  // Disassociate deleted user from orders so queries don't break with dangling IDs
  await Order.updateMany({ user: id }, { $unset: { user: 1 } });

  return res.status(200).json({ message: "User deleted." });
}

module.exports = {
  getProfile,
  listUsers,
  createUser,
  updateUser,
  updateProfile,
  deleteUser,
};

