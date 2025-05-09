const express = require("express");
const route = express.Router();

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
  authentication,
  isAdmin,
  isCoach,
  isSeller,
  isSuperAdmin,
  isUser,
} = require("../../Middleware/userAuth");

const { buyProduct, verifySignature } = require("../../Controller/ProductsController/buyProduct");

// Product routes
route.post("/products", authentication, isSeller, createProduct);      // Only sellers can create
route.get("/products", authentication, getAllProducts);                                 // Public access
route.get("/products/:id", authentication, getSingleProduct);                           // Public access
route.delete("/products/:id", authentication, isSuperAdmin, deleteProduct);  // Only admins can delete

// Category routes
route.post("/categories", authentication, isSuperAdmin, createCategory);     // Only admins can create
route.get("/categories", getAllCategories);                              // Public access

// Subcategory routes
route.post("/subcategories", authentication, isAdmin, createSubCategory); // Only admins
route.get("/subcategories", getAllSubCategories);                         // Public access

// Payment-related routes
route.post("/buy", authentication, isUser, buyProduct); // Any authenticated user can buy
route.post("/verify-signature", verifySignature);     // Razorpay webhook for verifying payment

module.exports = route;
