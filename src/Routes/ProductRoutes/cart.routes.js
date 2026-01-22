const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const { authentication, isUser } = require("../../Middleware/userAuth");

const {
  addToCart,
  getCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  getCartTotal,
} = require("../../Controller/ProductsController/cart/cart.controller");

/* =========================================================
   ✅ CART ROUTES (User only)
========================================================= */

// protect all cart routes
router.use(authentication, isUser);

// Add item to cart
// POST /api/v1/cart
router.post("/", asyncHandler(addToCart));

// Get cart
// GET /api/v1/cart
router.get("/", asyncHandler(getCart));

// Update cart item quantity
// PATCH /api/v1/cart/:productId
router.patch("/:productId", asyncHandler(updateCartItemQuantity));

// Remove item from cart
// DELETE /api/v1/cart/:productId
router.delete("/:productId", asyncHandler(removeFromCart));

// Clear cart
// DELETE /api/v1/cart
router.delete("/", asyncHandler(clearCart));

// Get cart total
// GET /api/v1/cart/total
router.get("/total", asyncHandler(getCartTotal));

module.exports = router;
