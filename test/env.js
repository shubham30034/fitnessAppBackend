// Environment setup for tests
process.env.NODE_ENV = 'test';

// Database configuration
process.env.MONGODB_TEST_URI = 'mongodb://localhost:27017/fitness_test';

// JWT configuration
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Server configuration
process.env.PORT = 5001; // Use different port for testing
process.env.BASE_URL = 'http://localhost:5001';

// File upload configuration
process.env.MAX_FILE_SIZE = '5242880'; // 5MB
process.env.UPLOAD_PATH = './test/uploads';

// Rate limiting configuration
process.env.RATE_LIMIT_WINDOW_MS = '900000'; // 15 minutes
process.env.RATE_LIMIT_MAX_REQUESTS = '100';

// Email configuration (mock)
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'test-password';

// Payment configuration (mock)
process.env.RAZORPAY_KEY = 'test-key-id';
process.env.RAZORPAY_SECRET = 'test-key-secret';

// Cloudinary configuration (mock)
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';

// Logging configuration
process.env.LOG_LEVEL = 'error'; // Only show errors during tests

// Security configuration
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.HELMET_ENABLED = 'false'; // Disable helmet for tests

// Test-specific configuration
process.env.TEST_TIMEOUT = '30000';
process.env.TEST_DATABASE_NAME = 'fitness_test';

console.log('🔧 Test environment configured');
console.log('📊 Test Database:', process.env.MONGODB_TEST_URI);
console.log('🌐 Test Server Port:', process.env.PORT);
console.log('🔐 JWT Secret:', process.env.JWT_SECRET ? 'Configured' : 'Not configured');
