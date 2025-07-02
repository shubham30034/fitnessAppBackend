const express = require('express');
const router = express.Router();
const {
  subscribeToCoach,
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
} = require('../../Controller/CoachingSession/coach');

// Example middleware for authentication and role check
const { authentication,isAdmin,isCoach,isSeller,isSuperAdmin,isUser } = require('../../Middleware/userAuth');

// ---------- USER ROUTES ----------
router.get('/coaches', authentication, getAllCoaches); 
router.get('/coaches/:coachId', authentication, getCoachById);
router.post('/subscribe',isUser, authentication, subscribeToCoach);
router.get('/today-session', authentication, getTodaysSession);

// ---------- COACH ROUTES ----------
router.get('/coach/upcoming-sessions', authentication, getUpcomingCoachSessions);
router.get('/coach/schedule', authentication, getCoachSchedule);
router.get('/coach/clients', authentication, getMyClients);

// chron job to generate Zoom sessions
// Uncomment the line below to manually trigger session generation
router.post('/coach/generate-sessions', authentication, triggerSessionGeneration); 

// ---------- SUPERADMIN ROUTES ----------
router.post('/superadmin/schedule', authentication, createCoachSchedule);
router.put('/superadmin/schedule/:scheduleId', authentication, editCoachSchedule);

// ---------- ZOOM AUTH ----------
router.get('/zoom/connect', connectZoom);
router.get('/zoom/callback', zoomCallback); // No auth needed for callback
router.get('/zoom/status', authentication, getZoomConnectionStatus);
router.delete('/zoom/disconnect', authentication, disconnectZoom);

module.exports = router;
