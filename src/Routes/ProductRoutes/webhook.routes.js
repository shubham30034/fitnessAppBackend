const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");

const {
  verifyRazorpayWebhook,
} = require("../../Controller/ProductsController/order/webhook.controller");

/* =========================================================
   ✅ Razorpay Webhook
   - NO auth
   - rawBody already set in app.js
========================================================= */

// POST /api/v1/webhooks/razorpay
router.post("/razorpay", asyncHandler(verifyRazorpayWebhook));

module.exports = router;
