const crypto = require("crypto");
const Order = require("../../../Model/ProductsModel/orderSchema");
const Product = require("../../../Model/ProductsModel/product");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const mongoose = require("mongoose");

exports.verifyRazorpayWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (!webhookSecret) throw new ApiError(500, "Webhook secret missing");

  const payload = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
  const digest = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

  if (signature !== digest) throw new ApiError(400, "Invalid signature");

  const event = req.body.event;

  // accept only payment captured
  if (event !== "payment.captured") {
    return res.status(200).json({ success: true, message: "Ignored event" });
  }

  const entity = req.body.payload?.payment?.entity;
  const razorpayOrderId = entity?.order_id;
  const amount = entity?.amount;
  const currency = entity?.currency;

  if (!razorpayOrderId) throw new ApiError(400, "Missing razorpay order id");

  // ✅ Match order only by razorpayOrderId
  const order = await Order.findOne({ razorpayOrderId });
  if (!order) throw new ApiError(404, "Order not found");

  // ✅ verify amount + currency
  if (currency !== "INR") throw new ApiError(400, "Invalid currency");
  if (Number(amount) !== Number(order.totalPrice) * 100) throw new ApiError(400, "Amount mismatch");

  // If already paid -> idempotent
  if (order.paymentStatus === "Paid") {
    return res.status(200).json({ success: true, message: "Already processed" });
  }

  // ✅ ATOMIC STOCK decrement using transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // update order to paid
    order.paymentStatus = "Paid";
    order.status = "Confirmed";
    order.razorpayPaymentId = entity?.id;
    await order.save({ session });

    for (const item of order.products) {
      const updated = await Product.updateOne(
        { _id: item.productId, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity, saleCount: item.quantity } },
        { session }
      );

      if (updated.modifiedCount !== 1) {
        throw new Error("Stock insufficient while confirming order");
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: "Payment verified" });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // mark order failed safely
    await Order.updateOne(
      { _id: order._id },
      { paymentStatus: "Failed", status: "Cancelled" }
    );

    throw new ApiError(400, err.message);
  }
});
