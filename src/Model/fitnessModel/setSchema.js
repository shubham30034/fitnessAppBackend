const mongoose = require('mongoose');

// Helper to get the date 3 months ago
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

const setSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userExerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserExercise', required: true },
  reps: { type: Number, required: true },
  weight: { type: Number, required: true },
  notes: { type: String, default: '' },
   restTime: { 
    type: Number, 
    enum: [2, 3, 5], 
    default: 2 // Default rest time is 2 minutes
  },
  date: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function (value) {
        return value >= threeMonthsAgo; // Date must be within the last 3 months
      },
      message: 'Date must be within the last 3 months.',
    },
  },
});

// Automatically delete sets older than 3 months (TTL index)
setSchema.index({ date: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 days

module.exports = mongoose.model('Set', setSchema);
