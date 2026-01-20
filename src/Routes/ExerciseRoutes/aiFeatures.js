const express = require("express");
const route = express.Router();

const {
  aiWorkoutPlanner,
  getWorkoutPlan,
  deleteWorkoutPlan,
} = require("../../Controller/ExerciseController/aiWorkoutSuggestion");

const { authentication } = require("../../Middleware/userAuth");

/* =====================================================
   AI WORKOUT PLAN ROUTES
===================================================== */

// Create OR Regenerate workout plan
route.post("/", authentication, aiWorkoutPlanner);

// Get current workout plan
route.get("/", authentication, getWorkoutPlan);

// Delete workout plan
route.delete("/", authentication, deleteWorkoutPlan);

module.exports = route;
