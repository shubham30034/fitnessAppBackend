// Model/fitnessModel/setSchema.js
const mongoose = require("mongoose");

// Helper: 90 days ago (single source of truth)
const getExpiryDate = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 90);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const setSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userExerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserExercise",
      required: true,
      index: true,
    },
    reps: { type: Number, required: true, min: 1 },
    weight: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "" },
    restTime: {
      type: Number,
      enum: [2, 3, 5],
      default: 2,
    },
    date: {
      type: Date,
      default: Date.now,
      validate: {
        validator(value) {
          return value >= getExpiryDate();
        },
        message: "Workout must be within last 90 days",
      },
    },
  },
  { timestamps: true }
);

// TTL cleanup
setSchema.index({ date: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

// Performance index
setSchema.index({ userId: 1, userExerciseId: 1, date: -1 });

module.exports = mongoose.model("Set", setSchema);
