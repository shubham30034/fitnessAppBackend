// services/nutritionSection/aiNutrition.js
const openRouter = require("../../Utils/aiApi");

/**
 * Fetch nutrition data for 100 grams of a real edible food.
 * Returns null if food is invalid / not edible / AI response is bad.
 */
const fetchNutritionFromAI = async (foodName) => {
  if (!foodName || typeof foodName !== "string") return null;

  const safeFoodName = foodName
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, "");

  if (!safeFoodName) return null;

  const prompt = `
You are an expert nutritionist.

Only provide nutrition information for REAL, edible human foods.

If the food does NOT exist or is NOT edible,
respond ONLY with the word: null

Return ONLY valid JSON for 100 grams in EXACT format:
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "sugar": number,
  "fiber": number
}

No explanation.
No markdown.
No extra text.

Food: ${safeFoodName}
`.trim();

  try {
    const data = await openRouter(prompt);
  

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const lower = content.toLowerCase();
    if (
      lower === "null" ||
      lower.includes("not edible") ||
      lower.includes("does not exist") ||
      lower.includes("not a real food")
    ) {
      return null;
    }

    let nutrition;
    try {
      nutrition = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return null;
      nutrition = JSON.parse(match[0]);
    }

    const fields = ["calories", "protein", "carbs", "fats", "sugar", "fiber"];
    for (const f of fields) {
      if (typeof nutrition[f] !== "number" || nutrition[f] < 0) {
        return null;
      }
    }

    return {
      foodName: safeFoodName,
      baseQuantityInGrams: 100,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fats: nutrition.fats,
      sugar: nutrition.sugar,
      fiber: nutrition.fiber,
    };
  } catch (err) {
    console.error("AI nutrition fetch error:", err.message);
    return null;
  }
};

module.exports = { fetchNutritionFromAI };
