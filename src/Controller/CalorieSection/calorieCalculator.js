const Calorie = require("../../Model/calorieModel/calorieModel");
require("dotenv").config();
const fetch = require("node-fetch"); // make sure to install node-fetch if not already
const openRouter = require("../../Utils/aiApi")
const {fetchNutritionFromAI} = require("../../services/nutritionSection/aiNutrition")

// Convert various units to grams (expand as needed)
const unitToGrams = (unit, quantity) => {
  const unitMap = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    ml: 1,       // approx 1ml = 1g for water-like foods
    litre: 1000,
    cup: 240,
    tbsp: 15,
    tsp: 5,
    piece: null, // variable, not supported in conversion here
  };

  unit = unit?.toLowerCase();

  if (!unit || !unitMap[unit]) return null;
  if (unitMap[unit] === null) return null;

  return quantity * unitMap[unit];
};

// Fetch nutrition from AI with strict null on invalid food
// shifted into the service section



// Controller: searchFood
exports.searchFood = async (req, res) => {
  try {
    const { foodName, quantity = 100, unit = "g" } = req.body;

    if (!foodName || typeof foodName !== "string") {
      return res.status(400).json({
        success: false,
        message: "Food name is required and must be a string.",
        data: null,
      });
    }

    const normalizedName = foodName.trim().toLowerCase();

    // Convert user quantity+unit to grams
    const quantityInGrams = unitToGrams(unit, quantity);

    if (quantityInGrams === null || quantityInGrams <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or unsupported unit/quantity provided.",
        data: null,
      });
    }

    // Step 1: Search in DB
    let food = await Calorie.findOne({ foodName: normalizedName });

    if (!food) {
      // Step 2: Fallback to AI/API
      const aiData = await fetchNutritionFromAI(normalizedName);

      if (!aiData) {
        return res.status(404).json({
          success: false,
          message: "Food not found. Please enter a valid food item.",
          data: null,
        });
      }

      // Step 3: Save in DB
      food = new Calorie(aiData);
      await food.save();
    }

    // Scale nutrition info based on requested quantity
    const factor = quantityInGrams / food.baseQuantityInGrams;

    const responseData = {
      foodName: food.foodName,
      quantity: quantityInGrams,
      calories: +(food.calories * factor).toFixed(2),
      protein: +(food.protein * factor).toFixed(2),
      carbs: +(food.carbs * factor).toFixed(2),
      fats: +(food.fats * factor).toFixed(2),
      sugar: +(food.sugar * factor).toFixed(2),
      fiber: +(food.fiber * factor).toFixed(2),
      unit: "grams",
      source: food._id ? "db" : "ai",
    };

    return res.status(200).json({
      success: true,
      message: "Nutrition data fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Search food error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      data: null,
    });
  }
};
