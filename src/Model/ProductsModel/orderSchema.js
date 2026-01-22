// models/Order.js
const mongoose = require("mongoose");

const orderProductSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // snapshot price
    nameSnapshot: { type: String, trim: true }, // optional snapshot
    imageSnapshot: { type: String, trim: true }, // optional snapshot
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, sparse: true, index: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    products: { type: [orderProductSchema], required: true },

    totalPrice: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
      index: true,
    },

    address: { type: String, required: true, trim: true },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      default: "razorpay",
    },

    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },

    razorpayReceipt: { type: String },
  },
  { timestamps: true }
);

// indexes for user order history
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

// orderNumber generation
orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    const last6 = this._id.toString().slice(-6).toUpperCase();
    this.orderNumber = `ORD-${last6}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
