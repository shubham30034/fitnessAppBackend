const express = require('express');
const router = express.Router();

// Import controller functions
const {
  // Coach Management
  createCoach,
  getAllCoaches,
  getCoachById,
  updateCoach,
  deleteCoach,
  
  // Student Management
  getCoachStudents,
  getAllStudents,
  
  // Financial Management
  getFinancialOverview,
  getCoachFinancialData,
  
  // Schedule Management
  manageCoachSchedule,
  getCoachSchedule,
  
  // Coach Fee Management
  updateCoachFee,
  getCoachFee,
  getAllCoachesWithFees,
  createCoachProfile,
  updateCoachProfile,
  deleteCoachProfile,
  getCoachProfile,
  getAllCoachProfiles,
  addCoachCertification,
  removeCoachCertification,
  updateCoachRating,
  updateCoachStatistics,
  toggleCoachStatus
} = require('../../Controller/CoachManagerController/coachManager');

// Import middleware
const { authentication, isCoachManager, isSuperAdmin } = require('../../Middleware/userAuth');

// Apply authentication and authorization to all routes - allow both Coach Manager and Super Admin
router.use(authentication, (req, res, next) => {
  if (req.user.role === 'coachmanager' || req.user.role === 'superadmin') {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Forbidden: Only Coach Managers or Super Admins can access this resource' 
    });
  }
});

// ===================== COACH MANAGEMENT ROUTES =====================

// Create a new coach
router.post('/coaches', createCoach);

// Get all coaches
router.get('/coaches', getAllCoaches);

// Get all coaches with their fees
router.get('/coaches-with-fees', getAllCoachesWithFees);

// Get coach by ID
router.get('/coaches/:coachId', getCoachById);

// Update coach information
router.put('/coaches/:coachId', updateCoach);

// Delete coach
router.delete('/coaches/:coachId', deleteCoach);

// ===================== COACH FEE MANAGEMENT ROUTES =====================

// Update coach session fee
router.put('/coaches/:coachId/fee', updateCoachFee);

// Get coach fee
router.get('/coaches/:coachId/fee', getCoachFee);

// ===================== COACH PROFILE MANAGEMENT ROUTES =====================

// Get all coach profiles with pagination and filtering
router.get('/coach-profiles', getAllCoachProfiles);

// Create coach profile
router.post('/coaches/:coachId/profile', createCoachProfile);

// Get coach profile
router.get('/coaches/:coachId/profile', getCoachProfile);

// Update coach profile
router.put('/coaches/:coachId/profile', updateCoachProfile);

// Delete coach profile
router.delete('/coaches/:coachId/profile', deleteCoachProfile);

// ===================== COACH CERTIFICATION MANAGEMENT ROUTES =====================

// Add coach certification
router.post('/coaches/:coachId/certifications', addCoachCertification);

// Remove coach certification
router.delete('/coaches/:coachId/certifications/:certificationId', removeCoachCertification);

// ===================== COACH RATING & STATISTICS ROUTES =====================

// Update coach rating
router.put('/coaches/:coachId/rating', updateCoachRating);

// Update coach statistics
router.put('/coaches/:coachId/statistics', updateCoachStatistics);

// Toggle coach active status
router.patch('/coaches/:coachId/status', toggleCoachStatus);

// ===================== STUDENT MANAGEMENT ROUTES =====================

// Get all students for a specific coach
router.get('/coaches/:coachId/students', getCoachStudents);

// Get all students across all coaches
router.get('/students', getAllStudents);

// ===================== FINANCIAL MANAGEMENT ROUTES =====================

// Get financial overview for all coaches
router.get('/financial/overview', getFinancialOverview);

// Get detailed financial data for a specific coach
router.get('/coaches/:coachId/financial', getCoachFinancialData);

// ===================== SCHEDULE MANAGEMENT ROUTES =====================

// Create or update coach schedule
router.post('/coaches/:coachId/schedule', manageCoachSchedule);

// Get coach schedule
router.get('/coaches/:coachId/schedule', getCoachSchedule);

module.exports = router;
