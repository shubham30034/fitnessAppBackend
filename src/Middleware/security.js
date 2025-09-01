const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { sanitizeObject } = require('../Utils/sanitizer');
const securityConfig = require('../Config/security');

// Rate limiting for OTP requests
exports.otpRateLimit = rateLimit({
  windowMs: securityConfig.rateLimit.otpRequests.windowMs,
  max: securityConfig.rateLimit.otpRequests.maxRequests,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait before requesting another.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for login attempts
exports.loginRateLimit = rateLimit({
  windowMs: securityConfig.rateLimit.loginAttempts.windowMs,
  max: securityConfig.rateLimit.loginAttempts.maxAttempts,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers middleware
exports.securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Input sanitization middleware
exports.sanitizeInputs = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

// Request logging middleware
exports.requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  
  next();
};

// CORS configuration
exports.corsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Prevent parameter pollution
exports.preventParameterPollution = (req, res, next) => {
  // Remove duplicate parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][0]; // Take first value
      }
    });
  }
  next();
};
