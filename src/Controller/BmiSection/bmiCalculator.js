const BMICategory = require("../../Model/bmiCategorySchema/bmiCategorySchema");

exports.calculateBMI = async (req, res) => {
  const { weight, height } = req.body;

  // Basic presence check
  if (weight === undefined || height === undefined) {
    return res.status(400).json({ error: "Weight and height are required" });
  }

  // Type and range validation
  const weightNum = Number(weight);
  const heightNum = Number(height);

  if (isNaN(weightNum) || isNaN(heightNum)) {
    return res.status(400).json({ error: "Weight and height must be numbers" });
  }

  if (weightNum <= 0 || heightNum <= 0) {
    return res.status(400).json({ error: "Weight and height must be positive values" });
  }

  // Optional: add reasonable limits
  if (weightNum > 500 || heightNum > 300) {
    return res.status(400).json({ error: "Weight or height values are unrealistically high" });
  }

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
