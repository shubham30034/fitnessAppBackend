const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const UserAdditionalInfo = require('./src/Model/userModel/additionalInfo');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const CoachSchedule = require('./src/Model/paidSessionModel/coachSchedule');
const CoachProfile = require('./src/Model/paidSessionModel/coach');
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

// Create test data
const createTestData = async () => {
  try {
    console.log('🚀 Creating test data...');

    // 1. Create test users
    console.log('👥 Creating test users...');
    const testUsers = [];
    for (let i = 1; i <= 5; i++) {
      const user = new User({
        phone: `987654321${i}`,
        role: 'user'
      });
      await user.save();

      const additionalInfo = new UserAdditionalInfo({
        name: `Test User ${i}`,
        email: `user${i}@test.com`,
        userId: user._id
      });
      await additionalInfo.save();

      user.additionalInfo = additionalInfo._id;
      await user.save();

      testUsers.push(user);
      console.log(`✅ Created user: ${additionalInfo.name}`);
    }

    // 2. Create test coaches
    console.log('🏋️ Creating test coaches...');
    const testCoaches = [];
    for (let i = 1; i <= 3; i++) {
      const coach = new User({
        phone: `876543210${i}`,
        role: 'coach',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password
      });
      await coach.save();

      const additionalInfo = new UserAdditionalInfo({
        name: `Test Coach ${i}`,
        email: `coach${i}@test.com`,
        userId: coach._id
      });
      await additionalInfo.save();

      coach.additionalInfo = additionalInfo._id;
      await coach.save();

      // Create coach profile
      const coachProfile = new CoachProfile({
        user: coach._id,
        monthlyFee: 5000 + (i * 1000), // Different fees
        currency: 'INR',
        experience: i * 2,
        bio: `Experienced fitness coach with ${i * 2} years of experience`,
        specialization: ['fitness', 'strength']
      });
      await coachProfile.save();

      testCoaches.push(coach);
      console.log(`✅ Created coach: ${additionalInfo.name}`);
    }

    // 3. Create coach schedules
    console.log('📅 Creating coach schedules...');
    for (const coach of testCoaches) {
      const existingSchedule = await CoachSchedule.findOne({ coach: coach._id });
      if (!existingSchedule) {
        const schedule = new CoachSchedule({
          coach: coach._id,
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '09:00',
          endTime: '10:00',
          title: 'Fitness Coaching Session',
          description: 'Regular fitness coaching session',
          sessionType: 'individual',
          duration: 60,
          maxParticipants: 1,
          category: 'fitness',
          difficulty: 'beginner',
          timezone: 'Asia/Kolkata'
        });
        await schedule.save();
        console.log(`✅ Created schedule for coach: ${coach._id}`);
      }
    }

    // 4. Create test subscriptions
    console.log('💳 Creating test subscriptions...');
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const coach = testCoaches[i % testCoaches.length];
      
      const existingSubscription = await UserSubscription.findOne({
        client: user._id,
        coach: coach._id
      });
      
      if (!existingSubscription) {
        const subscription = new UserSubscription({
          client: user._id,
          coach: coach._id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          isActive: true,
          subscriptionType: 'monthly',
          monthlyFee: 5000,
          currency: 'INR',
          sessionsPerMonth: 4,
          sessionsUsed: 0,
          platform: 'web',
          paymentStatus: 'completed',
          receiptVerified: true
        });
        await subscription.save();
        console.log(`✅ Created subscription for user: ${user._id} with coach: ${coach._id}`);
      }
    }

    // 5. Create some test sessions with varied dates and times
    console.log('🎯 Creating test sessions...');
    const today = new Date();
    
    // Create sessions for different days with different times
    const sessionConfigs = [
      { dayOffset: 0, time: '09:00', endTime: '10:00', status: 'completed' },
      { dayOffset: 1, time: '10:00', endTime: '11:00', status: 'scheduled' },
      { dayOffset: 2, time: '11:00', endTime: '12:00', status: 'scheduled' },
      { dayOffset: 3, time: '14:00', endTime: '15:00', status: 'scheduled' },
      { dayOffset: 4, time: '16:00', endTime: '17:00', status: 'scheduled' }
    ];

    for (let i = 0; i < sessionConfigs.length; i++) {
      const config = sessionConfigs[i];
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() + config.dayOffset);
      sessionDate.setHours(parseInt(config.time.split(':')[0]), parseInt(config.time.split(':')[1]), 0, 0);

      const coach = testCoaches[i % testCoaches.length];
      const user = testUsers[i % testUsers.length];
      
      // Get coach profile for fee
      const coachProfile = await CoachProfile.findOne({ user: coach._id });

      const existingSession = await Session.findOne({
        coach: coach._id,
        date: sessionDate
      });

      if (!existingSession) {
        const session = new Session({
          users: [user._id],
          coach: coach._id,
          date: sessionDate,
          startTime: config.time,
          endTime: config.endTime,
          zoomJoinUrl: `https://zoom.us/j/test${i}`,
          zoomMeetingId: `test${i}`,
          status: config.status,
          sessionType: 'individual',
          duration: 60,
          monthlyFee: coachProfile?.monthlyFee || 5000,
          currency: coachProfile?.currency || 'INR'
        });
        await session.save();
        console.log(`✅ Created session for ${sessionDate.toDateString()} at ${config.time} with fee ${coachProfile?.monthlyFee || 5000}`);
      }
    }

    console.log('🎉 Test data creation completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${testUsers.length}`);
    console.log(`   - Coaches: ${testCoaches.length}`);
    console.log(`   - Schedules: ${testCoaches.length}`);
    console.log(`   - Subscriptions: ${testUsers.length}`);
    console.log(`   - Sessions: 3`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await createTestData();
  process.exit(0);
};

main();
