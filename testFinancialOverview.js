const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/Model/userModel/userModel');
const UserAdditionalInfo = require('./src/Model/userModel/additionalInfo');
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const Session = require('./src/Model/paidSessionModel/session');

async function testFinancialOverview() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Test the financial overview logic
    console.log('\n=== TESTING FINANCIAL OVERVIEW ===\n');

    // 1. Check coaches
    const coaches = await User.find({ role: 'coach' }).populate('additionalInfo', 'name email');
    console.log('1. Found coaches:', coaches.length);
    coaches.forEach(coach => {
      console.log(`   - ${coach._id}: ${coach.additionalInfo?.name || 'No name'} (${coach.additionalInfo?.email || 'No email'})`);
    });

    // 2. Check all subscriptions
    const allSubscriptions = await UserSubscription.find({});
    console.log('\n2. Total subscriptions in database:', allSubscriptions.length);
    allSubscriptions.forEach(sub => {
      console.log(`   - ID: ${sub._id}`);
      console.log(`     Coach: ${sub.coach}`);
      console.log(`     Client: ${sub.client}`);
      console.log(`     Monthly Fee: ${sub.monthlyFee}`);
      console.log(`     Currency: ${sub.currency}`);
      console.log(`     Is Active: ${sub.isActive}`);
      console.log(`     Start Date: ${sub.startDate}`);
      console.log(`     End Date: ${sub.endDate}`);
      console.log(`     Payment Status: ${sub.paymentStatus}`);
      console.log('   ---');
    });

    // 3. Check active subscriptions
    const activeSubscriptions = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: new Date() }
    });
    console.log('\n3. Active subscriptions (not expired):', activeSubscriptions.length);
    activeSubscriptions.forEach(sub => {
      console.log(`   - Coach: ${sub.coach}, Fee: ${sub.monthlyFee} ${sub.currency}, End: ${sub.endDate}`);
    });

    // 4. Check sessions
    const allSessions = await Session.find({});
    console.log('\n4. Total sessions in database:', allSessions.length);
    allSessions.forEach(session => {
      console.log(`   - ID: ${session._id}`);
      console.log(`     Coach: ${session.coach}`);
      console.log(`     Date: ${session.date}`);
      console.log(`     Status: ${session.status}`);
      console.log(`     Type: ${session.sessionType}`);
      console.log('   ---');
    });

    // 5. Test financial calculation for each coach
    console.log('\n5. Financial calculation for each coach:');
    for (const coach of coaches) {
      console.log(`\n   Coach: ${coach._id} - ${coach.additionalInfo?.name}`);
      
      // Get active subscriptions for this coach
      const coachActiveSubscriptions = await UserSubscription.find({
        coach: coach._id,
        isActive: true,
        endDate: { $gte: new Date() }
      });
      
      console.log(`   Active subscriptions: ${coachActiveSubscriptions.length}`);
      coachActiveSubscriptions.forEach(sub => {
        console.log(`     - Fee: ${sub.monthlyFee} ${sub.currency}, End: ${sub.endDate}`);
      });
      
      const totalRevenue = coachActiveSubscriptions.reduce((sum, sub) => {
        let feeInINR = 0;
        if (sub.currency === 'INR') {
          feeInINR = sub.monthlyFee || 0;
        } else if (sub.currency === 'USD') {
          feeInINR = (sub.monthlyFee || 0) * 83;
        } else if (sub.currency === 'EUR') {
          feeInINR = (sub.monthlyFee || 0) * 90;
        }
        return sum + feeInINR;
      }, 0);
      
      console.log(`   Total revenue: ₹${totalRevenue}`);
      
      // Get sessions for this coach
      const coachSessions = await Session.countDocuments({ coach: coach._id });
      console.log(`   Total sessions: ${coachSessions}`);
    }

    // 6. Test the actual API endpoint logic
    console.log('\n6. Testing API endpoint logic:');
    const financialData = [];
    
    for (const coach of coaches) {
      const activeSubscriptionsData = await UserSubscription.find({
        coach: coach._id,
        isActive: true,
        endDate: { $gte: new Date() }
      });
      
      const activeSubscriptions = activeSubscriptionsData.length;
      const totalSubscriptionRevenue = activeSubscriptionsData.reduce((sum, sub) => {
        let feeInINR = 0;
        if (sub.currency === 'INR') {
          feeInINR = sub.monthlyFee || 0;
        } else if (sub.currency === 'USD') {
          feeInINR = (sub.monthlyFee || 0) * 83;
        } else if (sub.currency === 'EUR') {
          feeInINR = (sub.monthlyFee || 0) * 90;
        }
        return sum + feeInINR;
      }, 0);
      
      const totalSessions = await Session.countDocuments({ coach: coach._id });
      
      financialData.push({
        coachId: coach._id,
        coachName: coach.additionalInfo?.name || 'Unknown',
        coachEmail: coach.additionalInfo?.email || '',
        activeSubscriptions,
        totalSubscriptionRevenue,
        totalSessions,
        estimatedRevenue: totalSubscriptionRevenue
      });
    }
    
    console.log('\nFinancial Data Array:');
    console.log(JSON.stringify(financialData, null, 2));
    
    const totalActiveSubscriptions = financialData.reduce((sum, item) => sum + item.activeSubscriptions, 0);
    const totalRevenue = financialData.reduce((sum, item) => sum + item.estimatedRevenue, 0);
    
    console.log('\nTotals:');
    console.log(`Total Active Subscriptions: ${totalActiveSubscriptions}`);
    console.log(`Total Revenue: ₹${totalRevenue}`);
    console.log(`Total Coaches: ${coaches.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  }
}

testFinancialOverview();
