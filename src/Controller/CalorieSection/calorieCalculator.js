// Controller/CalorieSection/searchFood.js
const Calorie = require("../../Model/calorieModel/calorieModel");
const { fetchNutritionFromAI } = require("../../services/nutritionSection/aiNutrition");
const { unitToGrams } = require("../../Utils/unitToGram");

/* ================= HELPERS ================= */
const normalizeFoodName = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ");

/* ================= CONTROLLER ================= */
exports.searchFood = async (req, res) => {
  try {
    const { foodName, quantity = 100, unit = "g" } = req.body;

    if (!foodName || typeof foodName !== "string") {
      return res.status(400).json({
        success: false,
        message: "Food name is required",
      });
    }

    const normalizedName = normalizeFoodName(foodName);
    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Invalid food name",
      });
    }

    /* ---------- FOOD LOOKUP ---------- */
    let source = "db";
    let food = await Calorie.findOne({ foodName: normalizedName });

    // 🔹 Nutrition AI only once per food
    if (!food) {
      const aiData = await fetchNutritionFromAI(normalizedName);
      console.log("AI Nutrition Data:", aiData);
      if (!aiData) {
        return res.status(404).json({
          success: false,
          message: "Food not found",
        });
      }

      food = await Calorie.create(aiData);
      source = "ai";
    }

    /* ---------- UNIT → GRAMS ---------- */
    let quantityInGrams;
    try {
      quantityInGrams = await unitToGrams({
        foodDoc: food,
        unit,
        quantity,
      });
    } catch (err) {
      if (err.message === "PIECE_WEIGHT_REQUIRED") {
        return res.status(422).json({
          success: false,
          requireWeightInput: true,
          message: "1 piece ka approx weight grams me bataye",
        });
      }
      throw err;
    }

    if (!quantityInGrams || quantityInGrams <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit or quantity",
      });
    }

    /* ---------- SCALE ---------- */
    const factor = quantityInGrams / food.baseQuantityInGrams;

    return res.status(200).json({
      success: true,
      message: "Nutrition data fetched successfully",
      data: {
        foodName: food.foodName,
        quantityInGrams,
        unitUsed: unit,

        calories: +(food.calories * factor).toFixed(2),
        protein: +(food.protein * factor).toFixed(2),
        carbs: +(food.carbs * factor).toFixed(2),
        fats: +(food.fats * factor).toFixed(2),
        sugar: +(food.sugar * factor).toFixed(2),
        fiber: +(food.fiber * factor).toFixed(2),

        // 🔥 CONFIRM CACHE
        averagePieceWeight: food.averagePieceWeight || null,
        source,
      },
    });
  } catch (error) {
    console.error("searchFood error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}; 