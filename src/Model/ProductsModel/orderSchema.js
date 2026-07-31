const mongoose = require("mongoose");

/* ================= PRODUCT SNAPSHOT ================= */
const orderProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // snapshot price
    nameSnapshot: { type: String, trim: true },
    imageSnapshot: { type: String, trim: true },
  },
  { _id: false }
);

/* ================= ADDRESS STRUCTURE ================= */
const addressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false }
);

/* ================= MAIN ORDER SCHEMA ================= */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, sparse: true, index: true },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    products: { type: [orderProductSchema], required: true },

    totalPrice: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
      index: true,
    },

    /* 🔥 FIXED ADDRESS */
    address: { type: addressSchema, required: true },

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

    /* 🔥 YOU WERE USING THIS BUT NEVER DEFINED */
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

/* ================= ORDER NUMBER AUTO GENERATION ================= */
orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    const last6 = this._id.toString().slice(-6).toUpperCase();
    this.orderNumber = `ORD-${last6}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
