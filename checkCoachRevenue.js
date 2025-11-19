const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const Session = require('./src/Model/paidSessionModel/session');
const CoachProfile = require('./src/Model/paidSessionModel/coach');

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

// Check coach revenue calculation
const checkCoachRevenue = async () => {
  try {
    console.log('💰 Checking coach revenue calculation...');
    
    // Get all coaches
    const coaches = await User.find({ role: 'coach' });
    console.log(`📊 Total coaches: ${coaches.length}`);
    
    let totalRevenue = 0;
    let totalActiveSubscriptions = 0;
    
    for (const coach of coaches) {
      console.log(`\n👤 Coach: ${coach.phone}`);
      
      // Get active subscriptions for this coach
      const activeSubscriptions = await UserSubscription.find({
        coach: coach._id,
        isActive: true,
        endDate: { $gte: new Date() }
      });
      
      console.log(`  💳 Active subscriptions: ${activeSubscriptions.length}`);
      
      let coachRevenue = 0;
      for (const sub of activeSubscriptions) {
        console.log(`    - Subscription ${sub._id}:`);
        console.log(`      Monthly Fee: ${sub.monthlyFee} ${sub.currency}`);
        console.log(`      Start Date: ${new Date(sub.startDate).toDateString()}`);
        console.log(`      End Date: ${new Date(sub.endDate).toDateString()}`);
        
        // Convert to INR for calculation
        let feeInINR = 0;
        if (sub.currency === 'INR') {
          feeInINR = sub.monthlyFee || 0;
        } else if (sub.currency === 'USD') {
          feeInINR = (sub.monthlyFee || 0) * 83; // Convert USD to INR
        } else if (sub.currency === 'EUR') {
          feeInINR = (sub.monthlyFee || 0) * 90; // Convert EUR to INR
        }
        
        coachRevenue += feeInINR;
        console.log(`      Fee in INR: ₹${feeInINR}`);
      }
      
      totalRevenue += coachRevenue;
      totalActiveSubscriptions += activeSubscriptions.length;
      
      console.log(`  💰 Coach total revenue: ₹${coachRevenue}`);
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total coaches: ${coaches.length}`);
    console.log(`  Total active subscriptions: ${totalActiveSubscriptions}`);
    console.log(`  Total coach revenue: ₹${totalRevenue}`);
    
    // Check what the API should return
    console.log(`\n🔍 API Response should be:`);
    console.log(`  totalRevenue: ${totalRevenue}`);
    
    // Check if 2000 is correct
    if (totalRevenue === 2000) {
      console.log(`  ✅ Revenue of ₹2000 is CORRECT`);
    } else {
      console.log(`  ❌ Revenue of ₹2000 is INCORRECT`);
      console.log(`  📊 Actual revenue should be: ₹${totalRevenue}`);
    }
    
    // Check individual subscription details
    console.log(`\n🔍 Detailed subscription breakdown:`);
    const allActiveSubs = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: new Date() }
    });
    
    for (const sub of allActiveSubs) {
      const coach = await User.findById(sub.coach);
      const client = await User.findById(sub.client);
      console.log(`  - Coach: ${coach.phone}, Client: ${client.phone}`);
      console.log(`    Fee: ${sub.monthlyFee} ${sub.currency}`);
      console.log(`    Period: ${new Date(sub.startDate).toDateString()} to ${new Date(sub.endDate).toDateString()}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking coach revenue:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await checkCoachRevenue();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
