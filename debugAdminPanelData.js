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

// Debug what the admin panel receives
const debugAdminPanelData = async () => {
  try {
    console.log('🔍 Debugging admin panel data...');
    
    // Simulate the exact query that the admin panel uses
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Current date for expiration check:', today.toISOString());
    
    const subscriptions = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: today }
    })
      .populate({
        path: 'client',
        select: 'phone role createdAt additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email userId'
        }
      })
      .populate({
        path: 'coach',
        select: 'phone role additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email userId'
        }
      });

    console.log(`\nFound ${subscriptions.length} active subscriptions`);
    
    // Process data exactly like the backend does
    const students = subscriptions.map(sub => {
      const startDate = new Date(sub.startDate);
      const endDate = new Date(sub.endDate);
      const durationInDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      return {
        subscriptionId: sub._id,
        startDate: sub.startDate,
        endDate: sub.endDate,
        student: sub.client,
        coach: sub.coach,
        monthlyFee: sub.monthlyFee,
        sessionsPerMonth: sub.sessionsPerMonth,
        sessionsUsed: sub.sessionsUsed,
        subscriptionType: sub.subscriptionType,
        paymentStatus: sub.paymentStatus,
        isActive: sub.isActive,
        // Calculate duration
        durationInDays: durationInDays,
        // Calculate days remaining
        daysRemaining: Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
      };
    });

    console.log('\n📊 Processed data that admin panel receives:');
    students.forEach((student, index) => {
      console.log(`\nStudent ${index + 1}:`);
      console.log(`  Name: ${student.student?.additionalInfo?.name || student.student?.phone || 'Unknown'}`);
      console.log(`  Email: ${student.student?.additionalInfo?.email || 'No email'}`);
      console.log(`  Phone: ${student.student?.phone || 'No phone'}`);
      console.log(`  Coach: ${student.coach?.additionalInfo?.name || student.coach?.phone || 'Unknown'}`);
      console.log(`  Start Date: ${new Date(student.startDate).toDateString()}`);
      console.log(`  End Date: ${new Date(student.endDate).toDateString()}`);
      console.log(`  Duration: ${student.durationInDays} days`);
      console.log(`  Days Remaining: ${student.daysRemaining} days`);
      console.log(`  Monthly Fee: ${student.monthlyFee} ${student.subscriptionType || 'INR'}`);
      console.log(`  Status: ${student.isActive ? 'Active' : 'Inactive'}`);
      
      // Check if duration is suspiciously short
      if (student.durationInDays < 25) {
        console.log(`  ⚠️ WARNING: Duration is only ${student.durationInDays} days (should be ~30 days for monthly)`);
      }
    });
    
    // Check for any subscriptions with very short durations
    const shortSubscriptions = students.filter(s => s.durationInDays < 25);
    if (shortSubscriptions.length > 0) {
      console.log(`\n⚠️ Found ${shortSubscriptions.length} subscriptions with short duration:`);
      shortSubscriptions.forEach(sub => {
        console.log(`  - ${sub.student?.additionalInfo?.name || sub.student?.phone}: ${sub.durationInDays} days`);
      });
    } else {
      console.log('\n✅ All subscriptions have proper duration (25+ days)');
    }
    
  } catch (error) {
    console.error('❌ Error debugging admin panel data:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await debugAdminPanelData();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
