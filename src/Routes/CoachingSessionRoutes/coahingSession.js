const express = require('express');
const router = express.Router();
const {
  getTodaysSession,
  getUpcomingCoachSessions,
  getCoachSchedule,
  createCoachSchedule,
  editCoachSchedule,
  connectZoom,
  zoomCallback,
  getZoomConnectionStatus,
  disconnectZoom,
  getAllCoaches,
  getCoachById,
  getMyClients,
  triggerSessionGeneration, // Uncomment this line if you want to use manual session generation
  getMySubscription,
  cancelSubscription,
  getUserUpcomingSessions,
  // New coach functionality
  getCoachProfile,
  updateCoachProfile,
  getCoachDashboard,
  getCoachAnalytics,
  getSessionDetails,
  cancelSession,
  getClientDetails,
  getCoachNotifications,
  // In-app purchase functionality
  verifyAppleReceipt,
  verifyGooglePurchase,
  getUserSubscriptions,
  cancelInAppSubscription,
  getCoachProducts,
} = require('../../Controller/CoachingSession/coach');

// Example middleware for authentication and role check
const { authentication,isAdmin,isCoach,isSeller,isSuperAdmin,isUser } = require('../../Middleware/userAuth');

// ---------- USER ROUTES ----------
router.get('/coaches', authentication, getAllCoaches); 
router.get('/coaches/:coachId', authentication, getCoachById);
// Note: /subscribe route removed - use in-app purchase endpoints instead
router.get('/today-session', authentication, getTodaysSession);
router.get('/my-subscription', authentication, isUser, getMySubscription);
router.post('/cancel-subscription', authentication, isUser, cancelSubscription);
router.get('/upcoming-sessions', authentication, isUser, getUserUpcomingSessions);

// ===================== IN-APP PURCHASE ROUTES =====================

// Apple App Store purchase verification
router.post('/inapp/apple/verify-receipt', authentication, verifyAppleReceipt);

// Google Play Store purchase verification
router.post('/inapp/google/verify-purchase', authentication, verifyGooglePurchase);

// Subscription management
router.get('/inapp/subscriptions/:userId', authentication, getUserSubscriptions);
router.put('/inapp/subscriptions/:subscriptionId/cancel', authentication, cancelInAppSubscription);

// Product management
router.get('/inapp/products/coach/:coachId', getCoachProducts);
router.get('/inapp/products', getCoachProducts);

// ---------- COACH ROUTES ----------
router.get('/coach/upcoming-sessions', authentication, isCoach, getUpcomingCoachSessions);
router.get('/coach/schedule', authentication, isCoach, getCoachSchedule);
router.get('/coach/clients', authentication, isCoach, getMyClients);

// chron job to generate Zoom sessions
// Uncomment the line below to manually trigger session generation
router.post('/coach/generate-sessions', authentication, isCoach, triggerSessionGeneration);

// ===================== COACH PROFILE MANAGEMENT =====================
router.get('/coach/profile', authentication, isCoach, getCoachProfile);
router.put('/coach/profile', authentication, isCoach, updateCoachProfile);

// ===================== COACH DASHBOARD =====================
router.get('/coach/dashboard', authentication, isCoach, getCoachDashboard);
router.get('/coach/analytics', authentication, isCoach, getCoachAnalytics);

// ===================== SESSION MANAGEMENT =====================
router.get('/coach/sessions/:sessionId', authentication, isCoach, getSessionDetails);
router.delete('/coach/sessions/:sessionId', authentication, isCoach, cancelSession);

// ===================== CLIENT MANAGEMENT =====================
router.get('/coach/clients/:clientId', authentication, isCoach, getClientDetails);

// ===================== COACH NOTIFICATIONS =====================
router.get('/coach/notifications', authentication, isCoach, getCoachNotifications); 

// ---------- SUPERADMIN ROUTES ----------
router.post('/superadmin/schedule', authentication, isSuperAdmin, createCoachSchedule);
router.put('/superadmin/schedule/:scheduleId', authentication, isSuperAdmin, editCoachSchedule);

// ---------- ZOOM AUTH ----------
router.get('/zoom/connect', connectZoom);
router.get('/zoom/callback', zoomCallback); // No auth needed for callback
router.get('/zoom/status', authentication, getZoomConnectionStatus);
router.delete('/zoom/disconnect', authentication, disconnectZoom);

module.exports = router;
