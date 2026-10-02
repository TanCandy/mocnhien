/**
 * Create an admin account, or promote an existing account to admin.
 *
 * Public registration always creates regular users, so the first admin on a
 * fresh server must be created with this script.
 *
 * Usage (from backend/):
 *   node scripts/create-admin.js --email you@example.com [--name "Your Name"] [--password "..."]
 *
 * Inside the Docker stack:
 *   docker compose exec app node backend/scripts/create-admin.js --email you@example.com
 *
 * - Existing user  → role set to admin (password only changed if --password given).
 * - New user       → created as admin. If --password is omitted a random one
 *                    is generated and printed once.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith("--")) {
      args[key.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.email || "").toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: node scripts/create-admin.js --email you@example.com [--name \"Name\"] [--password \"...\"]");
    process.exit(1);
  }
  if (args.password !== undefined && String(args.password).length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = "admin";
    if (args.password) existing.password = String(args.password);
    await existing.save();
    console.log(`Promoted ${email} to admin${args.password ? " and updated the password" : ""}.`);
  } else {
    const password = args.password ? String(args.password) : crypto.randomBytes(12).toString("base64url");
    await User.create({
      name: args.name ? String(args.name).trim() : "Admin",
      email,
      password,
      role: "admin",
      phoneNumber: "0000000000",
      primaryAddress: "N/A",
    });
    console.log(`Created admin ${email}.`);
    if (!args.password) {
      console.log(`Generated password (shown once — change it after first login): ${password}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
