const mongoose = require('mongoose');

// Helper to get the date 2 months ago
const twoMonthsAgo = new Date();
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

const setSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userExerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserExercise', required: true },
  reps: { type: Number, required: true },
  weight: { type: Number, required: true },
  notes: { type: String, default: '' },
  date: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function (value) {
        return value >= twoMonthsAgo; // Date must be within the last 2 months
      },
      message: 'Date must be within the last 2 months.',
    },
  },
});

// Optional: Delete sets older than 2 months automatically (TTL index)
setSchema.index({ date: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // 60 days

module.exports = mongoose.model('Set', setSchema);
