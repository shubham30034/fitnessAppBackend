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

// Fix session times to use coach schedules
const fixSessionTimes = async () => {
  try {
    console.log('🔧 Fixing session times to use coach schedules...');
    
    // Delete all existing sessions
    const deleteResult = await Session.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} old sessions`);
    
    // Get active subscriptions
    const subscriptions = await UserSubscription.find({ isActive: true });
    console.log(`📋 Found ${subscriptions.length} active subscriptions`);
    
    // Create sessions for the next 7 days
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
        
        // Get coach schedule - THIS IS THE KEY FIX
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
        
        // FIXED: Use coach's actual schedule times instead of random times
        const session = new Session({
          users: clientIds,
          coach: sub.coach,
          date: targetDate,
          startTime: schedule.startTime, // Use coach's actual start time
          endTime: schedule.endTime,     // Use coach's actual end time
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
        
        console.log(`✅ Created session for coach ${coachId} on ${targetDate.toDateString()} at ${schedule.startTime}-${schedule.endTime} with fee ${coachProfile.monthlyFee} ${coachProfile.currency}`);
      }
    }
    
    console.log(`\n🎉 Successfully created ${createdCount} sessions with proper coach schedules!`);
    
    // Display summary
    const allSessions = await Session.find()
      .populate({
        path: 'coach',
        select: 'phone additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .populate('users', 'phone additionalInfo')
      .sort({ date: 1, startTime: 1 });
    
    console.log('\n📊 Session Summary:');
    allSessions.forEach((session, index) => {
      console.log(`\nSession ${index + 1}:`);
      console.log(`  Date: ${session.date.toDateString()}`);
      console.log(`  Time: ${session.startTime} - ${session.endTime}`);
      console.log(`  Coach: ${session.coach?.additionalInfo?.name || 'Unknown'}`);
      console.log(`  Users: ${session.users.length}`);
      console.log(`  Fee: ${session.monthlyFee} ${session.currency}`);
      console.log(`  Status: ${session.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing session times:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixSessionTimes();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
