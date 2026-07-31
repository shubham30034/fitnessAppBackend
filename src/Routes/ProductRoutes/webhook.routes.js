const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");

const {
  verifyRazorpayWebhook,
} = require("../../Controller/ProductsController/order/webhook.controller");

/* =========================================================
   ✅ RAZORPAY WEBHOOK (PUBLIC)
========================================================= */

/**
 * POST /api/v1/webhooks/razorpay
 *
 * NOTE:
 * - No Authentication
 * - Razorpay calls this endpoint directly
 * - rawBody should be configured in app.js
 */
router.post(
  "/razorpay",
  asyncHandler(verifyRazorpayWebhook)
);

module.exports = router;