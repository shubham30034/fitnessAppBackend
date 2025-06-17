// models/Session.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  zoomJoinUrl: { type: String, required: true },
  zoomMeetingId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
