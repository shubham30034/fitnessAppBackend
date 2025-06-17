
const Calorie = require("../../Model/calorieModel/calorieModel");
const openRouter = require("../../Utils/aiApi");

// Fetch nutrition from AI with strict null on invalid food
const fetchNutritionFromAI = async (foodName) => {
  const prompt = `You are an expert nutritionist. Only provide nutrition info for real edible human foods. 
If the food is not edible or doesn't exist (e.g., misspelled or nonsense), respond ONLY with the word null.

Return ONLY a valid JSON object for 100 grams in this exact format:
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "sugar": number,
  "fiber": number
}

No explanations, no markdown, no extra text.

Food: ${foodName}`;

  try {
    const data = await openRouter(prompt)

   if(!data){
    return res.status(400).json({
      success:false,
      message:"unable to fetch data from ai"
    })
   }


   
    let content = data?.choices?.[0]?.message?.content?.trim();

    if (!content || content.toLowerCase() === "null") return null;

    // Extract JSON object if AI returns extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const nutritionJson = jsonMatch[0];
    const nutritionData = JSON.parse(nutritionJson);

    const requiredFields = ["calories", "protein", "carbs", "fats", "sugar", "fiber"];
    for (const field of requiredFields) {
      if (typeof nutritionData[field] !== "number" || nutritionData[field] < 0) {
        return null;
      }
    }

    return {
      foodName: foodName.toLowerCase(),
      baseQuantityInGrams: 100,
      calories: nutritionData.calories,
      protein: nutritionData.protein,
      carbs: nutritionData.carbs,
      fats: nutritionData.fats,
      sugar: nutritionData.sugar,
      fiber: nutritionData.fiber,
    };
  } catch (error) {
    console.error("AI fetch error:", error);
    return null;
  }
};




module.exports = {
  fetchNutritionFromAI,
};
