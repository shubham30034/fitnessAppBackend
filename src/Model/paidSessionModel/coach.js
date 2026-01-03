const mongoose = require('mongoose');

const coachProfileSchema = new mongoose.Schema(
{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // one profile per coach
  },

  monthlyFee: {
    type: Number,
    required: true,
    default: 5000,
    min: 0
  },

  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  },

  feeUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  feeUpdatedAt: {
    type: Date,
    default: Date.now
  },

  specialization: [{
    type: String,
    enum: [
      'fitness',
      'yoga',
      'nutrition',
      'cardio',
      'strength',
      'flexibility',
      'weight-loss',
      'muscle-gain',
      'rehabilitation',
      'sports-specific'
    ]
  }],

  certification: [{
    name: String,
    issuingBody: String,
    year: Number,
    expiryDate: Date
  }],

  experience: {
    type: Number,
    default: 0
  },

  bio: {
    type: String,
    maxLength: 1000
  },

  isActive: {
    type: Boolean,
    default: true
  },

  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },

  totalSessions: {
    type: Number,
    default: 0
  },

  totalClients: {
    type: Number,
    default: 0
  }
},
{ timestamps: true }
);

// ✅ indexes (no duplicates)
coachProfileSchema.index({ isActive: 1 });
coachProfileSchema.index({ specialization: 1 });

module.exports = mongoose.model('CoachProfile', coachProfileSchema);
