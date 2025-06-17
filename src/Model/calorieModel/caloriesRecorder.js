const mongoose = require("mongoose");

// Function to get today's date as YYYY-MM-DD string
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FoodItemSchema = new mongoose.Schema({
  foodName: { type: String, required: true, lowercase: true, trim: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  calories: { type: Number, required: true },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fats: { type: Number, default: 0 },
  sugar: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
});

const CalorieRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  date: { 
    type: String, 
    required: true,
    validate: {
      validator: function(value) {
        return value === getTodayDate();
      },
      message: "Date must be today's date only",
    }
  }, // YYYY-MM-DD
  foods: {
    breakfast: { type: [FoodItemSchema], default: [] },
    lunch: { type: [FoodItemSchema], default: [] },
    dinner: { type: [FoodItemSchema], default: [] },
    snacks: { type: [FoodItemSchema], default: [] },
  },
  totalCalories: { type: Number, default: 0 },
  totalProtein: { type: Number, default: 0 },
  totalCarbs: { type: Number, default: 0 },
  totalFats: { type: Number, default: 0 },
  totalSugar: { type: Number, default: 0 },
  totalFiber: { type: Number, default: 0 },

  expiryDate: { type: Date, required: true }, // TTL date
}, {
  timestamps: true,
});

// TTL index - deletes document automatically after expiryDate passes
CalorieRecordSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 });

// Unique index to avoid duplicate calorie records per user per day
CalorieRecordSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("CalorieRecord", CalorieRecordSchema);
