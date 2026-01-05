const openRouter = require("../../Utils/aiApi");

const fetchRawNutritionFromAI = async (foodName) => {
  if (!foodName || typeof foodName !== "string") {
    return { status: "invalid" };
  }

  const safeFoodName = foodName
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, "");

  if (!safeFoodName) {
    return { status: "invalid" };
  }

  const prompt = `
You are a nutrition database.

ONLY return nutrition values for RAW, SINGLE-INGREDIENT, UNCOOKED foods.

If the food is cooked, prepared, a dish, or unclear,
return ONLY: null

Return ONLY JSON per 100 grams:
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "sugar": number,
  "fiber": number
}

Food: ${safeFoodName}
`.trim();

  try {
    const data = await openRouter(prompt);
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content || content.toLowerCase() === "null") {
      return { status: "not_raw" };
    }

    let nutrition;
    try {
      nutrition = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return { status: "invalid" };
      nutrition = JSON.parse(match[0]);
    }

    // physics sanity check
    const fields = ["calories", "protein", "carbs", "fats", "sugar", "fiber"];
    for (const f of fields) {
      if (typeof nutrition[f] !== "number" || nutrition[f] < 0) {
        return { status: "invalid" };
      }
    }

    if (
      nutrition.carbs > 100 ||
      nutrition.protein > 100 ||
      nutrition.fats > 100 ||
      nutrition.sugar > nutrition.carbs ||
      nutrition.calories > 900
    ) {
      return { status: "not_raw" };
    }

    return { status: "ok", data: nutrition };

  } catch (err) {
    console.error("AI error:", err.message);
    return { status: "error" };
  }
};

module.exports = { fetchRawNutritionFromAI };
