const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../../../Model/ProductsModel/orderSchema");
const Product = require("../../../Model/ProductsModel/product");
const Cart = require("../../../Model/ProductsModel/cart");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");

/* =========================================================
   RAZORPAY WEBHOOK HANDLER
========================================================= */
exports.verifyRazorpayWebhook = asyncHandler(async (req, res) => {
  const isDev = process.env.NODE_ENV !== "production";

  /* ================= DEV MODE SIMULATION ================= */
  if (isDev && req.headers["x-dev-webhook"] === "true") {
    const { razorpayOrderId } = req.body;
    if (!razorpayOrderId) throw new ApiError(400, "razorpayOrderId required");

    await processSuccessfulPayment(razorpayOrderId, {
      id: "dev_payment_id",
      method: "DEV",
    });

    return res.json({ success: true, message: "DEV payment simulated" });
  }

  /* ================= SIGNATURE VERIFICATION ================= */
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (!secret) throw new ApiError(500, "Webhook secret missing");
  if (!req.rawBody) throw new ApiError(500, "Raw body missing");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");

  if (digest !== signature)
    throw new ApiError(400, "Invalid webhook signature");

  /* ================= EVENT FILTER ================= */
  const event = req.body.event;
  if (event !== "payment.captured")
    return res.status(200).json({ received: true });

  const payment = req.body.payload?.payment?.entity;
  if (!payment) throw new ApiError(400, "Invalid payment payload");

  await processSuccessfulPayment(payment.order_id, payment);

  res.status(200).json({ success: true });
});

/* =========================================================
   CORE PAYMENT PROCESSOR (TRANSACTION SAFE)
========================================================= */
async function processSuccessfulPayment(razorpayOrderId, payment) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    /* ===== 1. LOCK ORDER (IDEMPOTENCY) ===== */
    const order = await Order.findOneAndUpdate(
      {
        razorpayOrderId,
        paymentStatus: "Pending",
        status: "Pending",
      },
      { $set: { paymentStatus: "Processing" } },
      { new: true, session }
    );

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return; // already handled
    }

    /* ===== 2. EXPIRY CHECK ===== */
    if (order.expiresAt && new Date() > order.expiresAt)
      throw new Error("Order expired");

    /* ===== 3. PAYMENT VALIDATION ===== */
    if (payment.currency && payment.currency !== "INR")
      throw new Error("Currency mismatch");

    if (payment.amount && Number(payment.amount) !== order.totalPrice * 100)
      throw new Error("Amount mismatch");

    /* ===== 4. ATOMIC STOCK DEDUCTION ===== */
    for (const item of order.products) {
      const result = await Product.updateOne(
        { _id: item.productId, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity, saleCount: item.quantity } },
        { session }
      );

      if (result.modifiedCount !== 1)
        throw new Error(`Stock issue for ${item.nameSnapshot}`);
    }

    /* ===== 5. CLEAR CART ===== */
    await Cart.updateOne(
      { user: order.userId },
      { $set: { items: [] } },
      { session }
    );

    /* ===== 6. FINAL ORDER UPDATE ===== */
    order.paymentStatus = "Paid";
    order.status = "Confirmed";
    order.razorpayPaymentId = payment.id;
    order.paymentMeta = {
      method: payment.method || null,
      bank: payment.bank || null,
      wallet: payment.wallet || null,
      vpa: payment.vpa || null,
    };

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    await Order.updateOne(
      { razorpayOrderId },
      { paymentStatus: "Failed", status: "Cancelled" }
    );

    throw err;
  }
}
