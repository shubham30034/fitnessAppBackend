const mongoose = require("mongoose");

const BMICategorySchema = new mongoose.Schema({
  category: String,
  min: Number,
  max: Number,
  dietAdvice: String
});

module.exports = mongoose.model("BMICategory", BMICategorySchema);
