// Utils/unitToGram.js
const { fetchPieceWeightFromAI } = require("../services/nutritionSection/aiPieceWeights");

exports.unitToGrams = async ({ foodDoc, unit, quantity }) => {
  const qty = Number(quantity);
  if (!qty || qty <= 0) return null;

  const unitMap = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    ml: 1,
    litre: 1000,
    cup: 240,
    tbsp: 15,
    tsp: 5,
  };

  const u = unit.toLowerCase();

  // ✅ Normal units
  if (unitMap[u]) {
    return qty * unitMap[u];
  }

  // 🔥 PIECE LOGIC (NO REPEAT AI)
  if (u === "piece" || u === "pcs") {
    // 1️⃣ Already cached
    if (foodDoc.averagePieceWeight) {
      return qty * foodDoc.averagePieceWeight;
    }

    // 2️⃣ First time → AI
    const aiWeight = await fetchPieceWeightFromAI(foodDoc.foodName);
    if (!aiWeight) {
      throw new Error("PIECE_WEIGHT_REQUIRED");
    }

    // 3️⃣ SAVE ONCE
    foodDoc.averagePieceWeight = aiWeight;
    await foodDoc.save();

    return qty * aiWeight;
  }

  return null;
};
