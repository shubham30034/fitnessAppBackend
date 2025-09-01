const mongoose = require('mongoose');

const coachZoomSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  // Zoom authentication fields
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
  // Zoom connection status
  isConnected: {
    type: Boolean,
    default: false
  },
  lastConnectedAt: {
    type: Date
  }
}, { timestamps: true });

// Index for better query performance
coachZoomSchema.index({ user: 1 });
coachZoomSchema.index({ isConnected: 1 });

module.exports = mongoose.model('CoachZoom', coachZoomSchema);
