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
    unique: true,
    sparse: true,
  },
  address: {
    type: String,
  },
  profilePicture: {
   type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('UserAdditionalInfo', userAdditionalInfoSchema);
