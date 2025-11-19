const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const CoachProfile = require('./src/Model/paidSessionModel/coach');
const CoachSchedule = require('./src/Model/paidSessionModel/coachSchedule');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const Session = require('./src/Model/paidSessionModel/session');

// Import the session generation function
const { generateZoomSessions } = require('./src/Controller/CoachingSession/coach');

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

// Create coach schedules if they don't exist
const createCoachSchedules = async () => {
  try {
    console.log('📅 Creating coach schedules...');
    
    const coaches = await CoachProfile.find({ isActive: true });
    console.log(`Found ${coaches.length} active coaches`);
    
    for (const coach of coaches) {
      const existingSchedule = await CoachSchedule.findOne({ coach: coach._id });
      
      if (!existingSchedule) {
        const schedule = new CoachSchedule({
          coach: coach._id,
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          startTime: '09:00',
          endTime: '18:00',
          timezone: 'Asia/Kolkata',
          isActive: true
        });
        
        await schedule.save();
        console.log(`✅ Created schedule for coach: ${coach._id}`);
      } else {
        console.log(`📅 Schedule already exists for coach: ${coach._id}`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating coach schedules:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    
    // Step 1: Create coach schedules
    await createCoachSchedules();
    
    // Step 2: Trigger session generation
    console.log('🚀 Triggering session generation...');
    await generateZoomSessions();
    
    // Step 3: Check results
    const sessions = await Session.find().populate('coach', 'user').populate('users', 'name');
    console.log(`\n📊 Total sessions created: ${sessions.length}`);
    
    sessions.forEach((session, index) => {
      console.log(`\nSession ${index + 1}:`);
      console.log(`  Date: ${session.date.toDateString()}`);
      console.log(`  Time: ${session.startTime} - ${session.endTime}`);
      console.log(`  Coach: ${session.coach?.user || 'Unknown'}`);
      console.log(`  Users: ${session.users.length}`);
      console.log(`  Fee: ${session.monthlyFee} ${session.currency}`);
      console.log(`  Status: ${session.status}`);
    });
    
    console.log('\n✅ Session generation completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
