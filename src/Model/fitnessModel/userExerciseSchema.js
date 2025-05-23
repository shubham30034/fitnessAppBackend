const mongoose = require('mongoose');

const userExerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exerciseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exercise', 
    required: true,
    unique: true // Ensure each user can only have one entry per exercise
   }, // Same `exerciseId` as in Exercise schema
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserExercise', userExerciseSchema);
