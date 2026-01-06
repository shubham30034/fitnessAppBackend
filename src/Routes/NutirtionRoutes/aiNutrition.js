const express = require("express");
const router = express.Router();

const {
  upsertDietProfile,
  getDietProfile,
  generateAIDiet,
  getActiveDiet,
  deleteDietData,
} = require("../../Controller/CalorieSection/aiNutritionSuggestion");

const { authentication } = require("../../Middleware/userAuth");

/* =====================================================
   DIET PROFILE ROUTES
===================================================== */

// Create or update user diet profile
router.post("/profile", authentication, upsertDietProfile);

// Get user diet profile
router.get("/profile", authentication, getDietProfile);

// Delete diet profile + AI diet (reset)
router.delete("/", authentication, deleteDietData);

/* =====================================================
   AI DIET ROUTES
===================================================== */

// Generate or regenerate AI diet
router.post("/ai", authentication, generateAIDiet);

// Get currently active AI diet
router.get("/active", authentication, getActiveDiet);

module.exports = router;
