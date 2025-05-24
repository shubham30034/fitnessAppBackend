const express = require("express");
const route = express.Router();

const { calculateBMI } = require("../../Controller/BmiSection/bmiCalculator");

// Example POST route to calculate BMI
route.post("/calculate", calculateBMI);

module.exports = route;
