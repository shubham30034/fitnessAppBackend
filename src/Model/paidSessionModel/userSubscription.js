const mongoose = require("mongoose");

const UserSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    platform: {
      type: String,
      enum: ["apple", "google"],
      required: true,
    },

    planType: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "failed"],
      default: "paid",
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    /* =========================
       APPLE PURCHASE
    ========================= */
    applePurchase: {
      transactionId: { type: String },
      productId: { type: String },
      originalTransactionId: { type: String },
    },

    /* =========================
       GOOGLE PURCHASE
    ========================= */
    googlePurchase: {
      purchaseToken: { type: String },
      productId: { type: String },
      orderId: { type: String },
    },
  },
  { timestamps: true }
);

/* =========================
   INDEXES (ONLY HERE)
========================= */

// user–coach relation
UserSubscriptionSchema.index({ user: 1, coach: 1 });

// filters
UserSubscriptionSchema.index({ platform: 1 });
UserSubscriptionSchema.index({ isActive: 1 });
UserSubscriptionSchema.index({ paymentStatus: 1 });
UserSubscriptionSchema.index({ endDate: 1 });

// Apple / Google identifiers
UserSubscriptionSchema.index(
  { "applePurchase.transactionId": 1 },
  { sparse: true }
);

UserSubscriptionSchema.index(
  { "applePurchase.productId": 1 },
  { sparse: true }
);

UserSubscriptionSchema.index(
  { "googlePurchase.purchaseToken": 1 },
  { sparse: true }
);

UserSubscriptionSchema.index(
  { "googlePurchase.productId": 1 },
  { sparse: true }
);

module.exports = mongoose.model("UserSubscription", UserSubscriptionSchema);
