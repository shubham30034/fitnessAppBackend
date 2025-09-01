const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../Model/userModel/userModel');
const UserAdditionalInfo = require('../Model/userModel/additionalInfo');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

async function createCoachManager() {
  try {
    const existing = await User.findOne({ role: 'coachmanager' });
    if (existing) {
      console.log('❌ Coach Manager already exists');
      return process.exit();
    }

    const hashedPassword = await bcrypt.hash(process.env.COACHMANAGER_PASSWORD || 'coachmanager123', 10);

    const coachManagerUser = new User({
      phone: process.env.COACHMANAGER_PHONE || '9876543210',
      password: hashedPassword,
      role: 'coachmanager',
    });
    await coachManagerUser.save();

    const additionalInfo = new UserAdditionalInfo({
      name: "Coach Manager",
      email: process.env.COACHMANAGER_EMAIL || 'coachmanager@fitnessapp.com',
      userId: coachManagerUser._id,
    });
    await additionalInfo.save();

    coachManagerUser.additionalInfo = additionalInfo._id;
    await coachManagerUser.save();

    console.log('✅ Coach Manager created successfully');
    console.log('📱 Phone:', process.env.COACHMANAGER_PHONE || '9876543210');
    console.log('📧 Email:', process.env.COACHMANAGER_EMAIL || 'coachmanager@fitnessapp.com');
    console.log('🔑 Password:', process.env.COACHMANAGER_PASSWORD || 'coachmanager123');
    process.exit();
  } catch (err) {
    console.error('❌ Error creating coach manager:', err.message);
    process.exit(1);
  }
}

createCoachManager();
