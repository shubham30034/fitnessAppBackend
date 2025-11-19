const mongoose = require('mongoose');
require('dotenv').config();

// Import models
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

// Fix coach names by adding additional info
const fixCoachNames = async () => {
  try {
    console.log('🔧 Fixing coach names...');
    
    // Get all coaches
    const coaches = await User.find({ role: 'coach' });
    console.log(`Found ${coaches.length} coaches`);
    
    for (const coach of coaches) {
      console.log(`\n👤 Processing coach: ${coach._id}`);
      
      // Check if coach has additional info
      let additionalInfo = null;
      if (coach.additionalInfo) {
        additionalInfo = await UserAdditionalInfo.findById(coach.additionalInfo);
        console.log(`  📋 Existing additional info: ${additionalInfo?.name || 'No name'}`);
      }
      
      // If no additional info or no name, create/update it
      if (!additionalInfo || !additionalInfo.name) {
        const coachNames = [
          'Shubham Coach',
          'Sarthak Coach', 
          'Rishabh Coach',
          'Amit Coach',
          'Priya Coach',
          'Raj Coach',
          'Sneha Coach',
          'Vikram Coach'
        ];
        
        const randomName = coachNames[Math.floor(Math.random() * coachNames.length)];
        const randomEmail = `${randomName.toLowerCase().replace(' ', '.')}@fitnessapp.com`;
        
        if (!additionalInfo) {
          // Create new additional info
          additionalInfo = new UserAdditionalInfo({
            name: randomName,
            email: randomEmail,
            age: Math.floor(Math.random() * 20) + 25, // 25-45
            gender: Math.random() > 0.5 ? 'male' : 'female',
            height: Math.floor(Math.random() * 30) + 150, // 150-180 cm
            weight: Math.floor(Math.random() * 30) + 60, // 60-90 kg
            fitnessGoal: ['weight-loss', 'muscle-gain', 'general-fitness'][Math.floor(Math.random() * 3)],
            experience: Math.floor(Math.random() * 5) + 1,
            medicalConditions: [],
            emergencyContact: {
              name: `${randomName} Emergency`,
              phone: `9876543${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
              relationship: 'family'
            }
          });
          
          await additionalInfo.save();
          console.log(`  ✅ Created additional info: ${randomName}`);
          
          // Update coach with additional info reference
          coach.additionalInfo = additionalInfo._id;
          await coach.save();
          console.log(`  ✅ Updated coach with additional info reference`);
        } else {
          // Update existing additional info
          additionalInfo.name = randomName;
          additionalInfo.email = randomEmail;
          await additionalInfo.save();
          console.log(`  ✅ Updated additional info: ${randomName}`);
        }
      }
    }
    
    // Now test the session population
    console.log('\n🔍 Testing session population...');
    const sessions = await Session.find()
      .populate({
        path: 'coach',
        select: 'phone additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .limit(3);
    
    console.log(`\n📊 Sample sessions with coach names:`);
    sessions.forEach((session, index) => {
      console.log(`\nSession ${index + 1}:`);
      console.log(`  Date: ${session.date.toDateString()}`);
      console.log(`  Time: ${session.startTime} - ${session.endTime}`);
      console.log(`  Coach: ${session.coach?.additionalInfo?.name || 'Unknown'}`);
      console.log(`  Coach Phone: ${session.coach?.phone || 'N/A'}`);
      console.log(`  Fee: ${session.monthlyFee} ${session.currency}`);
      console.log(`  Status: ${session.status}`);
    });
    
    console.log('\n🎉 Coach names fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing coach names:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await fixCoachNames();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
