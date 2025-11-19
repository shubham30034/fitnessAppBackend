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

// Fix remaining student sessions
const fixRemainingStudentSessions = async () => {
  try {
    console.log('🔧 Fixing remaining student sessions...');
    
    // Find student 8279898129
    const student = await User.findOne({ phone: '8279898129' });
    
    if (!student) {
      console.log('❌ Student not found');
      return;
    }
    
    console.log(`👤 Found student: ${student.phone}`);
    
    // Check if student has active subscription
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeSubscription = await UserSubscription.findOne({
      client: student._id,
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true,
    });
    
    console.log(`📋 Active subscription: ${activeSubscription ? 'Yes' : 'No'}`);
    
    if (!activeSubscription) {
      // Student has no active subscription, remove from all sessions
      const studentSessions = await Session.find({ 
        users: student._id 
      });
      
      console.log(`Found ${studentSessions.length} sessions for student without active subscription`);
      
      if (studentSessions.length > 0) {
        console.log(`🗑️ Removing student from ${studentSessions.length} sessions...`);
        
        for (const session of studentSessions) {
          // Remove the student from the session
          session.users = session.users.filter(userId => 
            userId.toString() !== student._id.toString()
          );
          
          // If no users left in the session, delete the session
          if (session.users.length === 0) {
            await Session.findByIdAndDelete(session._id);
            console.log(`  ✅ Deleted empty session: ${new Date(session.date).toDateString()}`);
          } else {
            await session.save();
            console.log(`  ✅ Removed student from session: ${new Date(session.date).toDateString()}`);
          }
        }
        
        console.log(`✅ Successfully processed ${studentSessions.length} sessions`);
      }
    }
    
    // Verify the fix
    const remainingSessions = await Session.find({ 
      users: student._id 
    });
    
    console.log(`\n📊 Final status:`);
    console.log(`  Student: ${student.phone}`);
    console.log(`  Active subscription: ${activeSubscription ? 'Yes' : 'No'}`);
    console.log(`  Sessions remaining: ${remainingSessions.length}`);
    
    if (!activeSubscription && remainingSessions.length === 0) {
      console.log(`  ✅ CORRECT: No active subscription, no sessions`);
    } else if (activeSubscription && remainingSessions.length > 0) {
      console.log(`  ✅ CORRECT: Active subscription, sessions exist`);
    } else {
      console.log(`  ❌ INCONSISTENT: Check the data`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing remaining student sessions:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixRemainingStudentSessions();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
