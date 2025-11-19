const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const CoachProfile = require('./src/Model/paidSessionModel/coach');
const CoachSchedule = require('./src/Model/paidSessionModel/coachSchedule');

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

// Check coach schedules status
const checkCoachSchedulesStatus = async () => {
  try {
    console.log('🔍 Checking coach schedules status...');
    
    const coaches = await User.find({ role: 'coach' });
    console.log(`📊 Total coaches: ${coaches.length}`);
    
    let coachesWithProfiles = 0;
    let coachesWithSchedules = 0;
    let coachesMissingSchedules = [];
    
    for (const coach of coaches) {
      const profile = await CoachProfile.findOne({ user: coach._id });
      const schedule = await CoachSchedule.findOne({ coach: coach._id });
      
      if (profile) coachesWithProfiles++;
      if (schedule) {
        coachesWithSchedules++;
        console.log(`  ✅ Coach ${coach.phone}: Has schedule (${schedule.days.join(', ')})`);
      } else {
        coachesMissingSchedules.push({
          id: coach._id,
          phone: coach.phone,
          name: profile?.name || 'Unknown'
        });
        console.log(`  ❌ Coach ${coach.phone}: Missing schedule`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Coaches with profiles: ${coachesWithProfiles}`);
    console.log(`  Coaches with schedules: ${coachesWithSchedules}`);
    console.log(`  Coaches missing schedules: ${coachesMissingSchedules.length}`);
    
    if (coachesMissingSchedules.length > 0) {
      console.log(`\n❌ Coaches missing schedules:`);
      coachesMissingSchedules.forEach(coach => {
        console.log(`  - ${coach.name} (${coach.phone})`);
      });
      console.log(`\n🔧 "Fix Coach Schedule" button is NECESSARY`);
    } else {
      console.log(`\n✅ All coaches have schedules!`);
      console.log(`\n🎉 "Fix Coach Schedule" button is NOT NECESSARY anymore`);
    }
    
    // Check if all coaches have proper schedules
    if (coachesWithSchedules === coaches.length && coaches.length > 0) {
      console.log(`\n🎯 RECOMMENDATION: Remove the "Fix Coach Schedule" button`);
      console.log(`   All coaches already have schedules configured.`);
    } else {
      console.log(`\n🎯 RECOMMENDATION: Keep the "Fix Coach Schedule" button`);
      console.log(`   Some coaches are missing schedules.`);
    }
    
  } catch (error) {
    console.error('❌ Error checking coach schedules:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await checkCoachSchedulesStatus();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
