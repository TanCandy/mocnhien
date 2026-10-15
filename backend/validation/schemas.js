const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(254),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  phoneNumber: z.string().trim().min(1, "phoneNumber is required").max(20),
  primaryAddress: z.string().trim().min(1, "primaryAddress is required").max(500),
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(254),
  password: z.string().min(1, "password is required").max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(128),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
