// Security configuration for the fitness app
module.exports = {
  // JWT Configuration
  jwt: {
    accessTokenExpiry: '1d',
    refreshTokenExpiry: '30d',
    issuer: 'fitness-app',
    audience: 'fitness-app-users',
  },

  // OTP Configuration
  otp: {
    length: 4,
    expiryMinutes: 10,
    cooldownSeconds: 60,
    maxFailedAttempts: 5,
    failedAttemptWindowMinutes: 15,
  },

  // Rate Limiting
  rateLimit: {
    otpRequests: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1,
    },
    otpVerification: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxFailedAttempts: 5,
    },
    loginAttempts: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
    },
  },

  // Password Policy (for other user types)
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  // Session Management
  session: {
    maxConcurrentSessions: 3,
    sessionTimeoutMinutes: 30,
  },

  // Security Headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
  },
};
