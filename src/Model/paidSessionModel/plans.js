const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
    unique: true
  },

  description: {
    type: String,
    required: true
  },

  duration: {
    type: Number,
    required: true
  },

  sessionsPerMonth: {
    type: Number,
    default: 4,
    required: true
  },

  basePrice: {
    type: Number,
    required: true,
    min: 0
  },

  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  },

  isActive: {
    type: Boolean,
    default: true
  },

  features: [String],

  category: {
    type: String,
    enum: ['basic', 'premium', 'elite', 'custom'],
    default: 'basic'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
},
{ timestamps: true }
);

// ✅ ONLY non-duplicate indexes
planSchema.index({ isActive: 1 });
planSchema.index({ category: 1 });

module.exports = mongoose.model('Plan', planSchema);
