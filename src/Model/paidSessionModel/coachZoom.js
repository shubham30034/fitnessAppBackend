const mongoose = require('mongoose');

const coachZoomSchema = new mongoose.Schema(
{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // one Zoom connection per coach
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

  isConnected: {
    type: Boolean,
    default: false
  },

  lastConnectedAt: {
    type: Date
  }
},
{ timestamps: true }
);

// ✅ only non-duplicate index
coachZoomSchema.index({ isConnected: 1 });

module.exports = mongoose.model('CoachZoom', coachZoomSchema);
