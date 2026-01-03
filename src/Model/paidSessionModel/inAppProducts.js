const mongoose = require('mongoose');

const inAppProductSchema = new mongoose.Schema(
{
  name: { type: String, required: true },
  description: { type: String, required: true },

  productType: {
    type: String,
    enum: ['subscription', 'one_time'],
    required: true
  },

  subscriptionDetails: {
    duration: {
      type: Number,
      required: function () {
        return this.productType === 'subscription';
      }
    },
    sessionsPerMonth: {
      type: Number,
      default: 4
    },
    autoRenewable: {
      type: Boolean,
      default: true
    }
  },

  pricing: {
    basePrice: { type: Number, required: true },
    currency: {
      type: String,
      enum: ['INR', 'USD', 'EUR'],
      default: 'INR'
    },
    applePrice: Number,
    googlePrice: Number
  },

  /* ========= APPLE ========= */
  appleProduct: {
    productId: {
      type: String,
      required: true,
      unique: true // ✔️ ONLY here
    },
    bundleId: { type: String, required: true },
    displayName: String,
    description: String,
    price: Number,
    priceLocale: String,
    isActive: { type: Boolean, default: true },
    subscriptionGroup: String,
    subscriptionPeriod: {
      type: String,
      enum: ['P1W', 'P1M', 'P3M', 'P6M', 'P1Y']
    }
  },

  /* ========= GOOGLE ========= */
  googleProduct: {
    productId: {
      type: String,
      required: true,
      unique: true // ✔️ ONLY here
    },
    packageName: { type: String, required: true },
    title: String,
    description: String,
    price: Number,
    priceCurrencyCode: String,
    isActive: { type: Boolean, default: true },
    subscriptionPeriod: {
      type: String,
      enum: ['P1W', 'P1M', 'P3M', 'P6M', 'P1Y']
    },
    trialPeriod: String,
    gracePeriod: String
  },

  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  isGlobal: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true
  },

  platformStatus: {
    apple: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'rejected'],
      default: 'pending'
    },
    google: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'rejected'],
      default: 'pending'
    }
  },

  metadata: {
    category: {
      type: String,
      enum: ['fitness', 'yoga', 'nutrition', 'premium', 'basic'],
      default: 'fitness'
    },
    tags: [String],
    features: [String],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }
},
{ timestamps: true }
);

/* ========= INDEXES (ONLY NON-DUPLICATE) ========= */

inAppProductSchema.index({ coach: 1 });
inAppProductSchema.index({ isGlobal: 1 });
inAppProductSchema.index({ isActive: 1 });
inAppProductSchema.index({ productType: 1 });
inAppProductSchema.index({ 'platformStatus.apple': 1 });
inAppProductSchema.index({ 'platformStatus.google': 1 });

module.exports = mongoose.model('InAppProduct', inAppProductSchema);
