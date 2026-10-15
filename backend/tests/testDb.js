const mongoose = require("mongoose");

async function connectTestDb(name) {
  const dbName = `test_${name}_${Date.now()}`;
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
}

async function disconnectTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}

module.exports = { connectTestDb, disconnectTestDb };
