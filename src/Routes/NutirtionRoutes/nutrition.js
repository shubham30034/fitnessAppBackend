const express = require("express");
const route = express.Router();

const {
  searchFood
} = require("../../Controller/CalorieSection/calorieCalculator");

const {
  authentication,
  isAdmin,
  isCoach,
  isSeller,
  isSuperAdmin,
  isUser,
} = require("../../Middleware/userAuth");

const {
  recordDailyCalories,
  getTodayCalories,
  removeFoodItem
} = require("../../Controller/CalorieSection/caloriesRecorder");

// it should be post not get
route.post("/search", authentication, searchFood);

// Route to record daily calories for today only
route.post("/record", authentication, recordDailyCalories);

// Route to remove a food item from today's calories record
route.post("/remove-food", authentication, removeFoodItem);

// ✅ Route to get today's total calories
route.get("/today-calories", authentication, getTodayCalories);

module.exports = route;
