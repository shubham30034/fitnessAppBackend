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

// Fix expired subscription properly
const fixExpiredSubscriptionProperly = async () => {
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
    console.log(`  Platform: ${expiredSubscription.platform}`);
    console.log(`  Monthly Fee: ${expiredSubscription.monthlyFee}`);
    
    // Extend the subscription with proper fields
    console.log('\n🔧 Extending subscription with proper fields...');
    
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + 30); // Extend by 30 days
    
    // Update the subscription with all required fields
    const updateData = {
      isActive: true,
      endDate: newEndDate,
      paymentStatus: 'completed',
      platform: expiredSubscription.platform || 'web',
      monthlyFee: expiredSubscription.monthlyFee || 1000,
      currency: expiredSubscription.currency || 'INR',
      sessionsPerMonth: expiredSubscription.sessionsPerMonth || 4,
      sessionsUsed: expiredSubscription.sessionsUsed || 0,
      subscriptionType: expiredSubscription.subscriptionType || 'monthly'
    };
    
    // Remove expired fields if they exist
    if (expiredSubscription.expiredAt) {
      updateData.$unset = { expiredAt: 1, expirationReason: 1 };
    }
    
    await UserSubscription.findByIdAndUpdate(expiredSubscription._id, updateData);
    
    console.log(`✅ Subscription extended until ${newEndDate.toDateString()}`);
    
    // Verify the fix
    const updatedSubscription = await UserSubscription.findById(expiredSubscription._id);
    console.log('\n📋 Updated subscription:');
    console.log(`  Start Date: ${new Date(updatedSubscription.startDate).toDateString()}`);
    console.log(`  End Date: ${new Date(updatedSubscription.endDate).toDateString()}`);
    console.log(`  Is Active: ${updatedSubscription.isActive}`);
    console.log(`  Payment Status: ${updatedSubscription.paymentStatus}`);
    console.log(`  Platform: ${updatedSubscription.platform}`);
    console.log(`  Monthly Fee: ${updatedSubscription.monthlyFee} ${updatedSubscription.currency}`);
    
    // Now check if coach should have sessions
    console.log('\n🎯 Checking if coach should now have sessions...');
    
    const today = new Date();
    const isSubscriptionActive = updatedSubscription.isActive && 
                                new Date(updatedSubscription.startDate) <= today && 
                                new Date(updatedSubscription.endDate) >= today;
    
    console.log(`  Subscription active today: ${isSubscriptionActive}`);
    
    if (isSubscriptionActive) {
      console.log('✅ Coach should now have sessions generated!');
      console.log('💡 The coach will get sessions in the next cron job run or you can manually trigger session generation.');
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
    await fixExpiredSubscriptionProperly();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
