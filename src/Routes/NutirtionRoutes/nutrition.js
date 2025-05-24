const express = require("express");
const route = express.Router();

const {searchFood } = require("../../Controller/CalorieSection/calorieCalculator");

// Define a route to search for food
route.get("/search", searchFood);  // You can change it to POST if you're sending data in body



module.exports = route;
