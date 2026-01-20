const mongoose = require("mongoose")


const refreshSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true, // hashed refresh token
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  }
}, { timestamps: true });

refreshSchema.index({ userId: 1 });

module.exports = mongoose.model("Refresh", refreshSchema);
