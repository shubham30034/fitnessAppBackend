// Model/fitnessModel/userExerciseSchema.js
const mongoose = require("mongoose");

const userExerciseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },
  },
  { timestamps: true }
);

// Unique per user
userExerciseSchema.index({ userId: 1, exerciseId: 1 }, { unique: true });

module.exports = mongoose.model("UserExercise", userExerciseSchema);
