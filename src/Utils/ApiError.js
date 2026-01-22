// src/utils/ApiError.js

class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (400, 401, 404, 500 etc.)
   * @param {string} message - Error message
   * @param {Array} errors - Optional: validation errors array
   * @param {boolean} isOperational - Whether error is expected/handled type
   */
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    isOperational = true
  ) {
    super(message);

    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    this.isOperational = isOperational;

    // capture stack trace properly
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
