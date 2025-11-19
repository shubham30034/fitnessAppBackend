const Category = require('../Model/ProductsModel/category');
const mongoose = require('mongoose');

// Basic categories to seed
const seedData = [
  { name: 'supplement' },
  { name: 'clothes' },
  { name: 'accessories' }
];

const seedCategories = async () => {
  try {
    console.log('🌱 Starting category seeding...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/fitnessApp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Clear existing categories
    await Category.deleteMany({});
    console.log('🧹 Cleared existing categories');
    
    // Insert new categories
    const result = await Category.insertMany(seedData);
    console.log('✅ Categories seeded successfully:', result.map(cat => cat.name));
    
    // Verify
    const count = await Category.countDocuments();
    console.log(`📊 Total categories in database: ${count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  }
};

// Run the seed
seedCategories();
