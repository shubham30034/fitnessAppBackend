const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const User = require('./src/Model/userModel/userModel');
const UserAdditionalInfo = require('./src/Model/userModel/additionalInfo');

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

// Check and fix subscription dates
const checkSubscriptionDates = async () => {
  try {
    console.log('🔍 Checking subscription dates...');
    
    // Get all subscriptions
    const subscriptions = await UserSubscription.find({ isActive: true })
      .populate('client', 'phone additionalInfo')
      .populate('coach', 'phone additionalInfo');
    
    console.log(`Found ${subscriptions.length} active subscriptions`);
    
    subscriptions.forEach((sub, index) => {
      const startDate = new Date(sub.startDate);
      const endDate = new Date(sub.endDate);
      const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      console.log(`\nSubscription ${index + 1}:`);
      console.log(`  Client: ${sub.client?.additionalInfo?.name || sub.client?.phone || 'Unknown'}`);
      console.log(`  Coach: ${sub.coach?.additionalInfo?.name || sub.coach?.phone || 'Unknown'}`);
      console.log(`  Start Date: ${startDate.toDateString()}`);
      console.log(`  End Date: ${endDate.toDateString()}`);
      console.log(`  Duration: ${duration} days`);
      console.log(`  Fee: ${sub.monthlyFee} ${sub.currency}`);
      console.log(`  Type: ${sub.subscriptionType}`);
      
      if (duration < 25) {
        console.log(`  ⚠️ WARNING: Duration is only ${duration} days (should be ~30 days for monthly)`);
      }
    });
    
    // Check if we need to fix any subscriptions
    const shortSubscriptions = subscriptions.filter(sub => {
      const startDate = new Date(sub.startDate);
      const endDate = new Date(sub.endDate);
      const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      return duration < 25;
    });
    
    if (shortSubscriptions.length > 0) {
      console.log(`\n🔧 Found ${shortSubscriptions.length} subscriptions with short duration. Fixing...`);
      
      for (const sub of shortSubscriptions) {
        const startDate = new Date(sub.startDate);
        const newEndDate = new Date(startDate);
        newEndDate.setMonth(startDate.getMonth() + 1); // Add 1 month
        
        sub.endDate = newEndDate;
        await sub.save();
        
        console.log(`✅ Fixed subscription for ${sub.client?.additionalInfo?.name || sub.client?.phone}:`);
        console.log(`   Old end date: ${new Date(sub.startDate).toDateString()}`);
        console.log(`   New end date: ${newEndDate.toDateString()}`);
        console.log(`   New duration: ${Math.ceil((newEndDate - startDate) / (1000 * 60 * 60 * 24))} days`);
      }
    } else {
      console.log('\n✅ All subscriptions have proper duration (25+ days)');
    }
    
  } catch (error) {
    console.error('❌ Error checking subscription dates:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await checkSubscriptionDates();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
