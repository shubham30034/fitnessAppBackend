const express = require("express");
const router = express.Router();

// Controller functions
const {
  sendOtp,
  verifyOtp,
  regenerateRefreshToken,
  logout,
  getCurrentUser,
} = require("../../Controller/UserController/authUser");

// Middleware
const { authentication, isUser } = require("../../Middleware/userAuth");

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/refresh-token", regenerateRefreshToken);

// Protected routes
router.post("/logout", authentication, isUser, logout);
router.get("/me", authentication, isUser, getCurrentUser);

module.exports = router;
