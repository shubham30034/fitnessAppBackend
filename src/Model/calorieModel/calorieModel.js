// Model/calorieModel/calorieModel.js
const mongoose = require("mongoose");

const PortionSchema = new mongoose.Schema(
  {
    label: String,          // "1 slice", "half plate"
    grams: Number,          // approx grams
  },
  { _id: false }
);

const calorieSchema = new mongoose.Schema(
  {
    // 🔑 internal identity
    foodKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    foodName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // 🔥 BEHAVIOR TYPE (THIS SOLVES INFINITE FOODS)
    foodCategory: {
      type: String,
      enum: ["natural", "composed", "packaged"],
      required: true,
    },

    baseQuantityInGrams: {
      type: Number,
      default: 100,
    },

    calories: Number,
    protein: Number,
    carbs: Number,
    fats: Number,
    sugar: Number,
    fiber: Number,

    // 🔹 ONLY FOR natural foods
    averagePieceWeight: {
      value: { type: Number, default: null },
      confidence: { type: Number, default: 0 },
    },

    // 🔹 ONLY FOR composed foods
    portions: {
      type: [PortionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Calorie", calorieSchema);
