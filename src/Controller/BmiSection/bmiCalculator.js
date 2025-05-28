const BMICategory = require("../../Model/bmiCategorySchema/bmiCategorySchema");
const {calculateBMIValidation} = require("../../validator/bmiValidation")

exports.calculateBMI = async (req, res) => {
  const { weight, height } = req.body;

  const { error } = calculateBMIValidation({ weight, height });
  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map(e => e.message),
    });
  }

  // Convert to numbers after validation
  const weightNum = Number(weight);
  const heightNum = Number(height);

  const heightM = heightNum / 100;
  const bmi = weightNum / (heightM * heightM);

  try {
    const category = await BMICategory.findOne({
      min: { $lte: bmi },
      max: { $gte: bmi }
    });

    if (!category) {
      return res.status(404).json({ error: "No matching BMI category found" });
    }

    res.status(200).json({
      bmi: bmi.toFixed(2),
      category: category.category,
      dietAdvice: category.dietAdvice
    });
  } catch (error) {
    console.error("BMI calculation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};