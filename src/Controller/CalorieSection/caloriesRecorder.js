const CalorieRecord = require("../../Model/calorieModel/caloriesRecorder");
const Calorie = require("../../Model/calorieModel/calorieModel");
const { fetchNutritionFromAI } = require("../../services/nutritionSection/aiNutrition");

// Helper to get YYYY-MM-DD string for today in local timezone to match model validation
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get next midnight (start of next day)
const getNextMidnight = () => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight;
};

// Convert units to grams
const unitToGrams = (unit, quantity) => {
  const unitMap = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    ml: 1,
    litre: 1000,
    cup: 240,
    tbsp: 15,
    tsp: 5,
    piece: 50,
  };
  unit = unit?.toLowerCase();
  if (!unitMap[unit]) return null;
  return quantity * unitMap[unit];
};

exports.recordDailyCalories = async (req, res) => {
  try {
    const userId = req.user.id;
    const { foodName, quantity = 100, unit = "g", mealType } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });
    if (!foodName || !mealType) return res.status(400).json({ success: false, message: "Missing foodName or mealType" });

    const validMeals = ["breakfast", "lunch", "dinner", "snacks"];
    if (!validMeals.includes(mealType)) {
      return res.status(400).json({ success: false, message: "Invalid mealType" });
    }

    const date = getTodayDateString();
    const normalizedFoodName = foodName.toLowerCase().trim();
    const quantityInGrams = unitToGrams(unit, quantity);

    if (quantityInGrams === null) {
      return res.status(400).json({ success: false, message: "Invalid or unsupported unit." });
    }

    let foodData = await Calorie.findOne({ foodName: normalizedFoodName });

    if (!foodData) {
      const aiData = await fetchNutritionFromAI(normalizedFoodName);
      if (!aiData) {
        return res.status(404).json({ success: false, message: "Food not found" });
      }
      foodData = new Calorie(aiData);
      await foodData.save();
    }

    const factor = quantityInGrams / foodData.baseQuantityInGrams;

    const foodItem = {
      foodName: foodData.foodName,
      quantity: quantityInGrams,
      unit: "grams",
      calories: +(foodData.calories * factor).toFixed(2),
      protein: +(foodData.protein * factor).toFixed(2),
      carbs: +(foodData.carbs * factor).toFixed(2),
      fats: +(foodData.fats * factor).toFixed(2),
      sugar: +(foodData.sugar * factor).toFixed(2),
      fiber: +(foodData.fiber * factor).toFixed(2),
    };

    let record = await CalorieRecord.findOne({ userId, date });

    if (!record) {
      record = new CalorieRecord({
        userId,
        date,
        foods: { [mealType]: [foodItem] },
        totalCalories: foodItem.calories,
        totalProtein: foodItem.protein,
        totalCarbs: foodItem.carbs,
        totalFats: foodItem.fats,
        totalSugar: foodItem.sugar,
        totalFiber: foodItem.fiber,
        expiryDate: getNextMidnight(),
      });
    } else {
      record.foods[mealType].push(foodItem);
      record.totalCalories += foodItem.calories;
      record.totalProtein += foodItem.protein;
      record.totalCarbs += foodItem.carbs;
      record.totalFats += foodItem.fats;
      record.totalSugar += foodItem.sugar;
      record.totalFiber += foodItem.fiber;

      record.expiryDate = getNextMidnight(); // refresh expiry date on update
    }

    await record.save();

    return res.status(200).json({ success: true, message: "Food recorded", data: record });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getTodayCalories = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const today = getTodayDateString();
    const record = await CalorieRecord.findOne({ userId, date: today });

    return res.status(200).json({
      success: true,
      date: today,
      totalCalories: record ? record.totalCalories : 0,
      foods: record ? record.foods : { breakfast: [], lunch: [], dinner: [], snacks: [] },
    });
  } catch (error) {
    console.error("Error fetching today's calories:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeFoodItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mealType, foodId } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });
    if (!mealType || !foodId) return res.status(400).json({ success: false, message: "Missing mealType or foodId" });

    const validMeals = ["breakfast", "lunch", "dinner", "snacks"];
    if (!validMeals.includes(mealType)) {
      return res.status(400).json({ success: false, message: "Invalid mealType" });
    }

    const today = getTodayDateString();
    const record = await CalorieRecord.findOne({ userId, date: today });

    if (!record) return res.status(404).json({ success: false, message: "No calorie record found for today" });

    const mealFoods = record.foods[mealType];
    if (!mealFoods || mealFoods.length === 0) {
      return res.status(404).json({ success: false, message: "No foods found for this meal" });
    }

    // Find the food item index by _id
    const foodIndex = mealFoods.findIndex(item => item._id.toString() === foodId);
    if (foodIndex === -1) {
      return res.status(404).json({ success: false, message: "Food item not found" });
    }

    // Remove the food item
    const removedFood = mealFoods.splice(foodIndex, 1)[0];

    // Update totals
    record.totalCalories -= removedFood.calories;
    record.totalProtein -= removedFood.protein;
    record.totalCarbs -= removedFood.carbs;
    record.totalFats -= removedFood.fats;
    record.totalSugar -= removedFood.sugar;
    record.totalFiber -= removedFood.fiber;

    // Save updated record
    await record.save();

    return res.status(200).json({ success: true, message: "Food item removed", data: record });
  } catch (error) {
    console.error("Error removing food item:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
