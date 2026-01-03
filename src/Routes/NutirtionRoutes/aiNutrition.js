const express = require("express");
const router = express.Router();

const {
  generateAIDiet,
  getActiveDiet,
} = require("../../Controller/CalorieSection/aiNutritionSuggestion");

const { authentication } = require("../../Middleware/userAuth");

/* =====================================================
   AI DIET ROUTES
===================================================== */

// Generate or regenerate AI diet (e.g. 7-day plan)
router.post("/generate-diet", authentication, generateAIDiet);

// Get currently active diet (if not expired)
router.get("/active-diet", authentication, getActiveDiet);

module.exports = router;
