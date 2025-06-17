const mongoose = require('mongoose');

const coachSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  zoomAccessToken: {
    type: String,
  },
  zoomRefreshToken: {
    type: String,
  },
  zoomTokenExpiry: {
    type: Date,
  },
  zoomUserId: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Coach', coachSchema);
