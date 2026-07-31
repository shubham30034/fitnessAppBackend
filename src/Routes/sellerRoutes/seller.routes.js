const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");

const {
  getOwnProducts,
  updateOwnProductStatus,
  getOwnProductDetails,
  getSellerDashboard,
  getLowStockProducts,
  getOutOfStockProducts,
  getRevenueReport,
  exportSalesReport,
  getSellerAnalytics,
} = require("../../Controller/SellerController/seller/seller.product.controller");

const {
  authentication,
  isSeller,
} = require("../../Middleware/userAuth");

/* =========================================================
   🔐 SELLER ONLY
========================================================= */

router.use(authentication);
router.use(isSeller);

/* =========================================================
   📦 PRODUCTS
========================================================= */

/**
 * GET /seller/products
 * List own products
 */
router.get("/", asyncHandler(getOwnProducts));

/**
 * PATCH /seller/products/:productId/status
 */
router.patch(
  "/:productId/status",
  asyncHandler(updateOwnProductStatus)
);

/* =========================================================
   📊 DASHBOARD
========================================================= */

/**
 * GET /seller/products/dashboard
 */
router.get(
  "/dashboard",
  asyncHandler(getSellerDashboard)
);

/**
 * GET /seller/products/analytics
 */
router.get(
  "/analytics",
  asyncHandler(getSellerAnalytics)
);

/**
 * GET /seller/products/revenue-report
 */
router.get(
  "/revenue-report",
  asyncHandler(getRevenueReport)
);

/**
 * GET /seller/products/export-sales-report
 */
router.get(
  "/export-sales-report",
  asyncHandler(exportSalesReport)
);

/* =========================================================
   📦 INVENTORY
========================================================= */

/**
 * GET /seller/products/low-stock
 */
router.get(
  "/low-stock",
  asyncHandler(getLowStockProducts)
);

/**
 * GET /seller/products/out-of-stock
 */
router.get(
  "/out-of-stock",
  asyncHandler(getOutOfStockProducts)
);

/* =========================================================
   📄 SINGLE PRODUCT (KEEP LAST)
========================================================= */

/**
 * GET /seller/products/:productId
 */
router.get(
  "/:productId",
  asyncHandler(getOwnProductDetails)
);

module.exports = router;