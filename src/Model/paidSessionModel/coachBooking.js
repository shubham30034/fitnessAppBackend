const mongoose = require('mongoose');

const monthlySessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
    required: true,
  },
  month: {
    type: String, // e.g., "2025-05"
    required: true,
  },
  sessionsPerWeek: {
    type: Number,
    required: true,
    default: 3, // or whatever is standard
  },
  sessionDays: [String], // e.g., ['Monday', 'Wednesday', 'Friday']
  timeSlot: {
    type: String, // e.g., "7:00 AM - 8:00 AM"
    required: true,
  },
  status: {
    type: String,
    enum: ['booked', 'cancelled', 'completed'],
    default: 'booked',
  },
  payment: {
    isPaid: {
      type: Boolean,
      default: false,
    },
    amount: Number,
    paymentDate: Date,
    method: String, // e.g., "UPI", "Card", etc.
  },
  bookedAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('MonthlySession', monthlySessionSchema);
