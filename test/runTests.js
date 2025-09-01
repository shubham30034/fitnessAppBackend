const { exec } = require('child_process');
const path = require('path');

// Test configuration
const testConfig = {
    timeout: 30000, // 30 seconds timeout
    verbose: true,
    coverage: true,
    testEnvironment: 'node'
};

// Test files to run
const testFiles = [
    'productManagement.test.js'
];

// Environment setup
process.env.NODE_ENV = 'test';
process.env.MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/fitness_test';

console.log('🚀 Starting Product Management API Tests...');
console.log('📊 Test Configuration:', testConfig);
console.log('🔗 Test Database:', process.env.MONGODB_TEST_URI);
console.log('📁 Test Files:', testFiles);
console.log('');

// Function to run tests
function runTests() {
    const testCommand = `npx jest ${testFiles.join(' ')} --timeout=${testConfig.timeout} --verbose --coverage`;
    
    console.log('🧪 Executing tests with command:', testCommand);
    console.log('');

    const child = exec(testCommand, {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, ...testConfig }
    });

    child.stdout.on('data', (data) => {
        console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    child.on('close', (code) => {
        console.log('');
        if (code === 0) {
            console.log('✅ All tests passed successfully!');
            console.log('🎉 Product Management API is working correctly.');
        } else {
            console.log('❌ Some tests failed. Please check the output above.');
            console.log('🔧 Fix the issues and run the tests again.');
        }
        process.exit(code);
    });

    child.on('error', (error) => {
        console.error('❌ Error running tests:', error);
        process.exit(1);
    });
}

// Function to check prerequisites
function checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    // Check if MongoDB is running
    const { execSync } = require('child_process');
    try {
        execSync('mongod --version', { stdio: 'ignore' });
        console.log('✅ MongoDB is available');
    } catch (error) {
        console.log('⚠️  MongoDB might not be running. Please start MongoDB before running tests.');
    }

    // Check if required packages are installed
    try {
        require('supertest');
        require('jest');
        console.log('✅ Required packages are installed');
    } catch (error) {
        console.log('❌ Missing required packages. Please run: npm install');
        process.exit(1);
    }

    console.log('');
}

// Function to setup test database
async function setupTestDatabase() {
    console.log('🗄️  Setting up test database...');
    
    const mongoose = require('mongoose');
    
    try {
        await mongoose.connect(process.env.MONGODB_TEST_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        // Clean up any existing test data
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
        }
        
        console.log('✅ Test database setup complete');
        await mongoose.connection.close();
    } catch (error) {
        console.log('❌ Error setting up test database:', error.message);
        console.log('💡 Make sure MongoDB is running and accessible');
        process.exit(1);
    }
}

// Main execution
async function main() {
    try {
        checkPrerequisites();
        await setupTestDatabase();
        runTests();
    } catch (error) {
        console.error('❌ Error in test setup:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Tests interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Tests terminated');
    process.exit(0);
});

// Run the main function
main();
