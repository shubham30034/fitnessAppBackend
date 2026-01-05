const Calorie = require("../../Model/calorieModel/calorieModel");
const { unitToGrams } = require("../../Utils/unitToGram");
const {
  fetchRawNutritionFromAI,
} = require("../../services/nutritionSection/aiNutrition");

const normalize = (str) =>
  str.toLowerCase().trim().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ");

exports.searchFood = async (req, res) => {
  try {
    const { foodName, quantity = 1, unit = "g" } = req.body;

    if (!foodName) {
      return res
        .status(400)
        .json({ success: false, message: "Food required" });
    }

    const normalized = normalize(foodName);
    const foodKey = `${normalized}__per100g`;

    let food = await Calorie.findOne({ foodKey });

    /* =====================================================
       RAW FOOD — FROM DB
    ===================================================== */
    if (food && food.foodCategory === "natural") {
      let grams;
      try {
        grams = unitToGrams({ foodDoc: food, unit, quantity });
      } catch (err) {
        if (err.message === "PIECE_WEIGHT_REQUIRED") {
          return res.status(422).json({
            success: false,
            code: "PIECE_WEIGHT_REQUIRED",
            message: "Piece weight required for this food",
            suggestions: [
              { label: "Small", grams: 120 },
              { label: "Medium", grams: 180 },
              { label: "Large", grams: 250 },
            ],
            default: 180,
          });
        }
        throw err;
      }

      if (grams == null) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid unit for raw food" });
      }

      const factor = grams / 100;

      return res.json({
        success: true,
        type: "raw",
        source: "db",
        info: `Nutrition calculated for ${grams} g of raw ${food.foodName}`,
        data: {
          foodName: food.foodName,
          grams,
          calories: +(food.calories * factor).toFixed(1),
          protein: +(food.protein * factor).toFixed(1),
          carbs: +(food.carbs * factor).toFixed(1),
          fats: +(food.fats * factor).toFixed(1),
          sugar: +(food.sugar * factor).toFixed(1),
          fiber: +(food.fiber * factor).toFixed(1),
        },
      });
    }

    /* =====================================================
       TRY RAW FOOD — VIA AI
    ===================================================== */
    const aiResult = await fetchRawNutritionFromAI(normalized);

    if (aiResult.status === "ok") {
      food = await Calorie.findOneAndUpdate(
        { foodKey },
        {
          $setOnInsert: {
            ...aiResult.data,
            foodKey,
            foodName: normalized,
            foodCategory: "natural",
            baseQuantityInGrams: 100,
            averagePieceWeight: { value: null, confidence: 0 },
          },
        },
        { upsert: true, new: true }
      );

      let grams;
      try {
        grams = unitToGrams({ foodDoc: food, unit, quantity });
      } catch (err) {
        if (err.message === "PIECE_WEIGHT_REQUIRED") {
          return res.status(422).json({
            success: false,
            code: "PIECE_WEIGHT_REQUIRED",
            message: "Piece weight required for this food",
            suggestions: [
              { label: "Small", grams: 120 },
              { label: "Medium", grams: 180 },
              { label: "Large", grams: 250 },
            ],
            default: 180,
          });
        }
        throw err;
      }

      if (grams == null) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid unit for raw food" });
      }

      const factor = grams / 100;

      return res.json({
        success: true,
        type: "raw",
        source: "ai",
        info: `Nutrition calculated for ${grams} g of raw ${food.foodName}`,
        data: {
          foodName: food.foodName,
          grams,
          calories: +(food.calories * factor).toFixed(1),
          protein: +(food.protein * factor).toFixed(1),
          carbs: +(food.carbs * factor).toFixed(1),
          fats: +(food.fats * factor).toFixed(1),
          sugar: +(food.sugar * factor).toFixed(1),
          fiber: +(food.fiber * factor).toFixed(1),
        },
      });
    }

    /* =====================================================
       GENERIC COMPOSED FOOD — ESTIMATE ONLY
    ===================================================== */
    const servings =
      Number.isFinite(+quantity) && +quantity > 0 ? +quantity : 1;

    const weightUnits = ["g", "kg", "ml", "l"];
    const usedWeightUnit = weightUnits.includes((unit || "").toLowerCase());

    let warningMessage;

    if (usedWeightUnit) {
      warningMessage =
        "Cooked food estimate: Weight units (g/kg/ml) are not applicable for cooked foods. Showing nutrition for normal serving(s) instead.";
    } else {
      warningMessage =
        "Estimated nutrition for a normal cooked food. Actual values may vary based on size, oil, and preparation.";
    }

    return res.json({
      success: true,
      type: "generic_composed",
      quantity: servings,
      unit: "serving",
      warning: warningMessage,
      info: `Nutrition shown for ${servings} normal serving(s)`,
      data: {
        calories: 250 * servings,
        protein: 10 * servings,
        carbs: 35 * servings,
        fats: 9 * servings,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
};



exports.setPieceWeight = async (req, res) => {
  const normalize = (str) =>
  str.toLowerCase().trim().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ");
  try {
    const { foodName, grams } = req.body;

    if (!foodName || !grams || grams <= 0) {
      return res.status(400).json({
        success: false,
        message: "Food name and valid grams are required",
      });
    }

    // 🧹 normalize
    const normalized = normalize(foodName);
    const foodKey = `${normalized}__per100g`;

    const food = await Calorie.findOne({ foodKey });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found",
      });
    }

    // 🔒 only for NATURAL foods
    if (food.foodCategory !== "natural") {
      return res.status(400).json({
        success: false,
        message: "Piece weight applicable only for natural foods",
      });
    }

    // 🧠 confidence-based update
    const oldValue = food.averagePieceWeight.value;
    const oldConfidence = food.averagePieceWeight.confidence || 0;

    // safety bounds (important)
    if (grams < 1 || grams > 500) {
      return res.status(400).json({
        success: false,
        message: "Unrealistic piece weight",
      });
    }

    let newValue;
    let newConfidence;

    if (!oldValue) {
      newValue = grams;
      newConfidence = 1;
    } else {
      newValue =
        (oldValue * oldConfidence + grams) / (oldConfidence + 1);
      newConfidence = Math.min(oldConfidence + 1, 20);
    }

    food.averagePieceWeight.value = Math.round(newValue);
    food.averagePieceWeight.confidence = newConfidence;

    await food.save();

    return res.status(200).json({
      success: true,
      message: "Piece weight saved",
      data: {
        foodName: food.foodName,
        pieceWeight: food.averagePieceWeight.value,
        confidence: food.averagePieceWeight.confidence,
      },
    });

  } catch (err) {
    console.error("setPieceWeight error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};




