const mongoose = require('mongoose');

// Individual Exercise Schema
const ExerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sets: { type: Number, required: true },
  reps: { type: String },   // e.g., "12-15"
  notes: { type: String }
}, { _id: false });

// Daily Plan Schema (for a specific day like 'Monday')
const DailyPlanSchema = new mongoose.Schema({
  day: { type: String, required: true }, // e.g., 'Monday', 'Tuesday'
  exercises: [ExerciseSchema]
}, { _id: false });

// Weekly Plan Schema
const WeeklyPlanSchema = new mongoose.Schema({
  week: { type: Number, required: true}, 
  days: [DailyPlanSchema]
}, { _id: false });

// Main AI Workout Plan Schema
const AIWorkoutPlanSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  goal: { type: String, required: true },
  fitness_level: { type: String, required: true },
  total_weeks: { type: Number, required: true },
  schedule: { type: Object },  // Optional: can hold additional metadata
  weeks: [WeeklyPlanSchema],  // <-- New structure
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AIWorkoutPlan', AIWorkoutPlanSchema);
