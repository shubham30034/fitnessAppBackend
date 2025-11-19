const mongoose = require('mongoose');
require('dotenv').config();

// Import models
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

// Check and fix subscription status correctly
const checkAndFixSubscriptionStatus = async () => {
  try {
    console.log('🔍 Checking subscription status for coach 8798675686...');
    
    const coachId = '684cfd7e87dd540f3ad69c2a'; // Coach 8798675686
    
    // Find the subscription
    const subscription = await UserSubscription.findOne({
      coach: coachId,
      isActive: true
    });
    
    if (!subscription) {
      console.log('❌ No active subscription found');
      return;
    }
    
    console.log('📋 Current subscription:');
    console.log(`  Client: ${subscription.client}`);
    console.log(`  Start Date: ${new Date(subscription.startDate).toDateString()}`);
    console.log(`  End Date: ${new Date(subscription.endDate).toDateString()}`);
    console.log(`  Is Active: ${subscription.isActive}`);
    console.log(`  Payment Status: ${subscription.paymentStatus}`);
    
    // Check if this subscription should be expired based on original dates
    const originalEndDate = new Date('2025-07-26'); // Original end date
    const today = new Date();
    
    console.log(`\n📅 Date Analysis:`);
    console.log(`  Original End Date: ${originalEndDate.toDateString()}`);
    console.log(`  Current End Date: ${new Date(subscription.endDate).toDateString()}`);
    console.log(`  Today: ${today.toDateString()}`);
    console.log(`  Original subscription expired: ${originalEndDate < today ? 'Yes' : 'No'}`);
    
    // The correct business logic: if the original subscription expired, deactivate it
    if (originalEndDate < today) {
      console.log('\n🔧 Original subscription has expired - deactivating...');
      
      // Deactivate the subscription
      subscription.isActive = false;
      subscription.expiredAt = new Date();
      subscription.expirationReason = 'subscription_expired';
      await subscription.save();
      
      console.log('✅ Subscription deactivated');
      
      // Remove sessions for this expired subscription
      const sessionsToDelete = await Session.find({ coach: coachId });
      console.log(`\n🗑️ Removing ${sessionsToDelete.length} sessions for expired subscription...`);
      
      if (sessionsToDelete.length > 0) {
        await Session.deleteMany({ coach: coachId });
        console.log(`✅ Deleted ${sessionsToDelete.length} sessions`);
      }
      
      console.log('\n🎯 Correct Business Logic Applied:');
      console.log('✅ Expired subscription deactivated');
      console.log('✅ Sessions removed for expired subscription');
      console.log('✅ Coach will not get new sessions until subscription is renewed');
      
    } else {
      console.log('\n✅ Subscription is still valid - no action needed');
    }
    
    // Verify final status
    const finalSubscription = await UserSubscription.findById(subscription._id);
    const finalSessions = await Session.find({ coach: coachId });
    
    console.log('\n📊 Final Status:');
    console.log(`  Subscription Active: ${finalSubscription.isActive}`);
    console.log(`  Sessions Count: ${finalSessions.length}`);
    
    if (!finalSubscription.isActive && finalSessions.length === 0) {
      console.log('✅ CORRECT: No active subscription, no sessions');
    } else if (finalSubscription.isActive && finalSessions.length > 0) {
      console.log('✅ CORRECT: Active subscription, sessions exist');
    } else {
      console.log('❌ INCONSISTENT: Check the data');
    }
    
  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await checkAndFixSubscriptionStatus();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
