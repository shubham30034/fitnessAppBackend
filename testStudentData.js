const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const UserSubscription = require('./src/Model/paidSessionModel/userSubscription');
const User = require('./src/Model/userModel/userModel');
const UserAdditionalInfo = require('./src/Model/userModel/additionalInfo');
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

// Test the exact data that would be sent to frontend
const testStudentData = async () => {
  try {
    console.log('🔍 Testing student data for frontend...');
    
    // Simulate the exact query from getAllStudentsDetailed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const subscriptions = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: today }
    })
      .populate({
        path: 'client',
        select: 'phone role createdAt',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .populate({
        path: 'coach',
        select: 'phone role',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    console.log(`Found ${subscriptions.length} subscriptions`);

    const students = await Promise.all(subscriptions.map(async (sub) => {
      // Calculate total sessions for this student
      const totalSessions = await Session.countDocuments({
        users: sub.client._id,
        status: { $in: ['completed', 'ongoing'] }
      });

      // Calculate total spent based on subscription duration and monthly fee
      const startDate = new Date(sub.startDate);
      const endDate = new Date(sub.endDate);
      const currentDate = new Date();
      
      // Calculate months between start and current date (or end date if subscription ended)
      const endDateForCalculation = currentDate > endDate ? endDate : currentDate;
      const monthsDiff = Math.max(0, (endDateForCalculation.getFullYear() - startDate.getFullYear()) * 12 + 
        (endDateForCalculation.getMonth() - startDate.getMonth()));
      
      // Calculate total spent (monthly fee * number of months)
      const totalSpent = sub.monthlyFee * Math.max(1, monthsDiff);

      return {
        subscriptionId: sub._id,
        startDate: sub.startDate,
        endDate: sub.endDate,
        student: sub.client,
        coach: sub.coach,
        totalSessions: totalSessions,
        totalSpent: totalSpent,
        monthlyFee: sub.monthlyFee,
        sessionsPerMonth: sub.sessionsPerMonth,
        sessionsUsed: sub.sessionsUsed,
        subscriptionType: sub.subscriptionType,
        paymentStatus: sub.paymentStatus,
        isActive: sub.isActive
      };
    }));

    console.log('\n📊 Data that would be sent to frontend:');
    students.forEach((student, index) => {
      console.log(`\nStudent ${index + 1}:`);
      console.log(`  Name: ${student.student?.additionalInfo?.name || student.student?.phone || 'Unknown'}`);
      console.log(`  Email: ${student.student?.additionalInfo?.email || 'No email'}`);
      console.log(`  Phone: ${student.student?.phone || 'No phone'}`);
      console.log(`  Coach: ${student.coach?.additionalInfo?.name || student.coach?.phone || 'Unknown'}`);
      console.log(`  Start Date: ${new Date(student.startDate).toDateString()}`);
      console.log(`  End Date: ${new Date(student.endDate).toDateString()}`);
      console.log(`  Monthly Fee: ${student.monthlyFee} ${student.subscriptionType || 'INR'}`);
      console.log(`  Total Sessions: ${student.totalSessions}`);
      console.log(`  Total Spent: ${student.totalSpent}`);
      console.log(`  Status: ${student.isActive ? 'Active' : 'Inactive'}`);
      
      // Check the exact dates
      const startDate = new Date(student.startDate);
      const endDate = new Date(student.endDate);
      const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      console.log(`  Duration: ${duration} days`);
      console.log(`  Start Date (ISO): ${startDate.toISOString()}`);
      console.log(`  End Date (ISO): ${endDate.toISOString()}`);
      console.log(`  Start Date (Local): ${startDate.toLocaleDateString()}`);
      console.log(`  End Date (Local): ${endDate.toLocaleDateString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing student data:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await testStudentData();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
