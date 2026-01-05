// Utils/unitToGram.js

exports.unitToGrams = ({ foodDoc, unit, quantity }) => {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  if (!foodDoc || foodDoc.foodCategory !== "natural") return null;

  const u = (unit || "").toLowerCase();

  // weight units
  if (["g", "gram", "grams"].includes(u)) return qty;
  if (["kg", "kgs"].includes(u)) return qty * 1000;

  // volume units (liquids)
  if (["ml", "milliliter", "milliliters"].includes(u)) return qty;
  if (["l", "liter", "liters"].includes(u)) return qty * 1000;

  // pieces
  if (["piece", "pcs", "pc", "pieces"].includes(u)) {
    const pieceWeight = foodDoc.averagePieceWeight?.value;
    if (!pieceWeight) {
      throw new Error("PIECE_WEIGHT_REQUIRED");
    }
    return qty * pieceWeight;
  }

  return null;
};
