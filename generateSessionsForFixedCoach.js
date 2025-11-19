const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
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

// Generate sessions for the fixed coach
const generateSessionsForFixedCoach = async () => {
  try {
    console.log('🎯 Generating sessions for the fixed coach...');
    
    const coachId = '684cfd7e87dd540f3ad69c2a'; // Coach 8798675686
    
    // Get coach details
    const coach = await User.findById(coachId);
    const profile = await CoachProfile.findOne({ user: coachId });
    const schedule = await CoachSchedule.findOne({ coach: coachId });
    const subscriptions = await UserSubscription.find({ 
      coach: coachId, 
      isActive: true 
    });
    
    console.log(`\n👤 Coach: ${coach.phone}`);
    console.log(`📋 Profile: ${profile?.monthlyFee} ${profile?.currency}`);
    console.log(`📅 Schedule: ${schedule?.days?.join(', ')} (${schedule?.startTime}-${schedule?.endTime})`);
    console.log(`💳 Active Subscriptions: ${subscriptions.length}`);
    
    if (subscriptions.length === 0) {
      console.log('❌ No active subscriptions found');
      return;
    }
    
    // Create sessions for the next 7 days
    const today = new Date();
    let createdCount = 0;
    
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      targetDate.setHours(0, 0, 0, 0);
      const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });
      
      console.log(`\n📅 Checking ${targetDate.toDateString()} (${dayName}):`);
      
      // Check if coach is available on this day
      const isAvailable = schedule?.days?.includes(dayName);
      console.log(`  Coach available: ${isAvailable}`);
      
      if (!isAvailable) {
        console.log(`  ❌ Coach not available on ${dayName}`);
        continue;
      }
      
      // Check if subscription is active on this date
      const activeSubscriptionsOnDate = subscriptions.filter(sub => {
        const startDate = new Date(sub.startDate);
        const endDate = new Date(sub.endDate);
        return startDate <= targetDate && endDate >= targetDate;
      });
      
      console.log(`  Active subscriptions on this date: ${activeSubscriptionsOnDate.length}`);
      
      if (activeSubscriptionsOnDate.length === 0) {
        console.log(`  ❌ No active subscriptions on this date`);
        continue;
      }
      
      // Check if session already exists
      const existingSession = await Session.findOne({ 
        coach: coachId, 
        date: targetDate 
      });
      
      console.log(`  Existing session: ${existingSession ? 'Yes' : 'No'}`);
      
      if (existingSession) {
        console.log(`  ✅ Session already exists`);
        continue;
      }
      
      // Create the session
      const clientIds = activeSubscriptionsOnDate.map(sub => sub.client.toString());
      
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
        monthlyFee: profile.monthlyFee || 1000,
        currency: profile.currency || 'INR'
      });
      
      await newSession.save();
      createdCount++;
      console.log(`  ✅ Created session for ${targetDate.toDateString()} at ${schedule.startTime}-${schedule.endTime}`);
    }
    
    console.log(`\n🎉 Successfully created ${createdCount} sessions for coach ${coach.phone}!`);
    
    // Verify the sessions
    const totalSessions = await Session.find({ coach: coachId });
    console.log(`📊 Total sessions for this coach: ${totalSessions.length}`);
    
    totalSessions.forEach((session, index) => {
      console.log(`  Session ${index + 1}: ${new Date(session.date).toDateString()} at ${session.startTime}-${session.endTime} (${session.status})`);
    });
    
  } catch (error) {
    console.error('❌ Error generating sessions:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await generateSessionsForFixedCoach();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
