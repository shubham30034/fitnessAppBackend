// scripts/createSuperAdmin.js
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });


const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../Model/userModel/userModel');
const UserAdditionalInfo = require('../Model/userModel/additionalInfo');

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
}).then(() => {
  console.log('MongoDB connected');
  createSuperAdmin();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

async function createSuperAdmin() {
  try {
    const existing = await User.findOne({ role: 'superadmin' });
    if (existing) {
      console.log('❌ Superadmin already exists');
      return process.exit();
    }

    const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10);

    const superAdminUser = new User({
      phone: process.env.SUPERADMIN_PHONE,
      password: hashedPassword,
      role: 'superadmin',
    });
    await superAdminUser.save();

    const additionalInfo = new UserAdditionalInfo({
      name: "Super Admin",
      email: process.env.SUPERADMIN_EMAIL,
      userId: superAdminUser._id,
    });
    await additionalInfo.save();

    superAdminUser.additionalInfo = additionalInfo._id;
    await superAdminUser.save();

    console.log('✅ Superadmin created successfully');
    process.exit();
  } catch (err) {
    console.error('❌ Error creating superadmin:', err.message);
    process.exit(1);
  }
}
