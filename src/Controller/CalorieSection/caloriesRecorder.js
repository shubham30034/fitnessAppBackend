const CalorieRecord = require("../../Model/calorieModel/caloriesRecorder");
const Calorie = require("../../Model/calorieModel/calorieModel");
const { unitToGrams } = require("../../Utils/unitToGram");
const {
  fetchRawNutritionFromAI,
} = require("../../services/nutritionSection/aiNutrition");

/* ================= HELPERS ================= */

const normalize = (str) =>
  str.toLowerCase().trim().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ");

const todayString = () => new Date().toISOString().split("T")[0];

const todayExpiry = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const allowedMeals = ["breakfast", "lunch", "dinner", "snacks"];

/* ======================================================
   ADD FOOD TO DAY (DB + AI + UNIT + COMPOSED HANDLED)
====================================================== */
exports.addFoodToDay = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false });

    const { foodName, mealType, quantity, unit } = req.body;

    if (!foodName || !allowedMeals.includes(mealType) || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
      });
    }

    const normalized = normalize(foodName);
    const foodKey = `${normalized}__per100g`;

    let grams,
      calories,
      protein = 0,
      carbs = 0,
      fats = 0,
      sugar = 0,
      fiber = 0,
      isEstimated = false;

    /* ================= RAW FOOD (DB FIRST) ================= */
    let food = await Calorie.findOne({ foodKey });

    if (food && food.foodCategory === "natural") {
      grams = unitToGrams({ foodDoc: food, unit, quantity });
      if (grams == null)
        return res.status(400).json({ success: false, message: "Invalid unit" });

      const factor = grams / 100;
      calories = food.calories * factor;
      protein = food.protein * factor;
      carbs = food.carbs * factor;
      fats = food.fats * factor;
      sugar = food.sugar * factor;
      fiber = food.fiber * factor;
    } else {
      /* ================= TRY AI FOR RAW ================= */
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
            },
          },
          { upsert: true, new: true }
        );

        grams = unitToGrams({ foodDoc: food, unit, quantity });
        if (grams == null)
          return res
            .status(400)
            .json({ success: false, message: "Invalid unit" });

        const factor = grams / 100;
        calories = food.calories * factor;
        protein = food.protein * factor;
        carbs = food.carbs * factor;
        fats = food.fats * factor;
        sugar = food.sugar * factor;
        fiber = food.fiber * factor;
      } else {
        /* ================= COMPOSED FOOD ================= */
        isEstimated = true;

        const servings = Number(quantity) > 0 ? Number(quantity) : 1;
        const baseGrams = 180;

        grams = baseGrams * servings;
        calories = 250 * servings;
        protein = 10 * servings;
        carbs = 35 * servings;
        fats = 9 * servings;
      }
    }

    /* ================= DAILY LOG ================= */
    const today = todayString();
    let record = await CalorieRecord.findOne({ userId, date: today });

    if (!record) {
      record = await CalorieRecord.create({
        userId,
        date: today,
        expiresAt: todayExpiry(),
      });
    }

    record.foods[mealType].push({
      foodName: normalized,
      quantityInGrams: Math.round(grams),
      calories: Math.round(calories),
      protein: +protein.toFixed(1),
      carbs: +carbs.toFixed(1),
      fats: +fats.toFixed(1),
      sugar: +sugar.toFixed(1),
      fiber: +fiber.toFixed(1),
      isEstimated,
    });

    record.totals.calories += calories;
    record.totals.protein += protein;
    record.totals.carbs += carbs;
    record.totals.fats += fats;
    record.totals.sugar += sugar;
    record.totals.fiber += fiber;

    await record.save();

    return res.status(201).json({
      success: true,
      message: "Food added",
      isEstimated,
      data: record,
    });
  } catch (err) {
    console.error("addFoodToDay error:", err);
    return res.status(500).json({ success: false });
  }
};

/* ======================================================
   GET TODAY CALORIES
====================================================== */
exports.getTodayCalories = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false });

    const today = todayString();
    const record = await CalorieRecord.findOne({ userId, date: today });

    if (!record) {
      return res.json({
        success: true,
        date: today,
        totals: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          sugar: 0,
          fiber: 0,
        },
        foods: {
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
        },
      });
    }

    return res.json({
      success: true,
      date: today,
      totals: record.totals,
      foods: record.foods,
    });
  } catch (err) {
    console.error("getTodayCalories error:", err);
    return res.status(500).json({ success: false });
  }
};

/* ======================================================
   REMOVE FOOD ITEM
====================================================== */
exports.removeFoodItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { mealType, foodItemId } = req.body;

    if (!userId || !allowedMeals.includes(mealType) || !foodItemId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    const today = todayString();
    const record = await CalorieRecord.findOne({ userId, date: today });

    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: "No record found" });
    }

    const list = record.foods[mealType];
    const index = list.findIndex(
      (f) => f._id.toString() === foodItemId
    );

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Food not found" });
    }

    const [removed] = list.splice(index, 1);

    record.totals.calories = Math.max(
      0,
      record.totals.calories - removed.calories
    );
    record.totals.protein = Math.max(
      0,
      record.totals.protein - removed.protein
    );
    record.totals.carbs = Math.max(
      0,
      record.totals.carbs - removed.carbs
    );
    record.totals.fats = Math.max(0, record.totals.fats - removed.fats);
    record.totals.sugar = Math.max(
      0,
      record.totals.sugar - removed.sugar
    );
    record.totals.fiber = Math.max(
      0,
      record.totals.fiber - removed.fiber
    );

    await record.save();

    return res.json({
      success: true,
      message: "Food removed",
      data: record,
    });
  } catch (err) {
    console.error("removeFoodItem error:", err);
    return res.status(500).json({ success: false });
  }
};
