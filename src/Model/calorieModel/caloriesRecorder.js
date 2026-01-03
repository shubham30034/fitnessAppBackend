const mongoose = require("mongoose");

const FoodItemSchema = new mongoose.Schema({
  foodName: { type: String, required: true, lowercase: true, trim: true },
  quantityInGrams: { type: Number, required: true },

  calories: { type: Number, required: true },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fats: { type: Number, default: 0 },
  sugar: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
});

const CalorieRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },

    foods: {
      breakfast: { type: [FoodItemSchema], default: [] },
      lunch: { type: [FoodItemSchema], default: [] },
      dinner: { type: [FoodItemSchema], default: [] },
      snacks: { type: [FoodItemSchema], default: [] },
    },

    totals: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fats: { type: Number, default: 0 },
      sugar: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// 🔥 TTL index (ONLY here)
CalorieRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 🔒 One record per user per day
CalorieRecordSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("CalorieRecord", CalorieRecordSchema);
