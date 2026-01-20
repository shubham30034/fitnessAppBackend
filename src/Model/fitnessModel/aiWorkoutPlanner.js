const mongoose = require("mongoose");

const AIWorkoutPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true
    },

    goal: String,
    fitness_level: String,
    total_weeks: Number,

    // AI ka raw but validated output
    plan: {
      type: Object,
      required: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  }
);

module.exports = mongoose.model("AIWorkoutPlan", AIWorkoutPlanSchema);
