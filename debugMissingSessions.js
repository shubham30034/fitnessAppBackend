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

// Debug why coach 8798675686 has no sessions
const debugMissingSessions = async () => {
  try {
    console.log('🔍 Debugging missing sessions for coach 8798675686...');
    
    const coachId = '684cfd7e87dd540f3ad69c2a'; // Coach 8798675686
    
    // Get coach details
    const coach = await User.findById(coachId);
    console.log(`\n👤 Coach Details:`);
    console.log(`  Phone: ${coach.phone}`);
    console.log(`  Role: ${coach.role}`);
    console.log(`  ID: ${coach._id}`);
    
    // Get coach profile
    const profile = await CoachProfile.findOne({ user: coachId });
    console.log(`\n📋 Coach Profile:`);
    console.log(`  Monthly Fee: ${profile?.monthlyFee} ${profile?.currency}`);
    console.log(`  Specialization: ${profile?.specialization?.join(', ')}`);
    console.log(`  Is Active: ${profile?.isActive}`);
    
    // Get coach schedule
    const schedule = await CoachSchedule.findOne({ coach: coachId });
    console.log(`\n📅 Coach Schedule:`);
    console.log(`  Days: ${schedule?.days?.join(', ')}`);
    console.log(`  Start Time: ${schedule?.startTime}`);
    console.log(`  End Time: ${schedule?.endTime}`);
    console.log(`  Is Active: ${schedule?.isActive}`);
    
    // Get active subscriptions
    const subscriptions = await UserSubscription.find({ 
      coach: coachId, 
      isActive: true 
    }).populate('client', 'phone additionalInfo');
    
    console.log(`\n💳 Active Subscriptions: ${subscriptions.length}`);
    subscriptions.forEach((sub, index) => {
      console.log(`  Subscription ${index + 1}:`);
      console.log(`    Client: ${sub.client?.phone} (${sub.client?.additionalInfo?.name || 'No name'})`);
      console.log(`    Start Date: ${new Date(sub.startDate).toDateString()}`);
      console.log(`    End Date: ${new Date(sub.endDate).toDateString()}`);
      console.log(`    Monthly Fee: ${sub.monthlyFee} ${sub.currency}`);
      console.log(`    Payment Status: ${sub.paymentStatus}`);
    });
    
    // Check existing sessions
    const existingSessions = await Session.find({ coach: coachId });
    console.log(`\n🎯 Existing Sessions: ${existingSessions.length}`);
    existingSessions.forEach((session, index) => {
      console.log(`  Session ${index + 1}:`);
      console.log(`    Date: ${new Date(session.date).toDateString()}`);
      console.log(`    Time: ${session.startTime} - ${session.endTime}`);
      console.log(`    Status: ${session.status}`);
      console.log(`    Users: ${session.users.length}`);
    });
    
    // Simulate session generation logic
    console.log(`\n🔧 Simulating session generation logic...`);
    
    const today = new Date();
    console.log(`  Today: ${today.toDateString()}`);
    
    // Check if coach should have sessions for the next 7 days
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      targetDate.setHours(0, 0, 0, 0);
      const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });
      
      console.log(`\n  📅 Checking ${targetDate.toDateString()} (${dayName}):`);
      
      // Check if coach is available on this day
      const isAvailable = schedule?.days?.includes(dayName);
      console.log(`    Coach available: ${isAvailable}`);
      
      if (!isAvailable) {
        console.log(`    ❌ Coach not available on ${dayName}`);
        continue;
      }
      
      // Check if subscription is active on this date
      const activeSubscriptionsOnDate = subscriptions.filter(sub => {
        const startDate = new Date(sub.startDate);
        const endDate = new Date(sub.endDate);
        return startDate <= targetDate && endDate >= targetDate;
      });
      
      console.log(`    Active subscriptions on this date: ${activeSubscriptionsOnDate.length}`);
      
      if (activeSubscriptionsOnDate.length === 0) {
        console.log(`    ❌ No active subscriptions on this date`);
        continue;
      }
      
      // Check if session already exists
      const existingSession = await Session.findOne({ 
        coach: coachId, 
        date: targetDate 
      });
      
      console.log(`    Existing session: ${existingSession ? 'Yes' : 'No'}`);
      
      if (existingSession) {
        console.log(`    ✅ Session already exists`);
        continue;
      }
      
      // This coach should have a session on this date
      console.log(`    🎯 SHOULD CREATE SESSION ON THIS DATE!`);
      
      // Get client IDs for this date
      const clientIds = activeSubscriptionsOnDate.map(sub => sub.client._id.toString());
      console.log(`    Client IDs: ${clientIds.join(', ')}`);
      
      // Create the missing session
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
      console.log(`    ✅ Created missing session for ${targetDate.toDateString()}`);
    }
    
    // Check final session count
    const finalSessions = await Session.find({ coach: coachId });
    console.log(`\n🎉 Final session count: ${finalSessions.length}`);
    
  } catch (error) {
    console.error('❌ Error debugging missing sessions:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await debugMissingSessions();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
