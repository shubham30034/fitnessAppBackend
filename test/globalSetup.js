// Global setup for Jest tests
const mongoose = require('mongoose');

module.exports = async () => {
    console.log('🌍 Global test setup starting...');
    
    try {
        // Connect to test database
        const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/fitness_test';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to test database');
        
        // Clean up any existing test data
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
        }
        
        console.log('🧹 Cleaned up existing test data');
        
        // Create test directories if they don't exist
        const fs = require('fs');
        const path = require('path');
        
        const testDirs = [
            './test/uploads',
            './test/uploads/products',
            './test/logs'
        ];
        
        for (const dir of testDirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        
        console.log('📁 Created test directories');
        
        // Close connection
        await mongoose.connection.close();
        
        console.log('✅ Global test setup completed');
        
    } catch (error) {
        console.error('❌ Global test setup failed:', error);
        throw error;
    }
};
