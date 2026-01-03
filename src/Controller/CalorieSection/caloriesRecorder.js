// Controller/CalorieSection/caloriesRecorder.js

const Calorie = require("../../Model/calorieModel/calorieModel");
const CalorieRecord = require("../../Model/calorieModel/caloriesRecorder");

const { fetchNutritionFromAI } = require("../../services/nutritionSection/aiNutrition");
const { unitToGrams } = require("../../Utils/unitToGram");

/* =========================
   DATE HELPERS (FIXED)
========================= */

const getTodayDateString = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const getNextMidnight = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/* =========================
   RECORD DAILY CALORIES
========================= */
exports.recordDailyCalories = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { foodName, quantity = 1, unit = "g", mealType } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const allowedMeals = ["breakfast", "lunch", "dinner", "snacks"];
    if (!foodName || !allowedMeals.includes(mealType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid foodName or mealType",
      });
    }

    const normalizedFoodName = foodName.toLowerCase().trim();

    /* ---------- FOOD LOOKUP ---------- */
    let food = await Calorie.findOne({ foodName: normalizedFoodName });

    if (!food) {
      const aiFood = await fetchNutritionFromAI(normalizedFoodName);
      if (!aiFood) {
        return res.status(404).json({
          success: false,
          message: "Food not found",
        });
      }
      food = await Calorie.create(aiFood);
    }

    /* ---------- UNIT → GRAMS (STRICT + CACHED) ---------- */
    let grams;
    try {
      grams = await unitToGrams({
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

    if (!grams || grams <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity or unit",
      });
    }

    /* ---------- SCALE NUTRITION ---------- */
    const factor = grams / food.baseQuantityInGrams;

    const foodItem = {
      foodName: food.foodName,
      quantityInGrams: grams,
      calories: +(food.calories * factor).toFixed(2),
      protein: +(food.protein * factor).toFixed(2),
      carbs: +(food.carbs * factor).toFixed(2),
      fats: +(food.fats * factor).toFixed(2),
      sugar: +(food.sugar * factor).toFixed(2),
      fiber: +(food.fiber * factor).toFixed(2),
    };

    /* ---------- DAILY RECORD ---------- */
    const today = getTodayDateString();
    let record = await CalorieRecord.findOne({ userId, date: today });

    if (!record) {
      record = new CalorieRecord({
        userId,
        date: today,
        foods: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        totals: { calories: 0, protein: 0, carbs: 0, fats: 0, sugar: 0, fiber: 0 },
        expiresAt: getNextMidnight(),
      });
    }

    record.foods[mealType].push(foodItem);

    record.totals.calories += foodItem.calories;
    record.totals.protein += foodItem.protein;
    record.totals.carbs += foodItem.carbs;
    record.totals.fats += foodItem.fats;
    record.totals.sugar += foodItem.sugar;
    record.totals.fiber += foodItem.fiber;

    record.expiresAt = getNextMidnight();
    await record.save();

    return res.status(200).json({
      success: true,
      message: "Food recorded successfully",
      data: record,
      meta: {
        averagePieceWeight: food.averagePieceWeight || null,
      },
    });
  } catch (error) {
    console.error("recordDailyCalories error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================
   GET TODAY CALORIES
========================= */
exports.getTodayCalories = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false });
    }

    const today = getTodayDateString();
    const record = await CalorieRecord.findOne({ userId, date: today });

    if (!record) {
      return res.status(200).json({
        success: true,
        date: today,
        totals: null,
        foods: null,
      });
    }

    return res.status(200).json({
      success: true,
      date: today,
      totals: record.totals,
      foods: record.foods,
    });
  } catch (error) {
    console.error("getTodayCalories error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================
   REMOVE FOOD ITEM
========================= */
exports.removeFoodItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { mealType, foodItemId } = req.body;

    const allowedMeals = ["breakfast", "lunch", "dinner", "snacks"];

    if (!userId || !allowedMeals.includes(mealType) || !foodItemId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    const today = getTodayDateString();
    const record = await CalorieRecord.findOne({ userId, date: today });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No record found for today",
      });
    }

    const foodArray = record.foods[mealType];
    const itemIndex = foodArray.findIndex(
      (item) => item._id.toString() === foodItemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Food item not found",
      });
    }

    const [removed] = foodArray.splice(itemIndex, 1);

    // 🔽 Safe totals update
    record.totals.calories = Math.max(0, +(record.totals.calories - removed.calories).toFixed(2));
    record.totals.protein  = Math.max(0, +(record.totals.protein  - removed.protein ).toFixed(2));
    record.totals.carbs    = Math.max(0, +(record.totals.carbs    - removed.carbs   ).toFixed(2));
    record.totals.fats     = Math.max(0, +(record.totals.fats     - removed.fats    ).toFixed(2));
    record.totals.sugar    = Math.max(0, +(record.totals.sugar    - removed.sugar   ).toFixed(2));
    record.totals.fiber    = Math.max(0, +(record.totals.fiber    - removed.fiber   ).toFixed(2));

    await record.save();

    return res.json({
      success: true,
      message: "Food item removed successfully",
      data: record,
    });
  } catch (error) {
    console.error("removeFoodItem error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
