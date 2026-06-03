/**
 * Migration: replace legacy customerEmail with contactType + contactValue
 *
 * - Orders with customerEmail → contactType: "email", contactValue: <customerEmail>
 * - Orders without customerEmail → contactType: "none", contactValue: "NO_CONTACT"
 *
 * Run from backend folder:
 *   node scripts/migrate-contact.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Order = require("../models/Order");

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/moc-nhien";

async function migrate() {
  console.log("Starting migration: customerEmail → contactType + contactValue\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    // 1. Migrate orders with customerEmail
    const withEmail = await Order.find({
      customerEmail: { $exists: true, $ne: "" },
      contactType: { $exists: false },
    });

    console.log(`Found ${withEmail.length} orders with customerEmail to migrate`);

    if (withEmail.length > 0) {
      const result = await Order.updateMany(
        { _id: { $in: withEmail.map((o) => o._id) } },
        {
          $set: {
            contactType: "email",
            contactValue: "",
          },
        }
      );
      console.log(`Migrated ${result.modifiedCount} order(s) → email`);
    }

    // 2. Backfill contactValue for migrated orders
    const noContactValue = await Order.find({
      contactType: "email",
      contactValue: { $in: ["", null, undefined] },
    });

    if (noContactValue.length > 0) {
      for (const order of noContactValue) {
        await Order.updateOne(
          { _id: order._id },
          { $set: { contactValue: order.customerEmail || "" } }
        );
      }
      console.log(`Set contactValue for ${noContactValue.length} order(s)`);
    }

    // 3. Migrate orders with no customerEmail → none
    const withoutEmail = await Order.find({
      $or: [
        { customerEmail: { $exists: false } },
        { customerEmail: "" },
      ],
      contactType: { $exists: false },
    });

    console.log(`Found ${withoutEmail.length} orders without customerEmail`);

    if (withoutEmail.length > 0) {
      const result = await Order.updateMany(
        { _id: { $in: withoutEmail.map((o) => o._id) } },
        {
          $set: {
            contactType: "none",
            contactValue: "NO_CONTACT",
          },
        }
      );
      console.log(`Migrated ${result.modifiedCount} order(s) → none`);
    }

    // Verification
    const total = await Order.countDocuments();
    const withContactType = await Order.countDocuments({ contactType: { $exists: true } });
    console.log(`\nVerification:`);
    console.log(`  Total orders:       ${total}`);
    console.log(`  With contactType:   ${withContactType}`);
    console.log(`  Without contactType: ${total - withContactType}`);
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
