const mongoose = require("mongoose");

const calorieSchema = new mongoose.Schema(
  {
    foodName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true, // add uniqueness so no duplicates
    },
    // Base quantity for which the nutrition info applies (in grams)
    baseQuantityInGrams: {
      type: Number,
      default: 100,
      required: true,
    },
    calories: {
      type: Number,
      required: true,
    },
    protein: {
      type: Number,
      required: true,
    },
    carbs: {
      type: Number,
      required: true,
    },
    fats: {
      type: Number,
      required: true,
    },
    sugar: {
      type: Number,
      required: true,
    },
    fiber: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("Calorie", calorieSchema);
