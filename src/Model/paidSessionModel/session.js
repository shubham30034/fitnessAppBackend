const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  users: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }],
  coach: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  date: { 
    type: Date, 
    required: true 
  },
  startTime: { 
    type: String, 
    required: true 
  },
  endTime: { 
    type: String, 
    required: true 
  },
  zoomJoinUrl: { 
    type: String, 
    required: true 
  },
  zoomMeetingId: { 
    type: String 
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  sessionType: {
    type: String,
    enum: ['individual', 'group', 'workshop'],
    default: 'individual'
  },
  notes: {
    type: String,
    maxLength: 1000
  },
  attendance: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      default: 'absent'
    },
    joinedAt: Date,
    leftAt: Date
  }],
  duration: {
    type: Number, // in minutes
    default: 60
  },
  monthlyFee: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
