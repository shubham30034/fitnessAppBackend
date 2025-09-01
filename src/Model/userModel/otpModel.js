const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isFailedAttempt: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Add index for rate limiting queries
otpSchema.index({ userId: 1, isFailedAttempt: 1, createdAt: -1 });

module.exports = mongoose.model('Otp', otpSchema);
