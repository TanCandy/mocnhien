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
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
  JWT_ISSUER: process.env.JWT_ISSUER || "moc-nhien-authentic",
  QUOTE_EXCHANGE_RATE_VND_PER_USD: Number(process.env.QUOTE_EXCHANGE_RATE_VND_PER_USD || 23000),
};

module.exports = {
  env,
  required,
};

