const mongoose = require('mongoose');

const inAppProductSchema = new mongoose.Schema({
  // Basic product information
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Product type
  productType: {
    type: String,
    enum: ['subscription', 'one_time'],
    required: true
  },
  
  // Subscription details (for subscription products)
  subscriptionDetails: {
    duration: {
      type: Number, // in days
      required: function() { return this.productType === 'subscription'; }
    },
    sessionsPerMonth: {
      type: Number,
      default: 4,
      required: function() { return this.productType === 'subscription'; }
    },
    autoRenewable: {
      type: Boolean,
      default: true,
      required: function() { return this.productType === 'subscription'; }
    }
  },
  
  // Pricing information
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR']
    },
    // Platform-specific pricing
    applePrice: {
      type: Number,
      sparse: true
    },
    googlePrice: {
      type: Number,
      sparse: true
    }
  },
  
  // ===================== APPLE APP STORE FIELDS =====================
  
  appleProduct: {
    productId: {
      type: String,
      required: true,
      unique: true
    },
    bundleId: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      sparse: true
    },
    description: {
      type: String,
      sparse: true
    },
    price: {
      type: Number,
      sparse: true
    },
    priceLocale: {
      type: String,
      sparse: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Subscription group (for managing subscription tiers)
    subscriptionGroup: {
      type: String,
      sparse: true
    },
    // Subscription period
    subscriptionPeriod: {
      type: String,
      enum: ['P1W', 'P1M', 'P3M', 'P6M', 'P1Y'],
      sparse: true
    }
  },
  
  // ===================== GOOGLE PLAY STORE FIELDS =====================
  
  googleProduct: {
    productId: {
      type: String,
      required: true,
      unique: true
    },
    packageName: {
      type: String,
      required: true
    },
    title: {
      type: String,
      sparse: true
    },
    description: {
      type: String,
      sparse: true
    },
    price: {
      type: Number,
      sparse: true
    },
    priceCurrencyCode: {
      type: String,
      sparse: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Subscription period
    subscriptionPeriod: {
      type: String,
      enum: ['P1W', 'P1M', 'P3M', 'P6M', 'P1Y'],
      sparse: true
    },
    // Trial period (if applicable)
    trialPeriod: {
      type: String,
      sparse: true
    },
    // Grace period
    gracePeriod: {
      type: String,
      sparse: true
    }
  },
  
  // ===================== COACH ASSOCIATION =====================
  
  // If this product is specific to a coach
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  
  // If this is a global product (not coach-specific)
  isGlobal: {
    type: Boolean,
    default: false
  },
  
  // ===================== STATUS & METADATA =====================
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Product status on platforms
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
  
  // Approval information
  approvalInfo: {
    appleApprovedAt: {
      type: Date,
      sparse: true
    },
    googleApprovedAt: {
      type: Date,
      sparse: true
    },
    appleRejectionReason: {
      type: String,
      sparse: true
    },
    googleRejectionReason: {
      type: String,
      sparse: true
    }
  },
  
  // Usage statistics
  stats: {
    totalPurchases: {
      type: Number,
      default: 0
    },
    activeSubscriptions: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
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
}, { timestamps: true });

// Indexes for better performance
inAppProductSchema.index({ 'appleProduct.productId': 1 });
inAppProductSchema.index({ 'googleProduct.productId': 1 });
inAppProductSchema.index({ coach: 1 });
inAppProductSchema.index({ isGlobal: 1 });
inAppProductSchema.index({ isActive: 1 });
inAppProductSchema.index({ productType: 1 });
inAppProductSchema.index({ 'platformStatus.apple': 1 });
inAppProductSchema.index({ 'platformStatus.google': 1 });

// Virtual for getting platform-specific product info
inAppProductSchema.virtual('platformInfo').get(function() {
  return {
    apple: {
      productId: this.appleProduct?.productId,
      isActive: this.appleProduct?.isActive,
      status: this.platformStatus?.apple,
      price: this.appleProduct?.price
    },
    google: {
      productId: this.googleProduct?.productId,
      isActive: this.googleProduct?.isActive,
      status: this.platformStatus?.google,
      price: this.googleProduct?.price
    }
  };
});

// Virtual for checking if product is available on both platforms
inAppProductSchema.virtual('isAvailable').get(function() {
  return this.isActive && 
         this.platformStatus?.apple === 'active' && 
         this.platformStatus?.google === 'active';
});

// Ensure virtuals are included when converting to JSON
inAppProductSchema.set('toJSON', { virtuals: true });
inAppProductSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InAppProduct', inAppProductSchema);
