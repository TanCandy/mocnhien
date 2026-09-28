const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async function setup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-for-automated-tests-only";
  process.env.ALLOWED_ORIGINS = "http://localhost:3000";

  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  return async function teardown() {
    await mongod.stop();
  };
};
