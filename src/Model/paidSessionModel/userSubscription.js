const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  client: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  coach: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  subscriptionType: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly', 'custom'],
    default: 'monthly'
  },
  // Monthly subscription fee
  monthlyFee: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  },
  sessionsPerMonth: {
    type: Number,
    default: 4
  },
  sessionsUsed: {
    type: Number,
    default: 0
  },
  
  // ===================== IN-APP PURCHASE FIELDS =====================
  
  // Platform information
  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    required: true
  },
  
  // Apple App Store specific fields
  applePurchase: {
    transactionId: {
      type: String,
      sparse: true // Allow null for non-Apple purchases
    },
    originalTransactionId: {
      type: String,
      sparse: true
    },
    productId: {
      type: String,
      sparse: true
    },
    purchaseToken: {
      type: String,
      sparse: true
    },
    receiptData: {
      type: String,
      sparse: true
    },
    receiptSignature: {
      type: String,
      sparse: true
    },
    environment: {
      type: String,
      enum: ['Sandbox', 'Production'],
      sparse: true
    },
    bundleId: {
      type: String,
      sparse: true
    },
    appAccountToken: {
      type: String,
      sparse: true
    }
  },
  
  // Google Play Billing specific fields
  googlePurchase: {
    purchaseToken: {
      type: String,
      sparse: true // Allow null for non-Google purchases
    },
    orderId: {
      type: String,
      sparse: true
    },
    productId: {
      type: String,
      sparse: true
    },
    packageName: {
      type: String,
      sparse: true
    },
    purchaseTime: {
      type: Date,
      sparse: true
    },
    purchaseState: {
      type: Number, // 0: pending, 1: purchased, 2: cancelled
      sparse: true
    },
    developerPayload: {
      type: String,
      sparse: true
    },
    isAcknowledged: {
      type: Boolean,
      default: false
    },
    isAutoRenewing: {
      type: Boolean,
      default: false
    },
    purchaseType: {
      type: String,
      enum: ['subscription', 'one-time'],
      sparse: true
    }
  },
  
  // ===================== PAYMENT STATUS & VERIFICATION =====================
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled', 'expired'],
    default: 'pending'
  },
  
  // Receipt verification status
  receiptVerified: {
    type: Boolean,
    default: false
  },
  receiptVerifiedAt: {
    type: Date,
    sparse: true
  },
  receiptVerificationAttempts: {
    type: Number,
    default: 0
  },
  
  // Subscription status from platform
  platformSubscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending', 'unknown'],
    default: 'unknown'
  },
  
  // Auto-renewal status
  autoRenewStatus: {
    type: Boolean,
    default: false
  },
  
  // ===================== ADDITIONAL FIELDS =====================
  
  notes: {
    type: String,
    maxLength: 500
  },
  
  // Metadata for tracking
  metadata: {
    deviceId: String,
    appVersion: String,
    osVersion: String,
    purchaseSource: {
      type: String,
      enum: ['app_store', 'play_store', 'web', 'admin'],
      default: 'app_store'
    }
  }
}, { timestamps: true });

// Indexes for better performance
userSubscriptionSchema.index({ client: 1, coach: 1 });
userSubscriptionSchema.index({ platform: 1 });
userSubscriptionSchema.index({ paymentStatus: 1 });
userSubscriptionSchema.index({ isActive: 1 });
userSubscriptionSchema.index({ 'applePurchase.transactionId': 1 }, { sparse: true });
userSubscriptionSchema.index({ 'googlePurchase.purchaseToken': 1 }, { sparse: true });
userSubscriptionSchema.index({ endDate: 1 });

// Virtual for getting platform-specific purchase info
userSubscriptionSchema.virtual('purchaseInfo').get(function() {
  if (this.platform === 'ios') {
    return {
      platform: 'ios',
      transactionId: this.applePurchase?.transactionId,
      productId: this.applePurchase?.productId,
      receiptData: this.applePurchase?.receiptData,
      environment: this.applePurchase?.environment
    };
  } else if (this.platform === 'android') {
    return {
      platform: 'android',
      purchaseToken: this.googlePurchase?.purchaseToken,
      orderId: this.googlePurchase?.orderId,
      productId: this.googlePurchase?.productId,
      packageName: this.googlePurchase?.packageName
    };
  }
  return { platform: this.platform };
});

// Virtual for checking if subscription is valid
userSubscriptionSchema.virtual('isValid').get(function() {
  return this.isActive && 
         this.paymentStatus === 'completed' && 
         this.receiptVerified && 
         new Date() <= this.endDate;
});

// Ensure virtuals are included when converting to JSON
userSubscriptionSchema.set('toJSON', { virtuals: true });
userSubscriptionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);