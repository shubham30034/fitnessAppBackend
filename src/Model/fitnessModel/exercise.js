const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  exerciseId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  bodyPart: {
    type: String,
    required: true
  },
  equipment: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Exercise', exerciseSchema);
