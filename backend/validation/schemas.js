const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phoneNumber: z.string().trim().min(1, "phoneNumber is required"),
  primaryAddress: z.string().trim().min(1, "primaryAddress is required"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
