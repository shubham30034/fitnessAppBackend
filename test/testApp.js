const express = require('express');
const cors = require('cors');

// Create a test-specific Express app
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Mock the authentication middleware before importing routes
const originalRequire = require;
const mongoose = require('mongoose');

require = function(id) {
    if (id === '../src/Middleware/userAuth') {
        return {
            authentication: (req, res, next) => {
                // Mock user authentication
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
                        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
                    }
                } else {
                    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
                }
                next();
            },
            isAdmin: (req, res, next) => {
                if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });
                if (req.user.role !== 'admin') {
                    return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
                }
                next();
            },
            isSuperAdmin: (req, res, next) => {
                if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });
                if (req.user.role !== 'superadmin') {
                    return res.status(403).json({ success: false, message: 'Forbidden: SuperAdmins only' });
                }
                next();
            },
            isCoach: (req, res, next) => {
                if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });
                if (req.user.role !== 'coach') {
                    return res.status(403).json({ success: false, message: 'Forbidden: Coaches only' });
                }
                next();
            },
            isSeller: (req, res, next) => {
                if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });
                if (req.user.role !== 'seller') {
                    return res.status(403).json({ success: false, message: 'Forbidden: Sellers only' });
                }
                next();
            },
            isUser: (req, res, next) => {
                if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });
                if (req.user.role !== 'user') {
                    return res.status(403).json({ success: false, message: 'Forbidden: Users only' });
                }
                next();
            },
            isCoachManager: (req, res, next) => {
                if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });
                if (req.user.role !== 'coachmanager') {
                    return res.status(403).json({ success: false, message: 'Forbidden: Coach Managers only' });
                }
                next();
            }
        };
    } else if (id === '../src/Middleware/rateLimiter') {
        // Mock rate limiting that actually limits
        const requestCounts = {};
        return {
            productLimiter: (req, res, next) => {
                const key = req.ip || 'unknown';
                requestCounts[key] = (requestCounts[key] || 0) + 1;
                if (requestCounts[key] > 1) { // Very aggressive for testing
                    return res.status(429).json({ 
                        success: false, 
                        message: 'Too many requests' 
                    });
                }
                next();
            },
            uploadLimiter: (req, res, next) => next()
        };
    } else if (id === '../src/Middleware/productImageUpload') {
        return {
            uploadProductImage: (req, res, next) => next(),
            handleProductUploadError: (err, req, res, next) => next()
        };
    }
    return originalRequire.apply(this, arguments);
};

// Import only the product routes for testing
const productRoutes = require('../src/Routes/ProductRoutes/productRoutes');

// Mount product routes
app.use('/api/v1/products', productRoutes);

// Restore original require
require = originalRequire;

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Test server is running',
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint to test authentication
app.get('/debug/auth', (req, res, next) => {
    // Use the mock authentication middleware
    const { authentication } = require('../src/Middleware/userAuth');
    authentication(req, res, next);
}, (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user,
        headers: req.headers.authorization
    });
});

// Debug endpoint to test my-products route
app.get('/debug/my-products', (req, res, next) => {
    // Use the mock authentication middleware
    const { authentication, isSeller } = require('../src/Middleware/userAuth');
    authentication(req, res, (err) => {
        if (err) return next(err);
        isSeller(req, res, (err) => {
            if (err) return next(err);
            res.status(200).json({
                success: true,
                user: req.user,
                message: 'My products route middleware passed'
            });
        });
    });
});





// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Test app error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Error creating product',
        error: process.env.NODE_ENV === 'test' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

module.exports = app;
