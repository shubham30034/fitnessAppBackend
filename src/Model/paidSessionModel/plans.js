const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
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
    type: Number, // in days
    required: true
  },
  sessionsPerMonth: {
    type: Number,
    required: true,
    default: 4
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
  features: [{
    type: String
  }],
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
}, { timestamps: true });

// Index for better query performance
planSchema.index({ isActive: 1 });
planSchema.index({ category: 1 });
planSchema.index({ name: 1 });

module.exports = mongoose.model('Plan', planSchema);
