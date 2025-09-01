// Test setup file for Jest
const mongoose = require('mongoose');

// Increase timeout for all tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/fitness_test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
});

// Global test teardown
afterAll(async () => {
    // Close database connection
    await mongoose.connection.close();
});

// Clean up after each test
afterEach(async () => {
    // Clean up all collections after each test
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
        await collection.deleteMany({});
    }
});

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    // Uncomment to suppress console.log during tests
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock file system operations
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    unlinkSync: jest.fn(),
    existsSync: jest.fn(() => false),
    readdirSync: jest.fn(() => []),
    rmdirSync: jest.fn(),
}));

// Mock image optimization
jest.mock('../src/Utils/imageOptimizer', () => ({
    optimizeProductImage: jest.fn(() => Promise.resolve({
        thumbnail: 'thumb.jpg',
        small: 'small.jpg',
        medium: 'medium.jpg',
        large: 'large.jpg'
    })),
    generateResponsiveUrls: jest.fn(() => ({
        thumbnail: '/uploads/thumb.jpg',
        small: '/uploads/small.jpg',
        medium: '/uploads/medium.jpg',
        large: '/uploads/large.jpg'
    })),
    isSharpAvailable: jest.fn(() => true),
    generateFallbackResponsiveImages: jest.fn(() => Promise.resolve({
        thumbnail: 'thumb.jpg',
        small: 'small.jpg',
        medium: 'medium.jpg',
        large: 'large.jpg'
    }))
}));

// Mock Cloudinary upload
jest.mock('../src/Utils/imageUploader', () => ({
    uploadMultipleImagesToCloudinary: jest.fn(() => Promise.resolve([
        { secure_url: 'https://cloudinary.com/test1.jpg' },
        { secure_url: 'https://cloudinary.com/test2.jpg' }
    ]))
}));

// Mock JWT token generation
jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(() => 'mock-jwt-token'),
    verify: jest.fn(() => ({ id: 'mock-user-id', role: 'user' }))
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
    hash: jest.fn(() => Promise.resolve('hashed-password')),
    compare: jest.fn(() => Promise.resolve(true))
}));

// Mock rate limiting
jest.mock('express-rate-limit', () => {
    return jest.fn(() => (req, res, next) => next());
});

// Mock multer
jest.mock('multer', () => {
    return jest.fn(() => {
        return {
            single: jest.fn(() => (req, res, next) => {
                req.file = {
                    filename: 'test-image.jpg',
                    path: '/tmp/test-image.jpg',
                    mimetype: 'image/jpeg',
                    size: 1024
                };
                next();
            }),
            array: jest.fn(() => (req, res, next) => {
                req.files = [
                    {
                        filename: 'test-image-1.jpg',
                        path: '/tmp/test-image-1.jpg',
                        mimetype: 'image/jpeg',
                        size: 1024
                    },
                    {
                        filename: 'test-image-2.jpg',
                        path: '/tmp/test-image-2.jpg',
                        mimetype: 'image/jpeg',
                        size: 1024
                    }
                ];
                next();
            })
        };
    });
});

// Mock XSS
jest.mock('xss', () => {
    return jest.fn((input) => input ? input.toString() : '');
});

// Mock sanitizer
jest.mock('../src/Utils/sanitizer', () => ({
    sanitizeInput: jest.fn((input) => input)
}));

// Mock validation
jest.mock('../src/validator/productValidation', () => ({
    createProductValidation: jest.fn(() => ({ error: null })),
    updateProductValidation: jest.fn(() => ({ error: null })),
    createReviewValidation: jest.fn(() => ({ error: null })),
    wishlistValidation: jest.fn(() => ({ error: null }))
}));

// Mock authentication middleware
jest.mock('../src/Middleware/userAuth', () => ({
    authentication: jest.fn((req, res, next) => {
        // Use the token to determine user role and ID
        if (req.headers.authorization) {
            const token = req.headers.authorization.replace('Bearer ', '');
            if (token.startsWith('test-token-')) {
                const userId = token.replace('test-token-', '');
                req.user = {
                    id: userId,
                    role: 'user',
                    isActive: true
                };
            } else if (token.startsWith('seller-token-')) {
                const userId = token.replace('seller-token-', '');
                req.user = {
                    id: userId,
                    role: 'seller',
                    isActive: true
                };
            } else if (token.startsWith('admin-token-')) {
                const userId = token.replace('admin-token-', '');
                req.user = {
                    id: userId,
                    role: 'superadmin',
                    isActive: true
                };
            } else {
                req.user = {
                    id: 'mock-user-id',
                    role: 'user',
                    isActive: true
                };
            }
        } else {
            req.user = {
                id: 'mock-user-id',
                role: 'user',
                isActive: true
            };
        }
        next();
    }),
    isUser: jest.fn((req, res, next) => {
        req.user.role = 'user';
        next();
    }),
    isSeller: jest.fn((req, res, next) => {
        req.user.role = 'seller';
        next();
    }),
    isAdmin: jest.fn((req, res, next) => {
        req.user.role = 'admin';
        next();
    }),
    isSuperAdmin: jest.fn((req, res, next) => {
        req.user.role = 'superadmin';
        next();
    }),
    isCoach: jest.fn((req, res, next) => {
        req.user.role = 'coach';
        next();
    })
}));

// Mock rate limiter middleware
jest.mock('../src/Middleware/rateLimiter', () => ({
    productLimiter: jest.fn((req, res, next) => next()),
    uploadLimiter: jest.fn((req, res, next) => next()),
    reviewLimiter: jest.fn((req, res, next) => next()),
    wishlistLimiter: jest.fn((req, res, next) => next())
}));

// Mock image upload middleware
jest.mock('../src/Middleware/productImageUpload', () => ({
    uploadProductImage: jest.fn((req, res, next) => next()),
    handleProductUploadError: jest.fn((err, req, res, next) => next(err))
}));

// Mock profile image upload middleware
jest.mock('../src/Middleware/uploadProfileUser', () => {
    return jest.fn((req, res, next) => next());
});

// Helper function to create test tokens
global.generateTestToken = (user) => {
    return `test-token-${user._id}`;
};

// Helper function to create test user
global.createTestUser = async (role = 'user') => {
    const User = require('../src/Model/userModel/user');
    return await User.create({
        phone: `123456789${Math.floor(Math.random() * 1000)}`,
        role,
        isActive: true,
        additionalInfo: {
            name: `Test ${role}`,
            email: `test${role}@example.com`
        }
    });
};

// Helper function to create test category
global.createTestCategory = async () => {
    const Category = require('../src/Model/ProductsModel/category');
    return await Category.create({
        name: 'supplement',
        description: 'Test category',
        isActive: true
    });
};

// Helper function to create test product
global.createTestProduct = async (sellerId, categoryId) => {
    const Product = require('../src/Model/ProductsModel/product');
    return await Product.create({
        name: 'Test Product',
        description: 'Test product description',
        price: 100,
        originalPrice: 120,
        quantity: 50,
        category: categoryId,
        sellerId,
        isActive: true,
        brand: 'Test Brand',
        sku: 'TEST001',
        slug: 'test-product'
    });
};

console.log('🧪 Test setup completed');
