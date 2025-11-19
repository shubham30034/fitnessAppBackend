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

// Fix sessions for students with expired subscriptions
const fixExpiredStudentSessions = async () => {
  try {
    console.log('🔧 Fixing sessions for students with expired subscriptions...');
    
    // Find students with expired subscriptions
    const expiredSubscriptions = await UserSubscription.find({
      isActive: false,
      expiredAt: { $exists: true }
    }).populate('client', 'phone');
    
    console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);
    
    for (const subscription of expiredSubscriptions) {
      console.log(`\n👤 Processing student: ${subscription.client.phone}`);
      console.log(`  Subscription expired: ${new Date(subscription.expiredAt).toDateString()}`);
      console.log(`  Expiration reason: ${subscription.expirationReason}`);
      
      // Find all sessions for this student
      const studentSessions = await Session.find({ 
        users: subscription.client._id 
      });
      
      console.log(`  Found ${studentSessions.length} sessions for expired subscription`);
      
      if (studentSessions.length > 0) {
        // Remove the student from all sessions
        console.log(`  🗑️ Removing student from ${studentSessions.length} sessions...`);
        
        for (const session of studentSessions) {
          // Remove the student from the session
          session.users = session.users.filter(userId => 
            userId.toString() !== subscription.client._id.toString()
          );
          
          // If no users left in the session, delete the session
          if (session.users.length === 0) {
            await Session.findByIdAndDelete(session._id);
            console.log(`    ✅ Deleted empty session: ${new Date(session.date).toDateString()}`);
          } else {
            await session.save();
            console.log(`    ✅ Removed student from session: ${new Date(session.date).toDateString()}`);
          }
        }
        
        console.log(`  ✅ Successfully processed ${studentSessions.length} sessions`);
      } else {
        console.log(`  ✅ No sessions to remove`);
      }
    }
    
    // Verify the fix
    console.log(`\n🔍 Verifying the fix...`);
    
    for (const subscription of expiredSubscriptions) {
      const remainingSessions = await Session.find({ 
        users: subscription.client._id 
      });
      
      console.log(`  Student ${subscription.client.phone}: ${remainingSessions.length} sessions remaining`);
      
      if (remainingSessions.length === 0) {
        console.log(`    ✅ CORRECT: No sessions for expired subscription`);
      } else {
        console.log(`    ❌ ERROR: Still has ${remainingSessions.length} sessions!`);
      }
    }
    
    // Test the business logic
    console.log(`\n🎯 Testing business logic...`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check students with expired subscriptions
    const studentsWithExpiredSubs = await UserSubscription.find({
      isActive: false,
      expiredAt: { $exists: true }
    }).populate('client', 'phone');
    
    for (const subscription of studentsWithExpiredSubs) {
      // Simulate getTodaysSession API call
      const activeSubscription = await UserSubscription.findOne({
        client: subscription.client._id,
        startDate: { $lte: today },
        endDate: { $gte: today },
        isActive: true,
      });
      
      if (!activeSubscription) {
        console.log(`  ✅ Student ${subscription.client.phone}: No active subscription → No class link access`);
      } else {
        console.log(`  ❌ Student ${subscription.client.phone}: Has active subscription (unexpected)`);
      }
      
      // Simulate getUserUpcomingSessions API call
      const upcomingSessions = await Session.find({ 
        users: subscription.client._id, 
        date: { $gte: today } 
      });
      
      if (upcomingSessions.length === 0) {
        console.log(`  ✅ Student ${subscription.client.phone}: No upcoming sessions → No class links`);
      } else {
        console.log(`  ❌ Student ${subscription.client.phone}: Has ${upcomingSessions.length} upcoming sessions (violates business logic)`);
      }
    }
    
    console.log(`\n🎉 Business logic verification complete!`);
    
  } catch (error) {
    console.error('❌ Error fixing expired student sessions:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixExpiredStudentSessions();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
