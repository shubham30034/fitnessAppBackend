/**
 * Manual Subscription Cleanup Script
 * 
 * This script will immediately clean up expired subscriptions
 * Run this to fix the issue where expired subscriptions still show as active
 */

const mongoose = require('mongoose');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fitnessapp';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function cleanupExpiredSubscriptions() {
  console.log('\n🧹 Starting manual subscription cleanup...');
  
  const today = new Date();
  console.log(`📅 Current date: ${today.toISOString()}`);
  
  // Find expired subscriptions that are still marked as active
  const expiredSubscriptions = await UserSubscription.find({
    isActive: true,
    endDate: { $lt: today }
  }).populate('client', 'phone').populate('coach', 'phone');

  console.log(`\n📊 Found ${expiredSubscriptions.length} expired subscriptions:`);
  
  if (expiredSubscriptions.length === 0) {
    console.log('✅ No expired subscriptions found. All subscriptions are properly managed.');
    return;
  }

  // Display details of expired subscriptions
  expiredSubscriptions.forEach((sub, index) => {
    console.log(`\n--- Expired Subscription ${index + 1} ---`);
    console.log(`ID: ${sub._id}`);
    console.log(`Client Phone: ${sub.client?.phone || 'N/A'}`);
    console.log(`Coach Phone: ${sub.coach?.phone || 'N/A'}`);
    console.log(`Start Date: ${sub.startDate.toISOString()}`);
    console.log(`End Date: ${sub.endDate.toISOString()}`);
    console.log(`Days Expired: ${Math.floor((today - sub.endDate) / (1000 * 60 * 60 * 24))} days`);
    console.log(`Monthly Fee: ${sub.monthlyFee} ${sub.currency}`);
    console.log(`Platform: ${sub.platform}`);
  });

  // Deactivate expired subscriptions
  console.log('\n🔄 Deactivating expired subscriptions...');
  
  const updateResult = await UserSubscription.updateMany(
    { isActive: true, endDate: { $lt: today } },
    { 
      isActive: false,
      $set: { 
        expiredAt: today,
        expirationReason: 'manual_cleanup'
      }
    }
  );
  
  console.log(`✅ Successfully deactivated ${updateResult.modifiedCount} expired subscriptions`);
  
  // Verify the cleanup
  const remainingExpired = await UserSubscription.countDocuments({
    isActive: true,
    endDate: { $lt: today }
  });
  
  console.log(`\n📊 Verification:`);
  console.log(`- Expired subscriptions still marked active: ${remainingExpired}`);
  console.log(`- Properly expired subscriptions: ${updateResult.modifiedCount}`);
  
  if (remainingExpired === 0) {
    console.log('\n🎉 SUCCESS: All expired subscriptions have been properly deactivated!');
  } else {
    console.log('\n⚠️ WARNING: Some expired subscriptions are still active. Please check manually.');
  }
}

async function showSubscriptionStats() {
  console.log('\n📊 Current Subscription Statistics:');
  
  const today = new Date();
  
  const totalSubscriptions = await UserSubscription.countDocuments();
  const activeSubscriptions = await UserSubscription.countDocuments({ isActive: true });
  const expiredButStillActive = await UserSubscription.countDocuments({ 
    isActive: true, 
    endDate: { $lt: today } 
  });
  const properlyExpired = await UserSubscription.countDocuments({ 
    isActive: false,
    expiredAt: { $exists: true }
  });
  
  console.log(`- Total subscriptions: ${totalSubscriptions}`);
  console.log(`- Active subscriptions: ${activeSubscriptions}`);
  console.log(`- Expired but still active: ${expiredButStillActive}`);
  console.log(`- Properly expired: ${properlyExpired}`);
  
  if (expiredButStillActive > 0) {
    console.log(`\n🚨 ISSUE: ${expiredButStillActive} subscriptions are expired but still marked as active!`);
  } else {
    console.log(`\n✅ All subscriptions are properly managed.`);
  }
}

async function main() {
  try {
    await connectToDatabase();
    
    // Show current stats
    await showSubscriptionStats();
    
    // Run cleanup
    await cleanupExpiredSubscriptions();
    
    // Show final stats
    console.log('\n📊 Final Statistics:');
    await showSubscriptionStats();
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the cleanup
main();
