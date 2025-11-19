const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Session = require('./src/Model/paidSessionModel/session');
const CoachProfile = require('./src/Model/paidSessionModel/coach');
const CoachSchedule = require('./src/Model/paidSessionModel/coachSchedule');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const User = require('./src/Model/userModel/userModel');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Debug database contents
const debugDatabase = async () => {
  try {
    console.log('🔍 Debugging database contents...\n');
    
    // Check users
    const users = await User.find({});
    console.log(`👥 Users (${users.length}):`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name} (${user.email}) - Role: ${user.role} - ID: ${user._id}`);
    });
    
    // Check coach profiles
    const coachProfiles = await CoachProfile.find({});
    console.log(`\n🏋️ Coach Profiles (${coachProfiles.length}):`);
    coachProfiles.forEach((profile, index) => {
      console.log(`  ${index + 1}. User ID: ${profile.user} - Fee: ${profile.monthlyFee} ${profile.currency} - Active: ${profile.isActive}`);
    });
    
    // Check coach schedules
    const schedules = await CoachSchedule.find({});
    console.log(`\n📅 Coach Schedules (${schedules.length}):`);
    schedules.forEach((schedule, index) => {
      console.log(`  ${index + 1}. Coach ID: ${schedule.coach} - Days: ${schedule.days.join(', ')} - Time: ${schedule.startTime}-${schedule.endTime}`);
    });
    
    // Check subscriptions
    const subscriptions = await UserSubscription.find({});
    console.log(`\n💳 Subscriptions (${subscriptions.length}):`);
    subscriptions.forEach((sub, index) => {
      console.log(`  ${index + 1}. Client: ${sub.client} - Coach: ${sub.coach} - Active: ${sub.isActive} - Fee: ${sub.monthlyFee} ${sub.currency}`);
    });
    
    // Check sessions
    const sessions = await Session.find({});
    console.log(`\n🎯 Sessions (${sessions.length}):`);
    sessions.forEach((session, index) => {
      console.log(`  ${index + 1}. Date: ${session.date.toDateString()} - Time: ${session.startTime}-${session.endTime} - Coach: ${session.coach} - Fee: ${session.monthlyFee} ${session.currency}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await debugDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
