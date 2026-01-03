const mongoose = require("mongoose");

const UserDietProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per user
    },

    age: Number,

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    heightCm: Number,
    weightKg: Number,

    goal: {
      type: String,
      enum: ["weight_loss", "muscle_gain", "maintenance"],
    },

    dietaryPreferences: {
      type: [String],
      default: [],
    },

    medicalConditions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserDietProfile", UserDietProfileSchema);
