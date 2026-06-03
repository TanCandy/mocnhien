/**
 * Migration: backfill staffName for legacy orders
 *
 * Run from backend folder:
 *   node scripts/migrate-staffName.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Order = require("../models/Order");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/moc-nhien";

async function migrate() {
  console.log("Starting migration: backfill staffName\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    const filter = {
      $or: [
        { staffName: { $exists: false } },
        { staffName: null },
        { staffName: "" },
      ],
    };

    const count = await Order.countDocuments(filter);
    console.log(`Found ${count} orders missing staffName`);

    if (count === 0) {
      console.log("No orders need migration.");
    } else {
      const result = await Order.updateMany(filter, { $set: { staffName: "Unknown" } });
      console.log(`Updated ${result.modifiedCount} order(s) with staffName = "Unknown"`);
    }

    const remaining = await Order.countDocuments(filter);
    console.log(`\nVerification: ${remaining} orders still missing staffName`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("\nDisconnected from MongoDB");
    process.exit();
  }
}

migrate();
