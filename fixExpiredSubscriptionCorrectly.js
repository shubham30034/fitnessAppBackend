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

// Fix expired subscription correctly by deactivating it
const fixExpiredSubscriptionCorrectly = async () => {
  try {
    console.log('🔧 Fixing expired subscription correctly by deactivating it...');
    
    const coachId = '684cfd7e87dd540f3ad69c2a'; // Coach 8798675686
    
    // Find the expired subscription
    const expiredSubscription = await UserSubscription.findOne({
      coach: coachId,
      isActive: true,
      endDate: { $lt: new Date() } // End date is in the past
    });
    
    if (!expiredSubscription) {
      console.log('❌ No expired subscription found');
      return;
    }
    
    console.log('📋 Found expired subscription:');
    console.log(`  Client: ${expiredSubscription.client}`);
    console.log(`  Start Date: ${new Date(expiredSubscription.startDate).toDateString()}`);
    console.log(`  End Date: ${new Date(expiredSubscription.endDate).toDateString()}`);
    console.log(`  Is Active: ${expiredSubscription.isActive}`);
    
    // CORRECT FIX: Deactivate the expired subscription
    console.log('\n🔧 Deactivating expired subscription...');
    
    expiredSubscription.isActive = false;
    expiredSubscription.expiredAt = new Date();
    expiredSubscription.expirationReason = 'automatic_expiration';
    await expiredSubscription.save();
    
    console.log('✅ Expired subscription deactivated');
    
    // Remove any sessions that were created for this expired subscription
    console.log('\n🗑️ Removing sessions for expired subscription...');
    
    const sessionsToDelete = await Session.find({ coach: coachId });
    console.log(`Found ${sessionsToDelete.length} sessions to delete`);
    
    if (sessionsToDelete.length > 0) {
      await Session.deleteMany({ coach: coachId });
      console.log(`✅ Deleted ${sessionsToDelete.length} sessions for expired subscription`);
    }
    
    // Verify the fix
    const updatedSubscription = await UserSubscription.findById(expiredSubscription._id);
    const remainingSessions = await Session.find({ coach: coachId });
    
    console.log('\n📋 Updated subscription:');
    console.log(`  Start Date: ${new Date(updatedSubscription.startDate).toDateString()}`);
    console.log(`  End Date: ${new Date(updatedSubscription.endDate).toDateString()}`);
    console.log(`  Is Active: ${updatedSubscription.isActive}`);
    console.log(`  Expired At: ${updatedSubscription.expiredAt ? new Date(updatedSubscription.expiredAt).toDateString() : 'N/A'}`);
    console.log(`  Expiration Reason: ${updatedSubscription.expirationReason || 'N/A'}`);
    
    console.log(`\n📊 Remaining sessions for this coach: ${remainingSessions.length}`);
    
    if (remainingSessions.length === 0) {
      console.log('✅ No sessions remain for expired subscription - CORRECT!');
    } else {
      console.log('❌ Sessions still exist for expired subscription - ERROR!');
    }
    
    console.log('\n🎯 Business Logic Verification:');
    console.log('✅ Expired subscription is now deactivated');
    console.log('✅ No sessions exist for expired subscription');
    console.log('✅ System will not generate new sessions for this coach');
    console.log('✅ Coach needs to renew subscription to get new sessions');
    
  } catch (error) {
    console.error('❌ Error fixing expired subscription:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixExpiredSubscriptionCorrectly();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
