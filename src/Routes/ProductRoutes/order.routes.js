const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");

const { authentication, isUser } = require("../../Middleware/userAuth");

const {
  buyNow,
  checkoutFromCart,
  verifyRazorpayPayment,
  getMyOrders,
  getInvoice,
  cancelOrder,
} = require("../../Controller/ProductsController/order/order.controller");

const {
  verifyRazorpayWebhook,
} = require("../../Controller/ProductsController/order/webhook.controller");

/* =========================================================
   ✅ PUBLIC ROUTE (RAZORPAY WEBHOOK)
========================================================= */

/**
 * POST /api/v1/orders/webhook/razorpay
 */
router.post(
  "/webhook/razorpay",
  asyncHandler(verifyRazorpayWebhook)
);

/* =========================================================
   ✅ USER AUTHENTICATION
========================================================= */

router.use(authentication, isUser);

/* =========================================================
   ✅ BUY NOW
========================================================= */

/**
 * POST /api/v1/orders/buy-now
 * body: { productId, quantity, address }
 */
router.post(
  "/buy-now",
  asyncHandler(buyNow)
);

/* =========================================================
   ✅ CART CHECKOUT
========================================================= */

/**
 * POST /api/v1/orders/checkout
 * body: { address }
 */
router.post(
  "/checkout",
  asyncHandler(checkoutFromCart)
);

/* =========================================================
   ✅ VERIFY PAYMENT
========================================================= */

/**
 * POST /api/v1/orders/verify-payment
 */
router.post(
  "/verify-payment",
  asyncHandler(verifyRazorpayPayment)
);

/* =========================================================
   ✅ MY ORDERS
========================================================= */

/**
 * GET /api/v1/orders/my
 */
router.get(
  "/my",
  asyncHandler(getMyOrders)
);

/* =========================================================
   ✅ INVOICE
========================================================= */

/**
 * GET /api/v1/orders/invoice/:orderId
 */
router.get(
  "/invoice/:orderId",
  asyncHandler(getInvoice)
);

/* =========================================================
   ✅ CANCEL ORDER
========================================================= */

/**
 * PATCH /api/v1/orders/cancel/:orderId
 */
router.patch(
  "/cancel/:orderId",
  asyncHandler(cancelOrder)
);

module.exports = router;