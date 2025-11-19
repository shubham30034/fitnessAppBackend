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

// Fix students with expired/inactive subscriptions in new sessions
const fixStudentSessionsInNewSessions = async () => {
  try {
    console.log('🔧 Fixing students with expired/inactive subscriptions in new sessions...');
    
    // Get all sessions
    const allSessions = await Session.find();
    console.log(`📊 Total sessions: ${allSessions.length}`);
    
    let sessionsFixed = 0;
    let studentsRemoved = 0;
    
    for (const session of allSessions) {
      let sessionModified = false;
      const validUsers = [];
      
      for (const userId of session.users) {
        // Check if user has active subscription
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const activeSubscription = await UserSubscription.findOne({
          client: userId,
          startDate: { $lte: today },
          endDate: { $gte: today },
          isActive: true,
        });
        
        if (activeSubscription) {
          validUsers.push(userId);
        } else {
          studentsRemoved++;
          sessionModified = true;
          console.log(`  ❌ Removed student ${userId} from session ${session._id} (no active subscription)`);
        }
      }
      
      if (sessionModified) {
        if (validUsers.length === 0) {
          // No valid users left, delete the session
          await Session.findByIdAndDelete(session._id);
          console.log(`  🗑️ Deleted session ${session._id} (no valid users)`);
        } else {
          // Update session with only valid users
          session.users = validUsers;
          await session.save();
          console.log(`  ✅ Updated session ${session._id} with ${validUsers.length} valid users`);
        }
        sessionsFixed++;
      }
    }
    
    console.log(`\n📊 Fix Summary:`);
    console.log(`  Sessions fixed: ${sessionsFixed}`);
    console.log(`  Students removed: ${studentsRemoved}`);
    
    // Verify the fix
    console.log(`\n🔍 Verifying the fix...`);
    
    const finalSessions = await Session.find();
    console.log(`📊 Final session count: ${finalSessions.length}`);
    
    let violationsFound = 0;
    
    for (const session of finalSessions) {
      for (const userId of session.users) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const activeSubscription = await UserSubscription.findOne({
          client: userId,
          startDate: { $lte: today },
          endDate: { $gte: today },
          isActive: true,
        });
        
        if (!activeSubscription) {
          violationsFound++;
          console.log(`  ❌ VIOLATION: Student ${userId} in session ${session._id} has no active subscription`);
        }
      }
    }
    
    if (violationsFound === 0) {
      console.log(`  ✅ PERFECT: No violations found!`);
    } else {
      console.log(`  ❌ ${violationsFound} violations still exist`);
    }
    
    // Check specific students that were problematic
    console.log(`\n🔍 Checking specific students...`);
    
    const problematicStudents = ['8279898128', '8279898129'];
    
    for (const phone of problematicStudents) {
      const student = await User.findOne({ phone });
      if (student) {
        const studentSessions = await Session.find({ users: student._id });
        console.log(`  Student ${phone}: ${studentSessions.length} sessions`);
        
        if (studentSessions.length === 0) {
          console.log(`    ✅ CORRECT: No sessions for student without active subscription`);
        } else {
          console.log(`    ❌ ERROR: Student still has ${studentSessions.length} sessions`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing student sessions:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixStudentSessionsInNewSessions();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
