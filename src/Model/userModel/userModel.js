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
    enum: ['user', 'coach', 'superadmin', 'admin', 'doctor', 'seller'],
    default: 'user',
    required: true,
  },
  password: {
    type: String, // Only required for coach, seller, etc.
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });


module.exports = mongoose.model("User", userSchema);
