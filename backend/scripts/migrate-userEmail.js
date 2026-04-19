/**
 * Migration Script: Populate userEmail field from customerEmail
 * 
 * This ensures all existing orders have the userEmail field populated,
 * which is required for the new user-based order isolation.
 * 
 * Run with: node migrate-userEmail.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/moc-nhien";
const Order = require("./models/Order");

async function migrate() {
  console.log("Starting migration: Populate userEmail field\n");
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    // Find all orders without userEmail
    const ordersWithoutUserEmail = await Order.find({ userEmail: { $exists: false } });
    console.log(`Found ${ordersWithoutUserEmail.length} orders without userEmail field`);

    if (ordersWithoutUserEmail.length === 0) {
      console.log("\nNo orders need migration. All orders have userEmail field.");
    } else {
      // Update each order
      let updated = 0;
      let errors = 0;

      for (const order of ordersWithoutUserEmail) {
        try {
          const emailToUse = (order.customerEmail || "").toLowerCase().trim();
          
          if (!emailToUse) {
            console.log(`  Order ${order._id}: No customerEmail found, skipping`);
            errors++;
            continue;
          }

          await Order.updateOne(
            { _id: order._id },
            { $set: { userEmail: emailToUse } }
          );
          
          console.log(`  Order ${order.orderCode || order._id}: Set userEmail to "${emailToUse}"`);
          updated++;
        } catch (err) {
          console.log(`  Order ${order._id}: Error - ${err.message}`);
          errors++;
        }
      }

      console.log(`\nMigration complete!`);
      console.log(`  Updated: ${updated} orders`);
      console.log(`  Errors: ${errors} orders`);
    }

    // Verify migration
    const remaining = await Order.countDocuments({ userEmail: { $exists: false } });
    const total = await Order.countDocuments();
    console.log(`\nVerification:`);
    console.log(`  Total orders: ${total}`);
    console.log(`  Orders with userEmail: ${total - remaining}`);
    console.log(`  Orders without userEmail: ${remaining}`);

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  }
}

migrate();
