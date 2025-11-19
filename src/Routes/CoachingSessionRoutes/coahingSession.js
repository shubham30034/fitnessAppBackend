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
  // Subscription expiration management
  manualSubscriptionCleanup,
  getSubscriptionExpirationStats,
  // SuperAdmin coaching sessions management
  getAllSessionsForSuperAdmin,
  getSessionsByDateRangeForSuperAdmin,
  getSessionsByCoachForSuperAdmin,
  getSessionsByStatusForSuperAdmin,
  updateSessionStatusForSuperAdmin,
  deleteSessionForSuperAdmin,
  bulkUpdateSessionsForSuperAdmin,
  bulkDeleteSessionsForSuperAdmin,
  getCoachingSessionsAnalyticsForSuperAdmin,
  getCoachingSessionsStatsForSuperAdmin,
  getCoachingSessionsDashboardForSuperAdmin,
  exportSessionsDataForSuperAdmin,
  generateSessionsForCoachForSuperAdmin,
  generateSessionsForAllCoachesForSuperAdmin,
  getCoachingSessionsDiagnostics,
  createCoachSchedules,
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

// Subscription expiration management (Admin only)
router.post('/admin/subscription-cleanup', authentication, isSuperAdmin, manualSubscriptionCleanup);
router.get('/admin/subscription-stats', authentication, isSuperAdmin, getSubscriptionExpirationStats);

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

// ===================== SUPERADMIN COACHING SESSIONS MANAGEMENT =====================
router.get('/superadmin/sessions', authentication, isSuperAdmin, getAllSessionsForSuperAdmin);
router.get('/superadmin/sessions/date-range', authentication, isSuperAdmin, getSessionsByDateRangeForSuperAdmin);
router.get('/superadmin/sessions/coach/:coachId', authentication, isSuperAdmin, getSessionsByCoachForSuperAdmin);
router.get('/superadmin/sessions/status/:status', authentication, isSuperAdmin, getSessionsByStatusForSuperAdmin);
router.put('/superadmin/sessions/:sessionId/status', authentication, isSuperAdmin, updateSessionStatusForSuperAdmin);
router.delete('/superadmin/sessions/:sessionId', authentication, isSuperAdmin, deleteSessionForSuperAdmin);
router.post('/superadmin/sessions/bulk-update', authentication, isSuperAdmin, bulkUpdateSessionsForSuperAdmin);
router.delete('/superadmin/sessions/bulk-delete', authentication, isSuperAdmin, bulkDeleteSessionsForSuperAdmin);
router.get('/superadmin/analytics', authentication, isSuperAdmin, getCoachingSessionsAnalyticsForSuperAdmin);
router.get('/superadmin/stats', authentication, isSuperAdmin, getCoachingSessionsStatsForSuperAdmin);
router.get('/superadmin/dashboard', authentication, isSuperAdmin, getCoachingSessionsDashboardForSuperAdmin);
router.get('/superadmin/diagnostics', authentication, isSuperAdmin, getCoachingSessionsDiagnostics);
router.get('/superadmin/export', authentication, isSuperAdmin, exportSessionsDataForSuperAdmin);
router.post('/superadmin/generate-sessions/:coachId', authentication, isSuperAdmin, generateSessionsForCoachForSuperAdmin);
router.post('/superadmin/generate-all-sessions', authentication, isSuperAdmin, generateSessionsForAllCoachesForSuperAdmin);
router.post('/superadmin/create-coach-schedules', authentication, isSuperAdmin, createCoachSchedules);

// ---------- ZOOM AUTH ----------
router.get('/zoom/connect', connectZoom);
router.get('/zoom/callback', zoomCallback); // No auth needed for callback
router.get('/zoom/status', authentication, getZoomConnectionStatus);
router.delete('/zoom/disconnect', authentication, disconnectZoom);

module.exports = router;
