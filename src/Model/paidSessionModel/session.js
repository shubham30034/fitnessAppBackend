const mongoose = require('mongoose');


// models/Session.js
const sessionSchema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }], // ⬅️ changed to array
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  zoomJoinUrl: { type: String, required: true },
  zoomMeetingId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
