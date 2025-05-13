const express = require("express");
const route = express.Router();

// ✅ Controllers
const {
  createProduct,
  getAllProducts,
  getSingleProduct,
  deleteProduct,
} = require("../../Controller/ProductsController/createProduct");

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

// ======================= Product Routes =======================
route.post("/products", authentication, isSeller, createProduct);         // Only sellers
route.get("/products", authentication, getAllProducts);                   // All users
route.get("/products/:id", authentication, getSingleProduct);             // All users
route.delete("/products/:id", authentication, isSuperAdmin, deleteProduct); // Only super admin

// ======================= Category Routes =======================
route.post("/categories", authentication, isSuperAdmin, createCategory);  // Only super admin
route.get("/categories", getAllCategories);                               // Public

// ======================= Subcategory Routes =======================
route.post("/subcategories", authentication, isAdmin, createSubCategory); // Only admin
route.get("/subcategories", getAllSubCategories);                         // Public

// ======================= Payment & Order Routes =======================
route.post("/buy", authentication, isUser, buyProduct);                   // User initiates purchase
route.post("/verify-signature", verifySignature);                         // Razorpay webhook

// ✅ New: Get all orders of a user
route.get("/orders", authentication, isUser, getAllOrdersOfUser);

// ✅ New: Get invoice for a specific order
route.get("/invoice/:orderId", authentication, isUser, getInvoice);

module.exports = route;
