const mongoose = require('mongoose');

const userAdditionalInfoSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, 
  },
  email: {
    type: String,
    sparse: true,
  },
  address: {
    type: String,
  },
  profilePicture: {
    type: String,
  },
  profilePictureSizes: {
    thumbnail: String,
    small: String,
    medium: String,
    large: String,
    original: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('UserAdditionalInfo', userAdditionalInfoSchema);
