const express = require("express");
const route = express.Router();

const {
  loginWithPassword,
  signupWithPassword,
  loginOfficial,
  logout,
  getCurrentUser,
  regenerateRefreshToken,
  getMe,
  // Coach-specific operations
  getCoachProfile,
  updateCoachProfile,
  getCoachDashboard,
  getCoachAnalytics,
  getCoachClients,
  // Coach chat functionality
  getCoachChatRooms,
  getChatMessages,
  sendMessage,
  createChatRoom
} = require("../../Controller/CoachSellerController/auth");

const {
  authentication,
  isCoach,
  isSeller,
} = require("../../Middleware/userAuth");

// ✅ Login with phone and password (for Coach or Seller)
route.post("/login", loginWithPassword);

// ✅ Signup for coach or seller (consider restricting in production)
route.post("/signup", signupWithPassword);

// ✅ Admin/Superadmin login
route.post("/official-login", loginOfficial);

// ✅ Get current authenticated user details (for Coach or Seller)
route.get("/me", authentication, getMe);

// ✅ Logout the current session
route.post("/logout", authentication, logout);

// ✅ Regenerate a new refresh token
route.post("/refresh-token", regenerateRefreshToken);

// ===================== COACH-SPECIFIC ROUTES =====================

// ✅ Get coach profile (for coach users)
route.get("/coach/profile", authentication, isCoach, getCoachProfile);

// ✅ Update coach profile (for coach users)
route.put("/coach/profile", authentication, isCoach, updateCoachProfile);

// ✅ Get coach dashboard (for coach users)
route.get("/coach/dashboard", authentication, isCoach, getCoachDashboard);

// ✅ Get coach analytics (for coach users)
route.get("/coach/analytics", authentication, isCoach, getCoachAnalytics);

// ✅ Get coach clients (for coach users)
route.get("/coach/clients", authentication, isCoach, getCoachClients);

// ===================== COACH CHAT ROUTES =====================

// ✅ Get coach chat rooms (for coach users)
route.get("/coach/chat-rooms", authentication, isCoach, getCoachChatRooms);

// ✅ Get chat messages for a specific room (for coach users)
route.get("/coach/chat-rooms/:roomId/messages", authentication, isCoach, getChatMessages);

// ✅ Send message in chat room (for coach users)
route.post("/coach/chat-rooms/:roomId/messages", authentication, isCoach, sendMessage);

// ✅ Create chat room with a client (for coach users)
route.post("/coach/chat-rooms", authentication, isCoach, createChatRoom);

module.exports = route;
