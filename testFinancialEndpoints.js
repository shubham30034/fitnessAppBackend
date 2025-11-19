const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
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

// Test financial endpoints calculation
const testFinancialEndpoints = async () => {
  try {
    console.log('💰 Testing financial endpoints calculation...');
    
    // Get all coaches
    const coaches = await User.find({ role: 'coach' });
    console.log(`📊 Total coaches: ${coaches.length}`);
    
    // Test SuperAdmin calculation (hardcoded ₹1000 per subscription)
    console.log('\n🔍 SuperAdmin Controller Calculation:');
    let superAdminRevenue = 0;
    let superAdminSubscriptions = 0;
    
    for (const coach of coaches) {
      const activeSubscriptions = await UserSubscription.countDocuments({
        coach: coach._id,
        isActive: true
      });
      
      const estimatedRevenue = activeSubscriptions * 1000; // Hardcoded calculation
      superAdminRevenue += estimatedRevenue;
      superAdminSubscriptions += activeSubscriptions;
      
      console.log(`  Coach ${coach.phone}: ${activeSubscriptions} subscriptions × ₹1000 = ₹${estimatedRevenue}`);
    }
    
    console.log(`\n📊 SuperAdmin Total: ${superAdminSubscriptions} subscriptions × ₹1000 = ₹${superAdminRevenue}`);
    
    // Test CoachManager calculation (actual subscription fees)
    console.log('\n🔍 CoachManager Controller Calculation:');
    let coachManagerRevenue = 0;
    let coachManagerSubscriptions = 0;
    
    for (const coach of coaches) {
      const activeSubscriptions = await UserSubscription.find({
        coach: coach._id,
        isActive: true,
        endDate: { $gte: new Date() }
      });
      
      let coachRevenue = 0;
      for (const sub of activeSubscriptions) {
        let feeInINR = 0;
        if (sub.currency === 'INR') {
          feeInINR = sub.monthlyFee || 0;
        } else if (sub.currency === 'USD') {
          feeInINR = (sub.monthlyFee || 0) * 83;
        } else if (sub.currency === 'EUR') {
          feeInINR = (sub.monthlyFee || 0) * 90;
        }
        coachRevenue += feeInINR;
      }
      
      coachManagerRevenue += coachRevenue;
      coachManagerSubscriptions += activeSubscriptions.length;
      
      console.log(`  Coach ${coach.phone}: ${activeSubscriptions.length} subscriptions = ₹${coachRevenue}`);
    }
    
    console.log(`\n📊 CoachManager Total: ${coachManagerSubscriptions} subscriptions = ₹${coachManagerRevenue}`);
    
    // Compare results
    console.log(`\n🎯 COMPARISON:`);
    console.log(`  SuperAdmin calculation: ₹${superAdminRevenue}`);
    console.log(`  CoachManager calculation: ₹${coachManagerRevenue}`);
    console.log(`  Actual subscription fees: ₹${coachManagerRevenue}`);
    
    if (superAdminRevenue === 2000) {
      console.log(`  ✅ SuperAdmin shows ₹2000 (2 subscriptions × ₹1000)`);
    }
    
    if (coachManagerRevenue === 11000) {
      console.log(`  ✅ CoachManager shows ₹11000 (actual fees: ₹5000 + ₹6000)`);
    }
    
    console.log(`\n🔧 RECOMMENDATION:`);
    console.log(`  The frontend should use CoachManager endpoint for accurate revenue calculation.`);
    console.log(`  SuperAdmin endpoint uses hardcoded ₹1000 per subscription (incorrect).`);
    console.log(`  CoachManager endpoint uses actual subscription fees (correct).`);
    
  } catch (error) {
    console.error('❌ Error testing financial endpoints:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await testFinancialEndpoints();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
