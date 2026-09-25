// Run `npm run seed` from backend/ to provision the admin account and sample SKUs.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");
const Sku = require("../models/Sku");

async function seed() {
  await connectDB();

  const name = process.env.SEED_NAME || "Admin";
  const email = (process.env.SEED_EMAIL || "admin@pharma.local").toLowerCase();
  const password = process.env.SEED_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  const permissions = User.getDefaultPermissions("ADMIN");

  const existingUser = await User.findOne({ email });
  if (!existingUser) {
    await User.create({ name, email, passwordHash, role: "ADMIN", permissions });
    console.log("User created:");
    console.log("  email:   ", email);
    console.log("  password:", password);
  } else {
    existingUser.name = name;
    existingUser.passwordHash = passwordHash;
    existingUser.role = "ADMIN";
    existingUser.permissions = permissions;
    await existingUser.save();
    console.log(`Admin user updated: ${email}`);
  }

  const sampleSkus = [
    { name: "Paracetamol 500mg", category: "PHARMA", subCategory: "TABLET", manufacturer: "GSK", uom: "STRIP", mrp: 30 },
    { name: "Amoxicillin 250mg", category: "PHARMA", subCategory: "CAPSULE", manufacturer: "Cipla", uom: "STRIP", mrp: 60 },
    { name: "Betadine Ointment 20g", category: "PHARMA", subCategory: "OINTMENT", manufacturer: "Win-Medicare", uom: "UNIT", mrp: 85 },
  ];

  for (const s of sampleSkus) {
    const exists = await Sku.findOne({ name: s.name });
    if (!exists) await Sku.create(s);
  }
  console.log("Sample SKUs ensured.");

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
