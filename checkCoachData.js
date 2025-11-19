const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const UserAdditionalInfo = require('./src/Model/userModel/additionalInfo');
const CoachProfile = require('./src/Model/paidSessionModel/coach');
const CoachSchedule = require('./src/Model/paidSessionModel/coachSchedule');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const Session = require('./src/Model/paidSessionModel/session');

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

// Check coach data and session generation
const checkCoachData = async () => {
  try {
    console.log('🔍 Checking coach data and session generation...');
    
    // 1. Check total coaches
    const totalCoaches = await User.find({ role: 'coach' });
    console.log(`\n📊 Total coaches in database: ${totalCoaches.length}`);
    
    totalCoaches.forEach((coach, index) => {
      console.log(`  Coach ${index + 1}: ${coach.phone} (ID: ${coach._id})`);
    });
    
    // 2. Check coach profiles
    const coachProfiles = await CoachProfile.find();
    console.log(`\n📊 Total coach profiles: ${coachProfiles.length}`);
    
    coachProfiles.forEach((profile, index) => {
      console.log(`  Profile ${index + 1}: User ${profile.user} - Fee: ${profile.monthlyFee} ${profile.currency}`);
    });
    
    // 3. Check coach schedules
    const coachSchedules = await CoachSchedule.find();
    console.log(`\n📊 Total coach schedules: ${coachSchedules.length}`);
    
    coachSchedules.forEach((schedule, index) => {
      console.log(`  Schedule ${index + 1}: Coach ${schedule.coach} - Days: ${schedule.days.join(', ')} - Time: ${schedule.startTime}-${schedule.endTime}`);
    });
    
    // 4. Check active subscriptions
    const activeSubscriptions = await UserSubscription.find({ isActive: true });
    console.log(`\n📊 Total active subscriptions: ${activeSubscriptions.length}`);
    
    const subscriptionsByCoach = {};
    activeSubscriptions.forEach(sub => {
      const coachId = sub.coach.toString();
      if (!subscriptionsByCoach[coachId]) {
        subscriptionsByCoach[coachId] = 0;
      }
      subscriptionsByCoach[coachId]++;
    });
    
    console.log('  Subscriptions by coach:');
    Object.entries(subscriptionsByCoach).forEach(([coachId, count]) => {
      console.log(`    Coach ${coachId}: ${count} subscriptions`);
    });
    
    // 5. Check sessions
    const totalSessions = await Session.find();
    console.log(`\n📊 Total sessions: ${totalSessions.length}`);
    
    const sessionsByCoach = {};
    totalSessions.forEach(session => {
      const coachId = session.coach.toString();
      if (!sessionsByCoach[coachId]) {
        sessionsByCoach[coachId] = 0;
      }
      sessionsByCoach[coachId]++;
    });
    
    console.log('  Sessions by coach:');
    Object.entries(sessionsByCoach).forEach(([coachId, count]) => {
      console.log(`    Coach ${coachId}: ${count} sessions`);
    });
    
    // 6. Check which coaches have all prerequisites for session generation
    console.log(`\n🔍 Checking prerequisites for session generation:`);
    
    for (const coach of totalCoaches) {
      console.log(`\nCoach: ${coach.phone} (${coach._id})`);
      
      // Check if coach has profile
      const profile = await CoachProfile.findOne({ user: coach._id });
      console.log(`  ✅ Profile: ${profile ? 'Yes' : 'No'} ${profile ? `(Fee: ${profile.monthlyFee} ${profile.currency})` : ''}`);
      
      // Check if coach has schedule
      const schedule = await CoachSchedule.findOne({ coach: coach._id });
      console.log(`  ✅ Schedule: ${schedule ? 'Yes' : 'No'} ${schedule ? `(${schedule.days.join(', ')})` : ''}`);
      
      // Check if coach has active subscriptions
      const subscriptions = await UserSubscription.find({ 
        coach: coach._id, 
        isActive: true 
      });
      console.log(`  ✅ Active Subscriptions: ${subscriptions.length}`);
      
      // Check if coach has sessions
      const sessions = await Session.find({ coach: coach._id });
      console.log(`  ✅ Sessions: ${sessions.length}`);
      
      // Determine if coach should have sessions
      const shouldHaveSessions = profile && schedule && subscriptions.length > 0;
      console.log(`  🎯 Should have sessions: ${shouldHaveSessions ? 'Yes' : 'No'}`);
      
      if (!shouldHaveSessions) {
        console.log(`  ❌ Missing prerequisites:`);
        if (!profile) console.log(`    - No coach profile`);
        if (!schedule) console.log(`    - No coach schedule`);
        if (subscriptions.length === 0) console.log(`    - No active subscriptions`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking coach data:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await checkCoachData();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
