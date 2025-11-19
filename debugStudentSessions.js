const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
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

// Debug student sessions
const debugStudentSessions = async () => {
  try {
    console.log('🔍 Debugging student sessions...');
    
    const problematicStudents = ['8279898128', '8279898129'];
    
    for (const phone of problematicStudents) {
      console.log(`\n👤 Checking student: ${phone}`);
      
      const student = await User.findOne({ phone });
      if (!student) {
        console.log(`  ❌ Student not found`);
        continue;
      }
      
      console.log(`  📱 Student ID: ${student._id}`);
      
      // Check subscriptions
      const subscriptions = await UserSubscription.find({ client: student._id });
      console.log(`  💳 Total subscriptions: ${subscriptions.length}`);
      
      for (const sub of subscriptions) {
        console.log(`    - Subscription ${sub._id}:`);
        console.log(`      Active: ${sub.isActive}`);
        console.log(`      Start: ${new Date(sub.startDate).toDateString()}`);
        console.log(`      End: ${new Date(sub.endDate).toDateString()}`);
        console.log(`      Expired: ${sub.expiredAt ? new Date(sub.expiredAt).toDateString() : 'No'}`);
        console.log(`      Reason: ${sub.expirationReason || 'N/A'}`);
      }
      
      // Check sessions
      const sessions = await Session.find({ users: student._id });
      console.log(`  🎯 Sessions found: ${sessions.length}`);
      
      for (const session of sessions) {
        console.log(`    - Session ${session._id}:`);
        console.log(`      Date: ${new Date(session.date).toDateString()}`);
        console.log(`      Time: ${session.startTime}-${session.endTime}`);
        console.log(`      Status: ${session.status}`);
        console.log(`      Coach: ${session.coach}`);
        console.log(`      Users: ${session.users.length} (${session.users.map(u => u.toString()).join(', ')})`);
      }
      
      // Check if student has active subscription
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeSubscription = await UserSubscription.findOne({
        client: student._id,
        startDate: { $lte: today },
        endDate: { $gte: today },
        isActive: true,
      });
      
      console.log(`  ✅ Active subscription: ${activeSubscription ? 'Yes' : 'No'}`);
      
      if (activeSubscription) {
        console.log(`    Active subscription ID: ${activeSubscription._id}`);
      }
      
      // Business logic check
      if (activeSubscription && sessions.length > 0) {
        console.log(`  ✅ CORRECT: Student has active subscription and sessions`);
      } else if (!activeSubscription && sessions.length === 0) {
        console.log(`  ✅ CORRECT: Student has no active subscription and no sessions`);
      } else if (!activeSubscription && sessions.length > 0) {
        console.log(`  ❌ VIOLATION: Student has no active subscription but ${sessions.length} sessions`);
      } else if (activeSubscription && sessions.length === 0) {
        console.log(`  ⚠️ WARNING: Student has active subscription but no sessions`);
      }
    }
    
    // Check all sessions
    console.log(`\n🔍 Checking all sessions...`);
    
    const allSessions = await Session.find();
    console.log(`📊 Total sessions: ${allSessions.length}`);
    
    for (const session of allSessions) {
      console.log(`\n📅 Session ${session._id}:`);
      console.log(`  Date: ${new Date(session.date).toDateString()}`);
      console.log(`  Time: ${session.startTime}-${session.endTime}`);
      console.log(`  Coach: ${session.coach}`);
      console.log(`  Users: ${session.users.length}`);
      
      for (const userId of session.users) {
        const user = await User.findById(userId);
        console.log(`    - User: ${user ? user.phone : 'Unknown'} (${userId})`);
        
        // Check if user has active subscription
        const activeSub = await UserSubscription.findOne({
          client: userId,
          isActive: true,
          endDate: { $gte: new Date() }
        });
        
        console.log(`      Active subscription: ${activeSub ? 'Yes' : 'No'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging student sessions:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await debugStudentSessions();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
