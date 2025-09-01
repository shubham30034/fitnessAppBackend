// Global teardown for Jest tests
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
    console.log('🧹 Global test teardown starting...');
    
    try {
        // Connect to test database for cleanup
        const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/fitness_test';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        // Clean up all test data
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
        }
        
        console.log('🧹 Cleaned up all test data');
        
        // Close database connection
        await mongoose.connection.close();
        
        // Clean up test files and directories
        const testDirs = [
            './test/uploads',
            './test/logs'
        ];
        
        for (const dir of testDirs) {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }
        
        console.log('🗑️  Cleaned up test directories');
        
        console.log('✅ Global test teardown completed');
        
    } catch (error) {
        console.error('❌ Global test teardown failed:', error);
        // Don't throw error in teardown to avoid masking test failures
    }
};
