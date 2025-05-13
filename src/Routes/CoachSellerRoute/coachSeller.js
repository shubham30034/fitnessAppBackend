const express = require("express");
const route = express.Router();

const {
  loginWithPassword,
  logout,
  getCurrentUser,
  regenerateRefreshToken,
} = require("../../Controller/CoachSellerController/auth");

const {
  authentication,
  isCoach,
  isSeller,
} = require("../../Middleware/userAuth");

// ✅ Login with phone and password (for Coach or Seller)
route.post("/login", loginWithPassword);

// ✅ Logout the current session
route.post("/logout", authentication, logout);

// ✅ Get current authenticated user details
route.get("/me", authentication, getCurrentUser);

// ✅ Regenerate a new refresh token
route.post("/refresh-token", regenerateRefreshToken);

module.exports = route;
