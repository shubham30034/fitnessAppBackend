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

  const weightNum = Number(weight);
  const heightNum = Number(height);

  if (weightNum <= 0 || heightNum <= 0) {
    return res.status(400).json({
      success: false,
      message: "Weight and height must be greater than zero",
    });
  }

  const heightM = heightNum / 100;
  const bmi = Number((weightNum / (heightM * heightM)).toFixed(2));

  try {
    const category = await BMICategory.findOne({
      min: { $lte: bmi },
      max: { $gte: bmi },
    });

    if (!category) {
      return res.status(200).json({
        success: true,
        bmi,
        category: "Unknown",
        dietAdvice: "Consult a health professional.",
      });
    }

    res.status(200).json({
      success: true,
      bmi,
      category: category.category,
      dietAdvice: category.dietAdvice,
    });
  } catch (err) {
    console.error("BMI calculation error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
