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

// Fix coach profiles and create sessions
const fixCoachProfilesAndCreateSessions = async () => {
  try {
    console.log('🧹 Cleaning up old sessions...');
    
    // Delete all existing sessions
    const deleteResult = await Session.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} old sessions`);
    
    // Get active subscriptions
    const subscriptions = await UserSubscription.find({ isActive: true });
    console.log(`📋 Found ${subscriptions.length} active subscriptions`);
    
    // Create coach profiles for the coaches in subscriptions
    const coachIds = [...new Set(subscriptions.map(sub => sub.coach.toString()))];
    console.log(`🏋️ Coach IDs from subscriptions: ${coachIds.join(', ')}`);
    
    for (const coachId of coachIds) {
      let coachProfile = await CoachProfile.findOne({ user: coachId });
      
      if (!coachProfile) {
        // Create coach profile for this coach
        coachProfile = new CoachProfile({
          user: coachId,
          monthlyFee: 5000 + (Math.random() * 3000), // Random fee between 5000-8000
          currency: 'INR',
          specialization: ['fitness', 'strength'],
          experience: Math.floor(Math.random() * 5) + 1,
          bio: `Professional fitness coach with experience`,
          isActive: true
        });
        
        await coachProfile.save();
        console.log(`✅ Created coach profile for coach: ${coachId} with fee: ${coachProfile.monthlyFee}`);
      } else {
        console.log(`📋 Coach profile already exists for coach: ${coachId} with fee: ${coachProfile.monthlyFee}`);
      }
    }
    
    // Now create sessions for the next 7 days
    console.log('🎯 Creating sessions for the next 7 days...');
    const today = new Date();
    let createdCount = 0;
    
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      targetDate.setHours(0, 0, 0, 0);
      const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });
      
      console.log(`\n📅 Creating sessions for ${targetDate.toDateString()} (${dayName})`);
      
      // Get active subscriptions for this date
      const activeSubscriptions = await UserSubscription.find({
        isActive: true,
        startDate: { $lte: targetDate },
        endDate: { $gte: targetDate }
      });
      
      const processedCoaches = new Set();
      
      for (const sub of activeSubscriptions) {
        const coachId = sub.coach.toString();
        if (processedCoaches.has(coachId)) continue;
        processedCoaches.add(coachId);
        
        // Get coach schedule
        const schedule = await CoachSchedule.findOne({ coach: sub.coach });
        if (!schedule || !schedule.days.includes(dayName)) {
          console.log(`⚠️ No schedule for coach ${coachId} on ${dayName}`);
          continue;
        }
        
        // Get coach profile for fee
        const coachProfile = await CoachProfile.findOne({ user: sub.coach });
        if (!coachProfile) {
          console.log(`⚠️ No coach profile for coach ${coachId}`);
          continue;
        }
        
        // Get all clients for this coach on this date
        const clients = await UserSubscription.find({
          coach: sub.coach,
          isActive: true,
          startDate: { $lte: targetDate },
          endDate: { $gte: targetDate }
        }).select("client");
        
        const clientIds = clients.map(c => c.client.toString());
        
        if (clientIds.length === 0) {
          console.log(`⚠️ No clients for coach ${coachId} on ${targetDate.toDateString()}`);
          continue;
        }
        
        // Create session with varied times
        const timeSlots = ['09:00', '10:00', '11:00', '14:00', '16:00', '17:00', '18:00'];
        const timeSlot = timeSlots[i % timeSlots.length];
        const endTime = `${parseInt(timeSlot.split(':')[0]) + 1}:00`;
        
        const session = new Session({
          users: clientIds,
          coach: sub.coach,
          date: targetDate,
          startTime: timeSlot,
          endTime: endTime,
          zoomJoinUrl: `https://zoom.us/j/test-${coachId}-${Date.now()}`,
          zoomMeetingId: `test-${coachId}-${Date.now()}`,
          status: i === 0 ? 'completed' : (i === 1 ? 'ongoing' : 'scheduled'),
          sessionType: 'individual',
          duration: 60,
          monthlyFee: coachProfile.monthlyFee || 5000,
          currency: coachProfile.currency || 'INR'
        });
        
        await session.save();
        createdCount++;
        
        console.log(`✅ Created session for coach ${coachId} on ${targetDate.toDateString()} at ${timeSlot} with fee ${coachProfile.monthlyFee} ${coachProfile.currency}`);
      }
    }
    
    console.log(`\n🎉 Successfully created ${createdCount} sessions!`);
    
    // Display summary
    const allSessions = await Session.find()
      .populate('coach', 'user')
      .populate('users', 'name')
      .sort({ date: 1, startTime: 1 });
    
    console.log('\n📊 Session Summary:');
    allSessions.forEach((session, index) => {
      console.log(`\nSession ${index + 1}:`);
      console.log(`  Date: ${session.date.toDateString()}`);
      console.log(`  Time: ${session.startTime} - ${session.endTime}`);
      console.log(`  Coach: ${session.coach?.user || 'Unknown'}`);
      console.log(`  Users: ${session.users.length}`);
      console.log(`  Fee: ${session.monthlyFee} ${session.currency}`);
      console.log(`  Status: ${session.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixCoachProfilesAndCreateSessions();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
