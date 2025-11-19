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

// Create sessions with only students who have active subscriptions
const createSessionsWithActiveStudents = async () => {
  try {
    console.log('🔧 Creating sessions with only students who have active subscriptions...');
    
    // Get all active subscriptions
    const activeSubscriptions = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: new Date() }
    }).populate('client', 'phone').populate('coach', 'phone');
    
    console.log(`📊 Found ${activeSubscriptions.length} active subscriptions`);
    
    if (activeSubscriptions.length === 0) {
      console.log('❌ No active subscriptions found - no sessions to create');
      return;
    }
    
    // Group subscriptions by coach
    const subscriptionsByCoach = {};
    for (const sub of activeSubscriptions) {
      const coachId = sub.coach._id.toString();
      if (!subscriptionsByCoach[coachId]) {
        subscriptionsByCoach[coachId] = [];
      }
      subscriptionsByCoach[coachId].push(sub);
    }
    
    console.log(`📊 Coaches with active subscriptions: ${Object.keys(subscriptionsByCoach).length}`);
    
    let totalSessionsCreated = 0;
    
    for (const [coachId, subs] of Object.entries(subscriptionsByCoach)) {
      const coach = await User.findById(coachId);
      console.log(`\n👤 Processing coach: ${coach.phone}`);
      
      // Get coach profile
      const profile = await CoachProfile.findOne({ user: coachId });
      if (!profile) {
        console.log(`  ❌ No coach profile found`);
        continue;
      }
      
      // Get coach schedule
      const schedule = await CoachSchedule.findOne({ coach: coachId });
      if (!schedule) {
        console.log(`  ❌ No coach schedule found`);
        continue;
      }
      
      console.log(`  📋 Profile: Fee ${profile.monthlyFee} ${profile.currency}`);
      console.log(`  📅 Schedule: ${schedule.days.join(', ')} (${schedule.startTime}-${schedule.endTime})`);
      console.log(`  💳 Active subscriptions: ${subs.length}`);
      
      // Get client IDs (students with active subscriptions)
      const clientIds = subs.map(sub => sub.client._id.toString());
      console.log(`  👥 Students with active subscriptions: ${clientIds.length}`);
      
      // Create sessions for the next 7 days
      const today = new Date();
      let sessionsCreated = 0;
      
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        targetDate.setHours(0, 0, 0, 0);
        const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });
        
        // Check if coach is available on this day
        const isAvailable = schedule.days.includes(dayName);
        if (!isAvailable) continue;
        
        // Check if subscriptions are active on this date
        const activeSubsOnDate = subs.filter(sub => {
          const startDate = new Date(sub.startDate);
          const endDate = new Date(sub.endDate);
          return startDate <= targetDate && endDate >= targetDate;
        });
        
        if (activeSubsOnDate.length === 0) continue;
        
        // Get client IDs for this date
        const clientIdsForDate = activeSubsOnDate.map(sub => sub.client._id.toString());
        
        // Create the session
        const newSession = new Session({
          users: clientIdsForDate,
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
        sessionsCreated++;
        totalSessionsCreated++;
        console.log(`    ✅ Created session for ${targetDate.toDateString()} at ${schedule.startTime}-${schedule.endTime} with ${clientIdsForDate.length} students`);
      }
      
      console.log(`  🎉 Created ${sessionsCreated} sessions for coach ${coach.phone}`);
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total sessions created: ${totalSessionsCreated}`);
    
    // Verify the sessions
    const finalSessions = await Session.find();
    console.log(`  Final session count: ${finalSessions.length}`);
    
    // Check that all sessions only have students with active subscriptions
    let validSessions = 0;
    let invalidSessions = 0;
    
    for (const session of finalSessions) {
      let sessionValid = true;
      
      for (const userId of session.users) {
        const activeSubscription = await UserSubscription.findOne({
          client: userId,
          isActive: true,
          endDate: { $gte: new Date() }
        });
        
        if (!activeSubscription) {
          sessionValid = false;
          console.log(`  ❌ Session ${session._id} has student ${userId} without active subscription`);
        }
      }
      
      if (sessionValid) {
        validSessions++;
      } else {
        invalidSessions++;
      }
    }
    
    console.log(`\n🎯 Verification:`);
    console.log(`  Valid sessions: ${validSessions}`);
    console.log(`  Invalid sessions: ${invalidSessions}`);
    
    if (invalidSessions === 0) {
      console.log(`  ✅ PERFECT: All sessions only contain students with active subscriptions!`);
    } else {
      console.log(`  ❌ ${invalidSessions} sessions have students without active subscriptions`);
    }
    
  } catch (error) {
    console.error('❌ Error creating sessions with active students:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await createSessionsWithActiveStudents();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
