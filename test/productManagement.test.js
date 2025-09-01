const request = require('supertest');
const mongoose = require('mongoose');
const app = require('./testApp'); // Test-specific app
const Product = require('../src/Model/ProductsModel/product');
const Category = require('../src/Model/ProductsModel/category');

const User = require('../src/Model/userModel/userModel');
const UserAdditionalInfo = require('../src/Model/userModel/additionalInfo');

describe('Product Management API Tests', () => {
    let testUser, testSeller, testSuperAdmin, testCategory, testProduct;
    let userToken, sellerToken, superAdminToken;

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/fitness_test');
        
        // Clean up test data
        await Product.deleteMany({});
        await Category.deleteMany({});
        await User.deleteMany({});
        await UserAdditionalInfo.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Create test users first
        testUser = await User.create({
            phone: '1234567890',
            role: 'user',
            isActive: true
        });

        testSeller = await User.create({
            phone: '9876543210',
            role: 'seller',
            isActive: true
        });

        testSuperAdmin = await User.create({
            phone: '5555555555',
            role: 'superadmin',
            isActive: true
        });

        // Create additional info with userId references
        const userAdditionalInfo = await UserAdditionalInfo.create({
            name: 'Test User',
            email: 'testuser@example.com',
            userId: testUser._id
        });

        const sellerAdditionalInfo = await UserAdditionalInfo.create({
            name: 'Test Seller',
            email: 'testseller@example.com',
            userId: testSeller._id
        });

        const superAdminAdditionalInfo = await UserAdditionalInfo.create({
            name: 'Test SuperAdmin',
            email: 'testsuperadmin@example.com',
            userId: testSuperAdmin._id
        });

        // Update users with additionalInfo references
        await User.findByIdAndUpdate(testUser._id, { additionalInfo: userAdditionalInfo._id });
        await User.findByIdAndUpdate(testSeller._id, { additionalInfo: sellerAdditionalInfo._id });
        await User.findByIdAndUpdate(testSuperAdmin._id, { additionalInfo: superAdminAdditionalInfo._id });

        // Create test category
        testCategory = await Category.create({
            name: 'supplement',
            description: 'Test category',
            isActive: true
        });

        // Create test product
        testProduct = await Product.create({
            name: 'Test Product',
            description: 'Test product description',
            price: 100,
            originalPrice: 120,
            quantity: 50,
            category: testCategory._id,
            sellerId: testSeller._id,
            isActive: true,
            brand: 'Test Brand',
            sku: 'TEST001',
            slug: 'test-product'
        });

        // Generate tokens with actual user IDs
        userToken = generateTestToken(testUser);
        sellerToken = generateTestToken(testSeller);
        superAdminToken = generateTestToken(testSuperAdmin);
    });

    afterEach(async () => {
        // Clean up after each test
        await Product.deleteMany({});
        await Category.deleteMany({});
        await User.deleteMany({});
        await UserAdditionalInfo.deleteMany({});
    });

    // Helper function to generate test tokens
    function generateTestToken(user) {
        // Generate tokens with role-specific prefixes
        if (user.role === 'seller') {
            return `seller-token-${user._id}`;
        } else if (user.role === 'superadmin') {
            return `admin-token-${user._id}`;
        } else {
            return `test-token-${user._id}`;
        }
    }

    // ======================= DEBUG TESTS =======================

    describe('Debug Tests', () => {
        test('GET /debug/auth - Test authentication', async () => {
            const response = await request(app)
                .get('/debug/auth')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
        });

        test('GET /debug/my-products - Test my-products route middleware', async () => {
            const response = await request(app)
                .get('/debug/my-products')
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
            expect(response.body.message).toBe('My products route middleware passed');
        });




    });

    // ======================= PRODUCT MANAGEMENT TESTS =======================

    describe('Product CRUD Operations', () => {
        test('POST /api/v1/products - Create product (Seller)', async () => {
            const productData = {
                name: 'New Test Product',
                description: 'New test product description',
                price: 150,
                originalPrice: 180,
                quantity: 25,
                category: testCategory._id,
                brand: 'New Brand',
                weight: 500,
                dimensions: {
                    length: 10,
                    width: 5,
                    height: 3
                },
                lowStockThreshold: 5
            };

            const response = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send(productData)
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(productData.name);
            expect(response.body.data.sku).toBeDefined();
            expect(response.body.data.slug).toBeDefined();
        });

        test('GET /api/v1/products/my-products - Get seller products', async () => {
            const response = await request(app)
                .get('/api/v1/products/my-products')
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.products).toBeInstanceOf(Array);
            expect(response.body.data.analytics).toBeDefined();
        });

        test('PUT /api/v1/products/:id - Update product (Seller)', async () => {
            const updateData = {
                name: 'Updated Test Product',
                price: 200,
                quantity: 75
            };

            const response = await request(app)
                .put(`/api/v1/products/${testProduct._id}`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updateData.name);
        });

        test('DELETE /api/v1/products/:id - Delete product (Seller)', async () => {
            const response = await request(app)
                .delete(`/api/v1/products/${testProduct._id}`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });





    // ======================= SUPERADMIN PRODUCT MANAGEMENT TESTS =======================

    describe('SuperAdmin Product Management', () => {
        test('GET /api/v1/products/admin/all - Get all products for admin', async () => {
            const response = await request(app)
                .get('/api/v1/products/admin/all')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.products).toBeInstanceOf(Array);
            expect(response.body.data.analytics).toBeDefined();
        });

        test('GET /api/v1/products/admin/analytics - Get product analytics', async () => {
            const response = await request(app)
                .get('/api/v1/products/admin/analytics?period=30')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.topProducts).toBeDefined();
            expect(response.body.data.categoryPerformance).toBeDefined();
            expect(response.body.data.sellerPerformance).toBeDefined();
        });

        test('PUT /api/v1/products/admin/bulk-status - Bulk update product status', async () => {
            const bulkUpdateData = {
                productIds: [testProduct._id],
                isActive: false,
                isFeatured: true
            };

            const response = await request(app)
                .put('/api/v1/products/admin/bulk-status')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(bulkUpdateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.modifiedCount).toBe(1);
        });

        test('GET /api/v1/products/admin/:productId - Get product details for admin', async () => {
            const response = await request(app)
                .get(`/api/v1/products/admin/${testProduct._id}`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.product).toBeDefined();
            expect(response.body.data.analytics).toBeDefined();
        });
    });

    // ======================= SELLER PRODUCT MANAGEMENT TESTS =======================

    describe('Seller Product Management', () => {
        test('GET /api/v1/products/seller/analytics - Get seller analytics', async () => {
            const response = await request(app)
                .get('/api/v1/products/seller/analytics?period=30')
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.summary).toBeDefined();
            expect(response.body.data.productPerformance).toBeDefined();
        });

        test('GET /api/v1/products/seller/performance/:productId - Get product performance', async () => {
            const response = await request(app)
                .get(`/api/v1/products/seller/performance/${testProduct._id}`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.product).toBeDefined();
            expect(response.body.data.performance).toBeDefined();
            expect(response.body.data.sales).toBeDefined();
        });

        test('PATCH /api/v1/products/seller/:productId/status - Update product status', async () => {
            const statusData = {
                isActive: false,
                isFeatured: true
            };

            const response = await request(app)
                .patch(`/api/v1/products/seller/${testProduct._id}/status`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .send(statusData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.isActive).toBe(statusData.isActive);
            expect(response.body.data.isFeatured).toBe(statusData.isFeatured);
        });
    });

    // ======================= ERROR HANDLING TESTS =======================

    describe('Error Handling', () => {
        test('Create product with invalid data - should return 400', async () => {
            // Mock validation to return error for invalid data
            const { createProductValidation } = require('../src/validator/productValidation');
            createProductValidation.mockReturnValueOnce({
                error: {
                    details: [{ message: 'Validation failed' }]
                }
            });

            const invalidData = {
                name: '', // Invalid: empty name
                price: -100, // Invalid: negative price
                quantity: 0 // Invalid: zero quantity
            };

            const response = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        test('Access protected route without token - should return 401', async () => {
            const response = await request(app)
                .get('/api/v1/products/my-products')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        test('Access seller route with user token - should return 403', async () => {
            const response = await request(app)
                .get('/api/v1/products/my-products')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
        });


    });

    // ======================= RATE LIMITING TESTS =======================

    describe('Rate Limiting', () => {
        test('Rate limiting on product creation', async () => {
            const productData = {
                name: 'Rate Limit Test Product',
                description: 'Testing rate limits',
                price: 100,
                quantity: 10,
                category: testCategory._id
            };

            // Make multiple requests quickly
            const promises = Array(10).fill().map(() =>
                request(app)
                    .post('/api/v1/products')
                    .set('Authorization', `Bearer ${sellerToken}`)
                    .send(productData)
            );

            const responses = await Promise.all(promises);
            
            // At least one should be rate limited (429)
            const rateLimited = responses.some(res => res.status === 429);
            expect(rateLimited).toBe(true);
        });
    });

    // ======================= PAGINATION TESTS =======================

    describe('Pagination', () => {
        test('Get products with pagination', async () => {
            // Create multiple products
            const products = Array(15).fill().map((_, i) => ({
                name: `Product ${i + 1}`,
                description: `Description ${i + 1}`,
                price: 100 + i,
                quantity: 10,
                category: testCategory._id,
                sellerId: testSeller._id,
                isActive: true
            }));

            await Product.insertMany(products);

            const response = await request(app)
                .get('/api/v1/products?page=1&limit=10')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.data.pagination.currentPage).toBe(1);
            expect(response.body.data.pagination.limit).toBe(10);
            expect(response.body.data.pagination.totalPages).toBe(2);
            expect(response.body.data.products).toHaveLength(10);
        });
    });

    // ======================= FILTERING AND SORTING TESTS =======================

    describe('Filtering and Sorting', () => {
        test('Filter products by category', async () => {
            const response = await request(app)
                .get(`/api/v1/products?category=${testCategory._id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.data.products).toBeInstanceOf(Array);
            response.body.data.products.forEach(product => {
                expect(product.category._id).toBe(testCategory._id.toString());
            });
        });

        test('Sort products by price', async () => {
            const response = await request(app)
                .get('/api/v1/products?sortBy=price&sortOrder=asc')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.data.products).toBeInstanceOf(Array);
            const prices = response.body.data.products.map(p => p.price);
            expect(prices).toEqual([...prices].sort((a, b) => a - b));
        });
    });
});
