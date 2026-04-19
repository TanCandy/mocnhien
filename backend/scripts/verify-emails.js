/**
 * Debug Script: Check email consistency between Users and Orders
 * 
 * Run with: node scripts/verify-emails.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/moc-nhien";
const Order = require("../models/Order");
const User = require("../models/User");

async function verify() {
  console.log("=== Email Consistency Check ===\n");
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    // Get all users
    const users = await User.find().lean();
    console.log(`Found ${users.length} users`);
    users.forEach(u => console.log(`  - ${u.email} (role: ${u.role})`));
    console.log();

    // Get all orders
    const orders = await Order.find().lean();
    console.log(`Found ${orders.length} orders\n`);

    // Check orders without userEmail
    const ordersWithoutUserEmail = orders.filter(o => !o.userEmail);
    console.log(`Orders without userEmail field: ${ordersWithoutUserEmail.length}`);
    if (ordersWithoutUserEmail.length > 0) {
      console.log("  These orders may not appear in user's order lists:");
      ordersWithoutUserEmail.slice(0, 5).forEach(o => {
        console.log(`    - ${o.orderCode || o._id}: customerEmail="${o.customerEmail}"`);
      });
    }
    console.log();

    // Check for email case/spacing mismatches
    const normalizedEmails = new Map();
    let mismatches = 0;

    orders.forEach(o => {
      const email = (o.customerEmail || o.userEmail || "").toLowerCase().trim();
      if (email) {
        normalizedEmails.set(o._id.toString(), email);
      }
    });

    // Find users whose orders might not match
    users.forEach(u => {
      const userEmail = u.email.toLowerCase().trim();
      const userOrders = orders.filter(o => 
        (o.customerEmail || o.userEmail || "").toLowerCase().trim() === userEmail
      );
      
      if (userOrders.length === 0) {
        console.log(`WARNING: User ${u.email} has no matching orders!`);
        mismatches++;
      } else {
        console.log(`User ${u.email}: ${userOrders.length} orders found`);
      }
    });

    console.log(`\n=== Summary ===`);
    console.log(`Total users: ${users.length}`);
    console.log(`Total orders: ${orders.length}`);
    console.log(`Orders needing migration: ${ordersWithoutUserEmail.length}`);
    console.log(`Users without matching orders: ${mismatches}`);

    if (ordersWithoutUserEmail.length > 0) {
      console.log(`\n>>> Run: node scripts/migrate-userEmail.js to fix this!`);
    }

  } catch (error) {
    console.error("Verification failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  }
}

verify();
