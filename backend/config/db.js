const mongoose = require("mongoose");

async function connectDB(uri) {
  if (!uri) {
    throw new Error("Missing MongoDB connection string (MONGODB_URI).");
  }

  // Avoid creating multiple connections in watch/dev scenarios.
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  return mongoose.connection;
}

module.exports = { connectDB };

