const User = require("../models/User");

async function getMe(req, res) {
  const user = await User.findById(req.user._id).select("_id name email createdAt").lean();
  return res.status(200).json({ user });
}

async function patchMe(req, res) {
  const { name } = req.body || {};
  const updates = {};

  if (name !== undefined) {
    const next = String(name).trim();
    if (!next) return res.status(400).json({ message: "name cannot be empty." });
    updates.name = next;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select("_id name email createdAt");

  return res.status(200).json({ user });
}

module.exports = { getMe, patchMe };

