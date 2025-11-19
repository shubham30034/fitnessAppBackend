const express = require("express");
const router = express.Router();

// Controller functions
const {
 createUser,
  getAllUsers,
  deleteUser,
  getAllInvoices,
  getOfficals,
  getAllCoachesDetailed,
  getCoachDetailed,
  getAllStudentsDetailed,
  // getFinancialOverview, // Removed - using CoachManager endpoint instead
  getCoachFinancialData,
  forceDeleteCoach,
  getSystemOverview,
  createCoachSchedule,
  editCoachSchedule,
  getAllCoachSchedules,
  // Seller management
  getAllSellers,
  getSellerDetailed,
  deleteSeller,
  updateSeller,
  // Seller financial management
  getAllSellersFinancial,
  getSellerFinancialData,
  getComprehensiveFinancialOverview,
  getSellerPerformanceAnalytics,
  // Coach schedule sale management
  createCoachScheduleSale,
  getAllCoachScheduleSales,
  getCoachScheduleSale,
  updateCoachScheduleSale,
  deleteCoachScheduleSale,
  getCoachScheduleSalesAnalytics,
  // Coach fee management
  updateCoachFee,
  getCoachFee,
  getAllCoachesWithFees,
  bulkUpdateCoachFees,
  // Coach profile management
  createCoachProfile,
  updateCoachProfile,
  getCoachProfile,
  deleteCoachProfile,
  getAllCoachProfiles,
  // Coach certification management
  addCoachCertification,
  removeCoachCertification,
  // Coach rating & statistics
  updateCoachRating,
  updateCoachStatistics,
  toggleCoachStatus
} = require("../../Controller/SuperAdminController/superAdmin");

// Product Management Controllers
const {
  getAllProductsForAdmin,
  getProductAnalytics,
  bulkUpdateProductStatus,
  getProductDetailsForAdmin,
  updateProductForAdmin,
  deleteProductForAdmin,
  exportProductsAsPDF
} = require("../../Controller/ProductsController/productManagementController");

// Middleware to protect super admin routes
const { authentication, isSuperAdmin } = require("../../Middleware/userAuth");

// Rate Limiting
const { productLimiter } = require("../../Middleware/rateLimiter");

// Protected routes for Super Admin
router.post("/create-user", authentication, isSuperAdmin, createUser);
router.get("/users", authentication, isSuperAdmin, getAllUsers);
router.get("/officals", authentication, isSuperAdmin, getOfficals);
router.delete("/user/:id", authentication, isSuperAdmin, deleteUser);
router.get("/invoices", authentication, isSuperAdmin, getAllInvoices);

// ===================== SUPER ADMIN COACH MANAGEMENT =====================
router.get("/coaches", authentication, isSuperAdmin, getAllCoachesDetailed);
router.get("/coaches-with-fees", authentication, isSuperAdmin, getAllCoachesWithFees);
router.post("/coaches/bulk-update-fees", authentication, isSuperAdmin, bulkUpdateCoachFees);
router.get("/coaches/:coachId", authentication, isSuperAdmin, getCoachDetailed);
router.delete("/coaches/:coachId/force", authentication, isSuperAdmin, forceDeleteCoach);

// ===================== SUPER ADMIN COACH FEE MANAGEMENT =====================
router.put("/coaches/:coachId/fee", authentication, isSuperAdmin, updateCoachFee);
router.get("/coaches/:coachId/fee", authentication, isSuperAdmin, getCoachFee);

// ===================== SUPER ADMIN COACH PROFILE MANAGEMENT =====================
router.get("/coach-profiles", authentication, isSuperAdmin, getAllCoachProfiles);
router.post("/coaches/:coachId/profile", authentication, isSuperAdmin, createCoachProfile);
router.get("/coaches/:coachId/profile", authentication, isSuperAdmin, getCoachProfile);
router.put("/coaches/:coachId/profile", authentication, isSuperAdmin, updateCoachProfile);
router.delete("/coaches/:coachId/profile", authentication, isSuperAdmin, deleteCoachProfile);

// ===================== SUPER ADMIN COACH CERTIFICATION MANAGEMENT =====================
router.post("/coaches/:coachId/certifications", authentication, isSuperAdmin, addCoachCertification);
router.delete("/coaches/:coachId/certifications/:certificationId", authentication, isSuperAdmin, removeCoachCertification);

// ===================== SUPER ADMIN COACH RATING & STATISTICS =====================
router.put("/coaches/:coachId/rating", authentication, isSuperAdmin, updateCoachRating);
router.put("/coaches/:coachId/statistics", authentication, isSuperAdmin, updateCoachStatistics);
router.patch("/coaches/:coachId/status", authentication, isSuperAdmin, toggleCoachStatus);

// ===================== SUPER ADMIN STUDENT MANAGEMENT =====================
router.get("/students", authentication, isSuperAdmin, getAllStudentsDetailed);

// ===================== SUPER ADMIN FINANCIAL MANAGEMENT =====================
// Removed /financial/overview route - now using CoachManager endpoint for accurate revenue calculation
router.get("/coaches/:coachId/financial", authentication, isSuperAdmin, getCoachFinancialData);

// ===================== SUPER ADMIN SYSTEM OVERVIEW =====================
router.get("/system/overview", authentication, isSuperAdmin, getSystemOverview);

// ===================== SUPER ADMIN SCHEDULE MANAGEMENT =====================
router.get("/coach-schedules", authentication, isSuperAdmin, getAllCoachSchedules);
router.post("/coach-schedule", authentication, isSuperAdmin, createCoachSchedule);
router.put("/coach-schedule/:scheduleId", authentication, isSuperAdmin, editCoachSchedule);

// ===================== SUPER ADMIN SELLER FINANCIAL MANAGEMENT =====================
router.get("/sellers/financial", authentication, isSuperAdmin, getAllSellersFinancial);
router.get("/sellers/analytics", authentication, isSuperAdmin, getSellerPerformanceAnalytics);

// ===================== SUPER ADMIN SELLER MANAGEMENT =====================
router.get("/sellers", authentication, isSuperAdmin, getAllSellers);
router.get("/sellers/:sellerId", authentication, isSuperAdmin, getSellerDetailed);
router.put("/sellers/:sellerId", authentication, isSuperAdmin, updateSeller);
router.delete("/sellers/:sellerId", authentication, isSuperAdmin, deleteSeller);
router.get("/sellers/:sellerId/financial", authentication, isSuperAdmin, getSellerFinancialData);

// ===================== SUPER ADMIN COMPREHENSIVE FINANCIAL =====================
router.get("/financial/comprehensive", authentication, isSuperAdmin, getComprehensiveFinancialOverview);

// ===================== SUPER ADMIN COACH SCHEDULE SALE MANAGEMENT =====================
router.get("/coach-schedule-sales", authentication, isSuperAdmin, getAllCoachScheduleSales);
router.get("/coach-schedule-sales/analytics", authentication, isSuperAdmin, getCoachScheduleSalesAnalytics);
router.post("/coach-schedule-sales", authentication, isSuperAdmin, createCoachScheduleSale);
router.get("/coach-schedule-sales/:saleId", authentication, isSuperAdmin, getCoachScheduleSale);
router.put("/coach-schedule-sales/:saleId", authentication, isSuperAdmin, updateCoachScheduleSale);
router.delete("/coach-schedule-sales/:saleId", authentication, isSuperAdmin, deleteCoachScheduleSale);

// ===================== SUPER ADMIN PRODUCT MANAGEMENT =====================
router.get("/products", authentication, isSuperAdmin, productLimiter, getAllProductsForAdmin);
router.get("/products/analytics", authentication, isSuperAdmin, productLimiter, getProductAnalytics);
router.get("/products/export/pdf", authentication, isSuperAdmin, productLimiter, exportProductsAsPDF);
router.put("/products/bulk-status", authentication, isSuperAdmin, productLimiter, bulkUpdateProductStatus);
router.get("/products/:productId", authentication, isSuperAdmin, productLimiter, getProductDetailsForAdmin);
router.put("/products/:productId", authentication, isSuperAdmin, productLimiter, updateProductForAdmin);
router.delete("/products/:productId", authentication, isSuperAdmin, productLimiter, deleteProductForAdmin);

// Lightweight metrics endpoint (recent requests)
const { getRecentRequestMetrics } = require("../../Utils/metrics");
router.get('/metrics/requests', authentication, isSuperAdmin, (req, res) => {
  const limit = req.query.limit || 50;
  res.status(200).json({ success: true, data: getRecentRequestMetrics(limit) });
});

module.exports = router;
