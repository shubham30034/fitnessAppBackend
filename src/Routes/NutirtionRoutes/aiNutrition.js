const express = require("express");
const router = express.Router(); // ✅ use `router`, not `route`

// Import the controller
const { aiDietPlan,updateWeekWithAI,updateDayWithAI,getDietPlan } = require("../../Controller/CalorieSection/aiNutritionSuggestion");

 const {authentication} = require("../../Middleware/userAuth")




// Define the POST route for generating AI diet plans
router.post("/generate-diet",authentication, aiDietPlan);
router.post("/update-week",authentication,updateWeekWithAI)
router.post("/update-day",authentication,updateDayWithAI)
router.get("/get-aiDiet",authentication,getDietPlan)

module.exports = router;
