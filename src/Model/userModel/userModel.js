const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  additionalInfo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAdditionalInfo',
  },
  role: {
    type: String,
    enum: ['user', 'coach', 'superadmin', 'admin', 'seller', 'coachmanager'],
    default: 'user',
    required: true,
  },
  password: {
    type: String, // Only required for coach, seller, etc.
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });


module.exports = mongoose.model("User", userSchema);
