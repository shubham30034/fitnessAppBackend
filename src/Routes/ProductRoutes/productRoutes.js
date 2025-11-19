const express = require("express");
const route = express.Router();

// ✅ Controllers
const {
  createProduct,
  uploadProductImages,
  updateSpecificProductImage,
  getAllProducts,
  getSingleProduct,
  deleteProduct,
  updateProduct,
  getOwnProducts,
  getProductByCategory
} = require("../../Controller/ProductsController/createProduct");

const {addToCart} = require("../../Controller/ProductsController/cart")

const {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} = require("../../Controller/ProductsController/category");

const {
  createSubCategory,
  getAllSubCategories,
  updateSubCategory,
  deleteSubCategory,
} = require("../../Controller/ProductsController/subcategory");

const {
  buyProduct,
  verifySignature,
  getAllOrdersOfUser,
  getInvoice,
} = require("../../Controller/ProductsController/buyProduct");



// ✅ Product Management Controllers
const {
  getAllProductsForAdmin,
  getProductAnalytics,
  bulkUpdateProductStatus,
  getProductDetailsForAdmin,
  getSellerProductAnalytics,
  getSellerProductPerformance,
  updateProductStatus
} = require("../../Controller/ProductsController/productManagementController");
// Seller order management (same controller file)
const {
  listSellerOrders,
  getSellerOrderDetails,
  updateSellerOrderStatus
} = require("../../Controller/ProductsController/productManagementController");

// ✅ Middleware
const {
  authentication,
  isAdmin,
  isCoach,
  isSeller,
  isSuperAdmin,
  isUser,
} = require("../../Middleware/userAuth");

const { uploadProductImage, handleProductUploadError } = require("../../Middleware/productImageUpload")
const uploadProfileImage = require("../../Middleware/uploadProfileUser");

// ✅ Rate Limiting
const {
  productLimiter,
  uploadLimiter
} = require("../../Middleware/rateLimiter");

// ======================= 👤 USER ROUTES =======================

// Get all products - accessible to any authenticated user
route.get("/", authentication, productLimiter, getAllProducts);
route.get("/category/:categoryId", authentication, productLimiter, getProductByCategory);

// Buy product & Payment-related
route.post("/buy", authentication, isUser, productLimiter, buyProduct); // Place order
// Razorpay webhook – this route must be handled with raw body. index.js mounts raw parser before JSON for this path.
route.post("/verify-signature", verifySignature);
route.get("/orders", authentication, isUser, productLimiter, getAllOrdersOfUser); // View orders
route.get("/invoice/:orderId", authentication, isUser, productLimiter, getInvoice); // View invoice



// ======================= 🛒 SELLER ROUTES =======================

// Product CRUD (Seller only)
route.get("/my-products", authentication, isSeller, productLimiter, getOwnProducts); // Get own products
route.post("/", authentication, isSeller, productLimiter, createProduct);
route.put("/:id", authentication, isSeller, productLimiter, updateProduct);
route.delete("/:id", authentication, isSeller, productLimiter, deleteProduct);

// ======================= 🧑‍💼 ADMIN / SUPERADMIN ROUTES =======================

// CATEGORY ROUTES (Super Admin) - MUST COME BEFORE /:id ROUTE
route.post("/categories", authentication, isSuperAdmin, productLimiter, createCategory); 
route.get("/categories", getAllCategories); // Public
route.put("/categories/:id", authentication, isSuperAdmin, productLimiter, updateCategory);
route.delete("/categories/:id", authentication, isSuperAdmin, productLimiter, deleteCategory);

// SUBCATEGORY ROUTES (Admin) - MUST COME BEFORE /:id ROUTE
route.post("/subcategories", authentication, isAdmin, productLimiter, createSubCategory); 
route.get("/subcategories", getAllSubCategories); // Public
route.put("/subcategories/:id", authentication, isAdmin, productLimiter, updateSubCategory);
route.delete("/subcategories/:id", authentication, isAdmin, productLimiter, deleteSubCategory);

// Get single product by ID (accessible to any authenticated user)
route.get("/:id", authentication, productLimiter, getSingleProduct);

// Upload/Update Product Images
// POST: Add/upload multiple images for a product
route.post(
  "/upload/:productId",
  authentication,
  isSeller,
  uploadLimiter,
  uploadProductImage, // ← multer middleware (must come before controller)
  uploadProductImages  // ← your actual controller logic
);

// PUT: Replace/update existing images (or maybe a specific image slot)
route.put(
  "/upload/:productId",
  authentication,
  isSeller,
  uploadLimiter,
  uploadProductImage,
  updateSpecificProductImage
);

// Add error handling middleware for product image uploads
route.use(handleProductUploadError);

// ======================= 🏪 PRODUCT MANAGEMENT ROUTES =======================

// ======================= SUPERADMIN PRODUCT MANAGEMENT =======================

// Get all products with advanced filtering and analytics (Super Admin)
route.get("/admin/all", authentication, isSuperAdmin, productLimiter, getAllProductsForAdmin);

// Get product analytics for superadmin
route.get("/admin/analytics", authentication, isSuperAdmin, productLimiter, getProductAnalytics);

// Bulk update product status (Super Admin)
route.put("/admin/bulk-status", authentication, isSuperAdmin, productLimiter, bulkUpdateProductStatus);

// Get detailed product information for admin
route.get("/admin/:productId", authentication, isSuperAdmin, productLimiter, getProductDetailsForAdmin);

// ======================= SELLER PRODUCT MANAGEMENT =======================

// Get seller's product analytics
route.get("/seller/analytics", authentication, isSeller, productLimiter, getSellerProductAnalytics);

// Get seller's specific product performance
route.get("/seller/performance/:productId", authentication, isSeller, productLimiter, getSellerProductPerformance);

// Update product status (active/inactive, featured) - Seller
route.patch("/seller/:productId/status", authentication, isSeller, productLimiter, updateProductStatus);

// ======================= SELLER ORDER MANAGEMENT =======================
// List seller's orders
route.get("/orders/seller", authentication, isSeller, productLimiter, listSellerOrders);
// Get order details
route.get("/orders/:orderId", authentication, isSeller, productLimiter, getSellerOrderDetails);
// Update order status
route.patch("/orders/:orderId/status", authentication, isSeller, productLimiter, updateSellerOrderStatus);

module.exports = route;
