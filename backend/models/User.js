const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user", required: true },
    phoneNumber: { type: String, trim: true, required: true },
    primaryAddress: { type: String, trim: true, required: true },

    // Password reset (kept — used by forgot/reset flow)
    passwordResetToken: { type: String, default: null, index: true, sparse: true },
    passwordResetExpires: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// REMOVED: isVerified, otpCode, otpExpires, otpAttempts (no email verification)

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

module.exports = mongoose.model("User", userSchema);
