// Model/calorieModel/calorieModel.js
const mongoose = require("mongoose");

const calorieSchema = new mongoose.Schema(
  {
    foodName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    // Nutrition always per 100g
    baseQuantityInGrams: {
      type: Number,
      required: true,
      default: 100,
    },

    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fats: { type: Number, required: true },
    sugar: { type: Number, required: true },
    fiber: { type: Number, required: true },

    // 🔥 THIS IS THE CACHE (CRITICAL)
    averagePieceWeight: {
      type: Number, // grams per piece
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Calorie", calorieSchema);
