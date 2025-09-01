const xss = require('xss');

// Sanitize user inputs to prevent XSS attacks
exports.sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return xss(input.trim());
  }
  return input;
};

// Sanitize object recursively
exports.sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return this.sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => this.sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = this.sanitizeObject(value);
  }
  return sanitized;
};

// Validate and sanitize phone number
exports.sanitizePhone = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters except +
  let sanitized = phone.replace(/[^\d+]/g, '');
  
  // Handle +91 prefix
  if (sanitized.startsWith('+91')) {
    sanitized = sanitized.substring(3);
  }
  
  // Ensure exactly 10 digits
  if (sanitized.length === 10 && /^\d{10}$/.test(sanitized)) {
    return sanitized;
  }
  
  return null;
};

// Validate and sanitize email
exports.sanitizeEmail = (email) => {
  if (!email) return null;
  
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(sanitized) ? sanitized : null;
};
