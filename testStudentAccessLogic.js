const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const Session = require('./src/Model/paidSessionModel/session');
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

// Test student access logic
const testStudentAccessLogic = async () => {
  try {
    console.log('🔍 Testing student access logic...');
    
    // Get all students (users with role 'user')
    const students = await User.find({ role: 'user' });
    console.log(`\n📊 Found ${students.length} students in database`);
    
    for (const student of students) {
      console.log(`\n👤 Testing student: ${student.phone}`);
      
      // Test 1: Check if student has active subscription
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeSubscription = await UserSubscription.findOne({
        client: student._id,
        startDate: { $lte: today },
        endDate: { $gte: today },
        isActive: true,
      });
      
      console.log(`  📋 Active subscription: ${activeSubscription ? 'Yes' : 'No'}`);
      
      if (activeSubscription) {
        console.log(`    Start Date: ${new Date(activeSubscription.startDate).toDateString()}`);
        console.log(`    End Date: ${new Date(activeSubscription.endDate).toDateString()}`);
        console.log(`    Coach: ${activeSubscription.coach}`);
        console.log(`    Monthly Fee: ${activeSubscription.monthlyFee} ${activeSubscription.currency}`);
        
        // Test 2: Check if student can get today's session (getTodaysSession logic)
        const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
        console.log(`  📅 Today is: ${dayName}`);
        
        const schedule = await CoachSchedule.findOne({ coach: activeSubscription.coach });
        
        if (!schedule || !schedule.days.includes(dayName)) {
          console.log(`    ❌ No session today - coach not available on ${dayName}`);
        } else {
          console.log(`    ✅ Coach available on ${dayName} (${schedule.startTime}-${schedule.endTime})`);
          
          // Check if session exists for today
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);
          
          const todaysSession = await Session.findOne({
            coach: activeSubscription.coach,
            users: student._id,
            date: { $gte: startOfDay, $lte: endOfDay },
          });
          
          if (todaysSession) {
            console.log(`    ✅ Session found for today: ${todaysSession.startTime}-${todaysSession.endTime}`);
            console.log(`    🔗 Class link: ${todaysSession.zoomJoinUrl}`);
            console.log(`    📊 Status: ${todaysSession.status}`);
          } else {
            console.log(`    ❌ No session scheduled for today`);
          }
        }
        
        // Test 3: Check upcoming sessions (getUserUpcomingSessions logic)
        const upcomingSessions = await Session.find({ 
          users: student._id, 
          date: { $gte: today } 
        }).sort({ date: 1 }).limit(5);
        
        console.log(`  🔮 Upcoming sessions: ${upcomingSessions.length}`);
        upcomingSessions.forEach((session, index) => {
          console.log(`    ${index + 1}. ${new Date(session.date).toDateString()} at ${session.startTime}-${session.endTime} (${session.status})`);
          console.log(`       🔗 Link: ${session.zoomJoinUrl}`);
        });
        
      } else {
        console.log(`  ❌ No active subscription - student should NOT get class links`);
        
        // Test 4: Verify student cannot access sessions without subscription
        const upcomingSessions = await Session.find({ 
          users: student._id, 
          date: { $gte: today } 
        });
        
        if (upcomingSessions.length > 0) {
          console.log(`    ⚠️ WARNING: Student has ${upcomingSessions.length} sessions but no active subscription!`);
          console.log(`    This violates business logic - expired subscription should not have sessions`);
        } else {
          console.log(`    ✅ CORRECT: No sessions for student without active subscription`);
        }
      }
      
      console.log(`  🎯 Business Logic Check:`);
      if (activeSubscription) {
        console.log(`    ✅ Student has active subscription → Should get class links`);
      } else {
        console.log(`    ❌ Student has no active subscription → Should NOT get class links`);
      }
    }
    
    // Test 5: Check the specific student with expired subscription
    console.log(`\n🔍 Testing specific case: Student with expired subscription...`);
    
    const expiredSubscriptionStudent = await UserSubscription.findOne({
      isActive: false,
      expiredAt: { $exists: true }
    }).populate('client', 'phone');
    
    if (expiredSubscriptionStudent) {
      console.log(`  👤 Student: ${expiredSubscriptionStudent.client.phone}`);
      console.log(`  📋 Subscription Status: Expired (${expiredSubscriptionStudent.expirationReason})`);
      console.log(`  📅 Expired At: ${new Date(expiredSubscriptionStudent.expiredAt).toDateString()}`);
      
      // Check if this student has any sessions
      const studentSessions = await Session.find({ 
        users: expiredSubscriptionStudent.client._id 
      });
      
      console.log(`  🎯 Sessions for expired subscription: ${studentSessions.length}`);
      
      if (studentSessions.length === 0) {
        console.log(`    ✅ CORRECT: No sessions for expired subscription`);
      } else {
        console.log(`    ❌ ERROR: Student with expired subscription has ${studentSessions.length} sessions!`);
        console.log(`    This violates business logic`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing student access logic:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await testStudentAccessLogic();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
