const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const Session = require('./src/Model/paidSessionModel/session');
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

// Check and generate missing sessions for coaches with active subscriptions
const checkAndGenerateMissingSessions = async () => {
  try {
    console.log('🔍 Checking coaches with active subscriptions but no sessions...');
    
    // Find coaches with active subscriptions
    const activeSubscriptions = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: new Date() }
    }).populate('coach', 'phone role');
    
    console.log(`📊 Found ${activeSubscriptions.length} active subscriptions`);
    
    const coachesWithActiveSubs = [...new Set(activeSubscriptions.map(sub => sub.coach._id.toString()))];
    console.log(`📊 Unique coaches with active subscriptions: ${coachesWithActiveSubs.length}`);
    
    for (const coachId of coachesWithActiveSubs) {
      const coach = await User.findById(coachId);
      console.log(`\n👤 Checking coach: ${coach.phone}`);
      
      // Get coach profile
      const profile = await CoachProfile.findOne({ user: coachId });
      console.log(`  📋 Profile: ${profile ? 'Yes' : 'No'} ${profile ? `(Fee: ${profile.monthlyFee} ${profile.currency})` : ''}`);
      
      // Get coach schedule
      const schedule = await CoachSchedule.findOne({ coach: coachId });
      console.log(`  📅 Schedule: ${schedule ? 'Yes' : 'No'} ${schedule ? `(${schedule.days.join(', ')})` : ''}`);
      
      // Get active subscriptions for this coach
      const coachActiveSubs = await UserSubscription.find({
        coach: coachId,
        isActive: true,
        endDate: { $gte: new Date() }
      });
      console.log(`  💳 Active subscriptions: ${coachActiveSubs.length}`);
      
      // Get existing sessions
      const existingSessions = await Session.find({ coach: coachId });
      console.log(`  🎯 Existing sessions: ${existingSessions.length}`);
      
      // Check if coach should have sessions
      const shouldHaveSessions = profile && schedule && coachActiveSubs.length > 0;
      console.log(`  🎯 Should have sessions: ${shouldHaveSessions ? 'Yes' : 'No'}`);
      
      if (shouldHaveSessions && existingSessions.length === 0) {
        console.log(`  🔧 Generating sessions for coach ${coach.phone}...`);
        
        // Generate sessions for the next 7 days
        const today = new Date();
        let createdCount = 0;
        
        for (let i = 0; i < 7; i++) {
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + i);
          targetDate.setHours(0, 0, 0, 0);
          const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });
          
          // Check if coach is available on this day
          const isAvailable = schedule.days.includes(dayName);
          if (!isAvailable) continue;
          
          // Check if subscription is active on this date
          const activeSubsOnDate = coachActiveSubs.filter(sub => {
            const startDate = new Date(sub.startDate);
            const endDate = new Date(sub.endDate);
            return startDate <= targetDate && endDate >= targetDate;
          });
          
          if (activeSubsOnDate.length === 0) continue;
          
          // Get client IDs for this date
          const clientIds = activeSubsOnDate.map(sub => sub.client.toString());
          
          // Create the session
          const newSession = new Session({
            users: clientIds,
            coach: coachId,
            date: targetDate,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            zoomJoinUrl: `https://zoom.us/j/test-${coachId}-${Date.now()}`,
            zoomMeetingId: `test-${coachId}-${Date.now()}`,
            status: i === 0 ? 'completed' : (i === 1 ? 'ongoing' : 'scheduled'),
            sessionType: 'individual',
            duration: 60,
            monthlyFee: profile.monthlyFee || 5000,
            currency: profile.currency || 'INR'
          });
          
          await newSession.save();
          createdCount++;
          console.log(`    ✅ Created session for ${targetDate.toDateString()} at ${schedule.startTime}-${schedule.endTime}`);
        }
        
        console.log(`  🎉 Generated ${createdCount} sessions for coach ${coach.phone}`);
      } else if (shouldHaveSessions && existingSessions.length > 0) {
        console.log(`  ✅ Coach already has ${existingSessions.length} sessions`);
      } else {
        console.log(`  ❌ Coach missing prerequisites for session generation`);
      }
    }
    
    // Final verification
    console.log(`\n🔍 Final verification...`);
    
    const finalActiveSubs = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: new Date() }
    });
    
    const finalSessions = await Session.find();
    
    console.log(`📊 Final counts:`);
    console.log(`  Active subscriptions: ${finalActiveSubs.length}`);
    console.log(`  Total sessions: ${finalSessions.length}`);
    
    // Check if all coaches with active subscriptions now have sessions
    const coachesWithSubs = [...new Set(finalActiveSubs.map(sub => sub.coach.toString()))];
    let coachesWithSessions = 0;
    
    for (const coachId of coachesWithSubs) {
      const coachSessions = await Session.find({ coach: coachId });
      if (coachSessions.length > 0) {
        coachesWithSessions++;
        console.log(`  ✅ Coach ${coachId}: ${coachSessions.length} sessions`);
      } else {
        console.log(`  ❌ Coach ${coachId}: No sessions`);
      }
    }
    
    console.log(`\n🎯 Summary:`);
    console.log(`  Coaches with active subscriptions: ${coachesWithSubs.length}`);
    console.log(`  Coaches with sessions: ${coachesWithSessions}`);
    
    if (coachesWithSubs.length === coachesWithSessions) {
      console.log(`  ✅ PERFECT: All coaches with active subscriptions have sessions!`);
    } else {
      console.log(`  ⚠️ ${coachesWithSubs.length - coachesWithSessions} coaches with active subscriptions don't have sessions`);
    }
    
  } catch (error) {
    console.error('❌ Error checking and generating missing sessions:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await checkAndGenerateMissingSessions();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
