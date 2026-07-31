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
   ✅ USER AUTHENTICATION
========================================================= */

router.use(authentication, isUser);

/* =========================================================
   ✅ ADD TO CART
========================================================= */

/**
 * POST /api/v1/cart
 */
router.post("/", asyncHandler(addToCart));

/* =========================================================
   ✅ GET CART
========================================================= */

/**
 * GET /api/v1/cart
 */
router.get("/", asyncHandler(getCart));

/* =========================================================
   ✅ GET CART TOTAL
========================================================= */

/**
 * GET /api/v1/cart/total
 */
router.get("/total", asyncHandler(getCartTotal));

/* =========================================================
   ✅ UPDATE CART ITEM QUANTITY
========================================================= */

/**
 * PATCH /api/v1/cart/:productId
 */
router.patch("/:productId", asyncHandler(updateCartItemQuantity));

/* =========================================================
   ✅ REMOVE SINGLE CART ITEM
========================================================= */

/**
 * DELETE /api/v1/cart/:productId
 */
router.delete("/:productId", asyncHandler(removeFromCart));

/* =========================================================
   ✅ CLEAR CART
========================================================= */

/**
 * DELETE /api/v1/cart
 */
router.delete("/", asyncHandler(clearCart));

module.exports = router;