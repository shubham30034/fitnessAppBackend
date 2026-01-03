// services/nutritionSection/aiPieceWeight.js
const openRouter = require("../../Utils/aiApi");

exports.fetchPieceWeightFromAI = async (foodName) => {
  const prompt = `
For the food "${foodName}",
what is the average weight in grams of ONE piece / serving?

Rules:
- Respond ONLY with a number
- No text, no explanation
- If unknown, respond with null
`.trim();

  try {
    const data = await openRouter(prompt);
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content || content.toLowerCase() === "null") return null;

    const weight = Number(content);
    if (!weight || weight <= 0 || weight > 1000) return null;

    return weight;
  } catch (err) {
    console.error("AI piece-weight error:", err.message);
    return null;
  }
};
