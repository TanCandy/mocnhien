const User = require("../models/User");

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

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) return res.status(409).json({ message: "Email already in use." });

  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password: String(password),
    role: role === "admin" ? "admin" : "user",
    phoneNumber: String(phoneNumber).trim(),
    primaryAddress: String(primaryAddress).trim(),
  });

  return res.status(201).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role, phoneNumber: user.phoneNumber, primaryAddress: user.primaryAddress, createdAt: user.createdAt },
  });
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { name, role, phoneNumber, primaryAddress } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (role !== undefined) patch.role = role === "admin" ? "admin" : "user";
  if (phoneNumber !== undefined) patch.phoneNumber = String(phoneNumber).trim();
  if (primaryAddress !== undefined) patch.primaryAddress = String(primaryAddress).trim();

  const user = await User.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
    .select("_id name email role phoneNumber primaryAddress createdAt")
    .lean();
  if (!user) return res.status(404).json({ message: "User not found." });

  return res.status(200).json({ user });
}

async function deleteUser(req, res) {
  const { id } = req.params;
  const user = await User.findByIdAndDelete(id).lean();
  if (!user) return res.status(404).json({ message: "User not found." });
  return res.status(200).json({ message: "User deleted." });
}

module.exports = {
  getProfile,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};

