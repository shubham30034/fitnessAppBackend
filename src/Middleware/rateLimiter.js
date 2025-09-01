const rateLimit = require('express-rate-limit');

// Rate limiter for product operations
const productLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for image uploads
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // limit each IP to 50 uploads per hour
    message: {
        success: false,
        message: 'Too many upload requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for reviews
const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 reviews per hour
    message: {
        success: false,
        message: 'Too many review submissions from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for wishlist operations
const wishlistLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 wishlist operations per 15 minutes
    message: {
        success: false,
        message: 'Too many wishlist operations from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    productLimiter,
    uploadLimiter,
    reviewLimiter,
    wishlistLimiter
};
