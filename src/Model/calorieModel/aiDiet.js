const mongoose = require("mongoose");

const AIDietSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one active diet per user
    },

    durationDays: {
      type: Number,
      required: true,
    },

    dietPlan: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// ✅ TTL index (ONLY here)
AIDietSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AIDiet", AIDietSchema);
