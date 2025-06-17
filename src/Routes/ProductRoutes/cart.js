const express = require("express");
const route = express.Router();

// ✅ Controller functions
const {
  addToCart,
  removeFromCart,
  getCart,
  updateCartItemQuantity,
  clearCart,
  getCartTotal
} = require("../../Controller/ProductsController/cart");

// ✅ Middleware
const {
  authentication,
  isAdmin,
  isCoach,
  isSeller,
  isSuperAdmin,
  isUser
} = require("../../Middleware/userAuth");

// ======================= Cart Routes =======================

// Add item to cart
route.post("/cart", authentication, addToCart);

// Get user's cart
route.get("/cart", authentication, getCart);

// Update quantity of an item in the cart
route.put("/cart/:productId", authentication, updateCartItemQuantity);

// Remove a specific item from cart
route.delete("/cart/:productId", authentication, removeFromCart);

// Clear all items in the cart
route.delete("/cart", authentication, clearCart);

// Get total amount of cart
route.get("/cart-total", authentication, getCartTotal);

module.exports = route;
