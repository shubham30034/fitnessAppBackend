// src/utils/asyncHandler.js

/**
 * Wrap async route handlers and forward errors to Express error middleware.
 * Usage:
 * router.get("/", asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
