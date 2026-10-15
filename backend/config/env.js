function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Handle PORT - Render sets this, fallback to default for local dev
const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : (process.env.NODE_ENV === "production" ? 10000 : 4000);

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
  JWT_ISSUER: process.env.JWT_ISSUER || "moc-nhien-authentic",
  QUOTE_EXCHANGE_RATE_VND_PER_USD: Number(process.env.QUOTE_EXCHANGE_RATE_VND_PER_USD || 23000),
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "http://localhost:3000",
  WEBHOOK_URL: process.env.WEBHOOK_URL || "",
  // Shared secret sent in the Sheets webhook body (checked by Code.gs).
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "",

  // ── Payments (VietQR + SePay) ────────────────────────────────────────────
  // Receiving bank account shown on the QR. BIN = NAPAS bank id (MSB = 970426).
  PAYMENT_BANK_BIN: process.env.PAYMENT_BANK_BIN || "970426",
  PAYMENT_BANK_NAME: process.env.PAYMENT_BANK_NAME || "MSB",
  PAYMENT_ACCOUNT_NUMBER: process.env.PAYMENT_ACCOUNT_NUMBER || "80002725995",
  PAYMENT_ACCOUNT_NAME: process.env.PAYMENT_ACCOUNT_NAME || "LE THI DIEU",
  // API key configured on the SePay webhook (sent as "Authorization: Apikey <key>").
  // Empty = webhook endpoint disabled.
  SEPAY_WEBHOOK_API_KEY: process.env.SEPAY_WEBHOOK_API_KEY || "",
};

module.exports = {
  env,
  required,
};

