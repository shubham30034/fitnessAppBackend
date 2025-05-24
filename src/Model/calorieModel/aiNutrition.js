const mongoose = require('mongoose');

const MealItemSchema = new mongoose.Schema({
  name: String,
  quantity: String, // e.g., '100g'
  calories: Number,
}, { _id: false });

const MealSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
  },
  items: [MealItemSchema],
}, { _id: false });

const DayPlanSchema = new mongoose.Schema({
  date: Date, // e.g., 2025-05-22
  dayOfWeek: {
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  meals: [MealSchema],
  totalCalories: Number,
}, { _id: false });

const WeeklyPlanSchema = new mongoose.Schema({
  weekNumber: Number,
  startDate: Date, // e.g., 2025-05-18
  endDate: Date,   // e.g., 2025-05-24
  days: {
    type: [DayPlanSchema], // Should contain exactly 7 entries
    validate: {
      validator: function(v) {
        return v.length === 7;
      },
      message: props => `Each weekly plan must have exactly 7 days, but got ${props.value.length}`
    }
  },
}, { _id: false });

const UserDietProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  age: Number,
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  heightCm: Number,
  weightKg: Number,
  goal: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'maintenance'],
  },
  dietaryPreferences: [String],
  medicalConditions: [String],
  weeklyPlans: {
    type: [WeeklyPlanSchema],
    validate: {
      validator: function(v) {
        return v.length >= 1 && v.length <= 4;
      },
      message: props => `weeklyPlans must have between 1 and 4 weeks, but got ${props.value.length}`
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AIDiet', UserDietProfileSchema);
