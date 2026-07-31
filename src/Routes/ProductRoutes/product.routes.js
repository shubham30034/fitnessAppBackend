const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const {
  authentication,
  isSeller,
  isSellerOrAdmin,
} = require("../../Middleware/userAuth");

const {
  uploadProductImages,
  handleUploadError,
} = require("../../Middleware/productImageUpload");

/* ===========================
   PRODUCT CONTROLLERS
=========================== */
const {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
} = require("../../Controller/ProductsController/product/product.controller");

/* ===========================
   PRODUCT IMAGE CONTROLLERS
=========================== */
const {
  uploadProductImages: uploadProductImagesController,
  deleteProductImage,
} = require("../../Controller/ProductsController/product/product.images.controller");

/* ===========================
   SELLER PRODUCT CONTROLLERS
=========================== */
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

/* =========================================================
   ✅ PUBLIC ROUTES
========================================================= */

/**
 * GET /api/v1/products
 * Get all products
 */
router.get("/", asyncHandler(getAllProducts));

/**
 * GET /api/v1/products/category/:categoryId
 * Get products by category
 */
router.get(
  "/category/:categoryId",
  asyncHandler(getProductsByCategory)
);

/* =========================================================
   ✅ PRODUCT CRUD
========================================================= */

/**
 * POST /api/v1/products
 * Create product
 */
router.post(
  "/",
  authentication,
  isSeller,
  asyncHandler(createProduct)
);

/**
 * PATCH /api/v1/products/:id
 * Update product
 */
router.patch(
  "/:id",
  authentication,
  isSellerOrAdmin,
  asyncHandler(updateProduct)
);

/**
 * DELETE /api/v1/products/:id
 * Delete product
 */
router.delete(
  "/:id",
  authentication,
  isSellerOrAdmin,
  asyncHandler(deleteProduct)
);

/* =========================================================
   ✅ PRODUCT IMAGES
========================================================= */

/**
 * POST /api/v1/products/:id/images
 * Upload product images
 */
router.post(
  "/:id/images",
  authentication,
  isSellerOrAdmin,
  uploadProductImages,
  handleUploadError,
  asyncHandler(uploadProductImagesController)
);

/**
 * DELETE /api/v1/products/:id/images/:imageId
 * Delete product image
 */
router.delete(
  "/:id/images/:imageId",
  authentication,
  isSellerOrAdmin,
  asyncHandler(deleteProductImage)
);

/* =========================================================
   ✅ SELLER PRODUCT MANAGEMENT
========================================================= */

/**
 * GET /api/v1/products/seller/my-products
 */
router.get(
  "/seller/my-products",
  authentication,
  isSeller,
  asyncHandler(getOwnProducts)
);

/**
 * GET /api/v1/products/seller/my-products/:productId
 */
router.get(
  "/seller/my-products/:productId",
  authentication,
  isSeller,
  asyncHandler(getOwnProductDetails)
);

/**
 * PATCH /api/v1/products/seller/my-products/:productId/status
 */
router.patch(
  "/seller/my-products/:productId/status",
  authentication,
  isSeller,
  asyncHandler(updateOwnProductStatus)
);

/* =========================================================
   ✅ SELLER DASHBOARD
========================================================= */

/**
 * GET /api/v1/products/seller/dashboard
 */
router.get(
  "/seller/dashboard",
  authentication,
  isSeller,
  asyncHandler(getSellerDashboard)
);

/**
 * GET /api/v1/products/seller/analytics
 */
router.get(
  "/seller/analytics",
  authentication,
  isSeller,
  asyncHandler(getSellerAnalytics)
);

/**
 * GET /api/v1/products/seller/revenue-report
 */
router.get(
  "/seller/revenue-report",
  authentication,
  isSeller,
  asyncHandler(getRevenueReport)
);

/**
 * GET /api/v1/products/seller/export-sales-report
 */
router.get(
  "/seller/export-sales-report",
  authentication,
  isSeller,
  asyncHandler(exportSalesReport)
);

/* =========================================================
   ✅ INVENTORY
========================================================= */

/**
 * GET /api/v1/products/seller/low-stock
 */
router.get(
  "/seller/low-stock",
  authentication,
  isSeller,
  asyncHandler(getLowStockProducts)
);

/**
 * GET /api/v1/products/seller/out-of-stock
 */
router.get(
  "/seller/out-of-stock",
  authentication,
  isSeller,
  asyncHandler(getOutOfStockProducts)
);

/* =========================================================
   ✅ SINGLE PRODUCT (KEEP LAST)
========================================================= */

/**
 * GET /api/v1/products/:id
 * Get single product
 *
 * ⚠️ IMPORTANT:
 * This route must always be the LAST GET route,
 * otherwise it will capture routes like:
 * /seller/dashboard
 * /seller/analytics
 * /seller/low-stock
 */
router.get(
  "/:id",
  asyncHandler(getSingleProduct)
);

module.exports = router;