const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');

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

// Fix expired subscription
const fixExpiredSubscription = async () => {
  try {
    console.log('🔧 Fixing expired subscription for coach 8798675686...');
    
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
    console.log(`  Payment Status: ${expiredSubscription.paymentStatus}`);
    
    // Option 1: Deactivate the expired subscription
    console.log('\n🔧 Option 1: Deactivating expired subscription...');
    expiredSubscription.isActive = false;
    expiredSubscription.expiredAt = new Date();
    expiredSubscription.expirationReason = 'automatic_expiration';
    await expiredSubscription.save();
    
    console.log('✅ Expired subscription deactivated');
    
    // Option 2: Extend the subscription to make it active again
    console.log('\n🔧 Option 2: Extending subscription to make it active...');
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + 30); // Extend by 30 days
    
    expiredSubscription.isActive = true;
    expiredSubscription.endDate = newEndDate;
    expiredSubscription.paymentStatus = 'completed';
    expiredSubscription.expiredAt = undefined;
    expiredSubscription.expirationReason = undefined;
    await expiredSubscription.save();
    
    console.log(`✅ Subscription extended until ${newEndDate.toDateString()}`);
    
    // Verify the fix
    const updatedSubscription = await UserSubscription.findById(expiredSubscription._id);
    console.log('\n📋 Updated subscription:');
    console.log(`  Start Date: ${new Date(updatedSubscription.startDate).toDateString()}`);
    console.log(`  End Date: ${new Date(updatedSubscription.endDate).toDateString()}`);
    console.log(`  Is Active: ${updatedSubscription.isActive}`);
    console.log(`  Payment Status: ${updatedSubscription.paymentStatus}`);
    
    // Now check if coach should have sessions
    console.log('\n🎯 Checking if coach should now have sessions...');
    
    const today = new Date();
    const isSubscriptionActive = updatedSubscription.isActive && 
                                new Date(updatedSubscription.startDate) <= today && 
                                new Date(updatedSubscription.endDate) >= today;
    
    console.log(`  Subscription active today: ${isSubscriptionActive}`);
    
    if (isSubscriptionActive) {
      console.log('✅ Coach should now have sessions generated!');
      console.log('💡 Run the session generation script to create sessions for this coach.');
    } else {
      console.log('❌ Coach still cannot have sessions');
    }
    
  } catch (error) {
    console.error('❌ Error fixing expired subscription:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixExpiredSubscription();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
