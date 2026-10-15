const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async function setup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-for-automated-tests-only";
  process.env.ALLOWED_ORIGINS = "http://localhost:3000";
  process.env.SEPAY_WEBHOOK_API_KEY = "test-sepay-key";
  process.env.PAYMENT_ACCOUNT_NUMBER = "80002725995";
  process.env.PAYMENT_BANK_BIN = "970426";
  delete process.env.WEBHOOK_URL; // never call a real Google Sheet from tests

  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  return async function teardown() {
    await mongod.stop();
  };
};
