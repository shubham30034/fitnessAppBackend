// scripts/createSuperAdmin.js

const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ✅ Load env once (correct path)
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const User = require("../Model/userModel/userModel");
const UserAdditionalInfo = require("../Model/userModel/additionalInfo");

/* ================================
   ✅ Phone Normalizer (E.164)
   - "9876543210" -> "+919876543210"
   - "91xxxxxxxxxx" -> "+91xxxxxxxxxx"
   - "+91xxxxxxxxxx" stays same
================================ */
const normalizeIndianPhone = (phone) => {
  if (!phone) return null;

  let p = String(phone).trim();

  // already E.164
  if (p.startsWith("+")) return p;

  // remove spaces/dashes
  p = p.replace(/[^0-9]/g, "");

  // 10 digits -> add +91
  if (p.length === 10) return `+91${p}`;

  // 12 digits starting with 91 -> add +
  if (p.length === 12 && p.startsWith("91")) return `+${p}`;

  return null;
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

async function createSuperAdmin() {
  try {
    // ✅ validate env vars
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing in .env");

    if (!process.env.SUPERADMIN_PHONE)
      throw new Error("SUPERADMIN_PHONE missing in .env");

    if (!process.env.SUPERADMIN_PASSWORD)
      throw new Error("SUPERADMIN_PASSWORD missing in .env");

    if (!process.env.SUPERADMIN_EMAIL)
      throw new Error("SUPERADMIN_EMAIL missing in .env");

    const phone = normalizeIndianPhone(process.env.SUPERADMIN_PHONE);

    if (!phone) {
      throw new Error(
        "Invalid SUPERADMIN_PHONE. Use 10 digits or +91XXXXXXXXXX"
      );
    }

    const existing = await User.findOne({ role: "superadmin" });
    if (existing) {
      console.log("❌ Superadmin already exists");
      return process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10);

    const superAdminUser = await User.create({
      phone,
      password: hashedPassword,
      role: "superadmin",
    });

    const additionalInfo = await UserAdditionalInfo.create({
      name: "Super Admin",
      email: process.env.SUPERADMIN_EMAIL,
      userId: superAdminUser._id,
    });

    superAdminUser.additionalInfo = additionalInfo._id;
    await superAdminUser.save();

    console.log("✅ Superadmin created successfully");
    console.log("📌 Phone saved as:", superAdminUser.phone);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating superadmin:", err.message);
    process.exit(1);
  }
}

(async () => {
  await connectDB();
  await createSuperAdmin();
})();
