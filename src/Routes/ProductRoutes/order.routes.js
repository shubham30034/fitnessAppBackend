const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const { authentication, isUser } = require("../../Middleware/userAuth");

const {
  buyNow,
  checkoutFromCart,
  getMyOrders,
  getInvoice,
} = require("../../Controller/ProductsController/order/order.controller");

/* =========================================================
   ✅ USER ORDER ROUTES
========================================================= */
router.use(authentication, isUser);

/**
 * ✅ Buy Now (single product checkout)
 * POST /api/v1/orders/buy-now
 * body: { productId, quantity, address }
 */
router.post("/buy-now", asyncHandler(buyNow));

/**
 * ✅ Checkout from cart
 * POST /api/v1/orders/checkout
 * body: { address }
 */
router.post("/checkout", asyncHandler(checkoutFromCart));

/**
 * ✅ Get my orders
 * GET /api/v1/orders/my
 */
router.get("/my", asyncHandler(getMyOrders));

/**
 * ✅ Invoice for a specific order
 * GET /api/v1/orders/invoice/:orderId
 */
router.get("/invoice/:orderId", asyncHandler(getInvoice));

module.exports = router;
