const mongoose = require('mongoose');

const coachScheduleSchema = new mongoose.Schema({
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
  startTime: { type: String, required: true }, // e.g., "18:00"
  endTime: { type: String, required: true }    // e.g., "19:00"
}, { timestamps: true });

module.exports = mongoose.model('CoachSchedule', coachScheduleSchema);
