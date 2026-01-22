const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const { authentication, isAdmin, isSuperAdmin } = require("../../Middleware/userAuth");

/* =========================================================
   ✅ ADMIN PRODUCT CONTROLLER IMPORTS (Correct Names)
========================================================= */
const {
  getAllProductsForAdmin,
  getProductDetailsForAdmin,
  updateProductForAdmin,
  deleteProductForAdmin,
  bulkUpdateProductStatus,
  getProductAnalytics,
} = require("../../Controller/adminController/product/admin.product.controller");

/* =========================================================
   ✅ ADMIN ORDER CONTROLLER IMPORTS (Correct Names)
========================================================= */
const {
  getAllOrdersForAdmin,
  getOrderDetailsForAdmin,
  updateOrderStatusForAdmin,
  cancelOrderForAdmin,
  getOrderAnalyticsForAdmin,
} = require("../../Controller/adminController/product/admin.order.controller");

/* =========================================================
   ✅ AUTH GUARDS
   - Admin + Superadmin allowed
========================================================= */
router.use(authentication);
router.use(isAdmin);

/* =========================================================
   ✅ PRODUCTS (ADMIN)
========================================================= */

// Get all products (filters + analytics)
router.get("/products", asyncHandler(getAllProductsForAdmin));

// Get single product details + order analytics
router.get("/products/:productId", asyncHandler(getProductDetailsForAdmin));

// Update product (admin/superadmin)
router.patch("/products/:productId", asyncHandler(updateProductForAdmin));

// Delete product (soft deactivate)
router.delete("/products/:productId", asyncHandler(deleteProductForAdmin));

// Bulk update product status/featured
router.patch("/products/bulk/status", asyncHandler(bulkUpdateProductStatus));

// Product analytics dashboard
router.get("/analytics/products", asyncHandler(getProductAnalytics));

/* =========================================================
   ✅ ORDERS (ADMIN)
========================================================= */

// Get all orders (filters)
router.get("/orders", asyncHandler(getAllOrdersForAdmin));

// Get order details
router.get("/orders/:orderId", asyncHandler(getOrderDetailsForAdmin));

// Update order status (Pending -> Confirmed -> Shipped -> Delivered)
router.patch("/orders/:orderId/status", asyncHandler(updateOrderStatusForAdmin));

// Cancel order (optional restore stock)
router.patch("/orders/:orderId/cancel", asyncHandler(cancelOrderForAdmin));

// Orders analytics dashboard
router.get("/analytics/orders", asyncHandler(getOrderAnalyticsForAdmin));

/* =========================================================
   ✅ SUPERADMIN ONLY (Optional strict actions)
   - Example: hard delete order (currently blocked)
========================================================= */
router.delete(
  "/orders/:orderId",
  isSuperAdmin,
  asyncHandler(async (req, res) => {
    return res.status(403).json({
      success: false,
      message: "Not allowed",
    });
  })
);

module.exports = router;
