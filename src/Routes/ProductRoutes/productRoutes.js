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
} = require("../../Controller/ProductsController/category");

const {
  createSubCategory,
  getAllSubCategories,
} = require("../../Controller/ProductsController/subcategory");

const {
  buyProduct,
  verifySignature,
  getAllOrdersOfUser,
  getInvoice,
} = require("../../Controller/ProductsController/buyProduct");

// ✅ Middleware
const {
  authentication,
  isAdmin,
  isCoach,
  isSeller,
  isSuperAdmin,
  isUser,
} = require("../../Middleware/userAuth");

const uploadProductImage = require("../../Middleware/productImageUpload")
const uploadProfileImage = require("../../Middleware/uploadProfileUser");





// ======================= 👤 USER ROUTES =======================

// Get all products - accessible to any authenticated user
route.get("/products", authentication, getAllProducts);
route.get("/products/:id", authentication, getSingleProduct);
route.get("/products/category/:categoryId", authentication, getProductByCategory);

// Buy product & Payment-related
route.post("/buy", authentication, isUser, buyProduct); // Place order
route.post("/verify-signature", verifySignature);       // Razorpay webhook
route.get("/orders", authentication, isUser, getAllOrdersOfUser); // View orders
route.get("/invoice/:orderId", authentication, isUser, getInvoice); // View invoice



// ======================= 🛒 SELLER ROUTES =======================

// Product CRUD (Seller only)
route.get("/my-products", authentication, isSeller, getOwnProducts); // Get own products
route.post("/products", authentication, isSeller, createProduct);
route.put("/products/:id", authentication, isSeller, updateProduct);
route.delete("/products/:id", authentication, isSeller, deleteProduct);

// Upload/Update Product Images
// POST: Add/upload multiple images for a product
route.post(
  "/:productId",
  authentication,
  isSeller,
  uploadProductImage, // ← multer middleware (must come before controller)
  uploadProductImages  // ← your actual controller logic
);

// PUT: Replace/update existing images (or maybe a specific image slot)
route.put(
  "/:productId",
  authentication,
  isSeller,
  uploadProductImage,
  updateSpecificProductImage
);


// ======================= 🧑‍💼 ADMIN / SUPERADMIN ROUTES =======================

// CATEGORY ROUTES (Super Admin)
route.post("/categories", authentication, isSuperAdmin, createCategory); 
route.get("/categories", getAllCategories); // Public

// SUBCATEGORY ROUTES (Admin)
route.post("/subcategories", authentication, isAdmin, createSubCategory); 
route.get("/subcategories", getAllSubCategories); // Public


module.exports = route;
