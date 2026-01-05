const express = require("express");
const route = express.Router();

const {
  searchFood,
  setPieceWeight
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
addFoodToDay,
  getTodayCalories,
  removeFoodItem,

} = require("../../Controller/CalorieSection/caloriesRecorder");

// it should be post not get
route.post("/search", authentication, searchFood);

// set piece weight for foods like fruits
  route.post("/set-piece-weight", setPieceWeight);



// Route to record daily calories for today only
route.post("/record", authentication, addFoodToDay);

// Route to remove a food item from today's calories record
route.post("/remove-food", authentication, removeFoodItem);

// ✅ Route to get today's total calories
route.get("/today-calories", authentication, getTodayCalories);

module.exports = route;
