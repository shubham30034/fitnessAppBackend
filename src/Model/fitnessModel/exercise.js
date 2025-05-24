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
  force: {
    type: String
  },
  level: {
    type: String
  },
  mechanic: {
    type: String,
    default: null
  },
  equipment: {
    type: String,
    required: true
  },
  primaryMuscles: {
    type: [String],
    default: []
  },
  secondaryMuscles: {
    type: [String],
    default: []
  },
  instructions: {
    type: [String],
    default: []
  },
  category: {
    type: String
  },
  images: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('Exercise', exerciseSchema);
