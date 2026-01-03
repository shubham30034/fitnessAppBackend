const AIDiet = require("../../Model/calorieModel/aiDiet");
const UserDietProfile = require("../../Model/calorieModel/userDietProfile");
const openRouter = require("../../Utils/aiApi");
const { aiDietPlanValidation } = require("../../validator/calorieValidation");

/* =====================================================
   HELPERS
===================================================== */

const getExpiryDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
};

const buildPrompt = ({
  age,
  gender,
  heightCm,
  weightKg,
  goal,
  dietaryPreferences,
  medicalConditions,
  numDays,
}) => `
You are a professional Indian nutritionist.

Create a ${numDays}-day diet plan in VALID JSON.

User profile:
Age: ${age}
Gender: ${gender}
Height: ${heightCm} cm
Weight: ${weightKg} kg
Goal: ${goal}
Dietary Preferences: ${dietaryPreferences.length ? dietaryPreferences.join(", ") : "none"}
Medical Conditions: ${medicalConditions.length ? medicalConditions.join(", ") : "none"}

Return ONLY JSON in this format:

{
  "days": [
    {
      "label": "Day 1",
      "meals": [
        {
          "name": "Breakfast",
          "items": [
            {
              "food": "Poha",
              "quantityGrams": 100,
              "calories": 250
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- No explanations
- No markdown
- No comments
- quantityGrams MUST be a number
`.trim();

/* =====================================================
   AI CALL
===================================================== */

const getDietFromAI = async (prompt) => {
  const data = await openRouter(prompt);
  const content = data?.choices?.[0]?.message?.content;

  if (!content) throw new Error("No response from AI");

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error("Invalid JSON from AI");
  }
};

/* =====================================================
   CREATE / REPLACE AI DIET
===================================================== */

exports.generateAIDiet = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { error, value } = aiDietPlanValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    const { numDays = 7 } = value;

    const profile = await UserDietProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "User diet profile not found",
      });
    }

    const prompt = buildPrompt({
      ...profile.toObject(),
      numDays,
    });

    const dietPlan = await getDietFromAI(prompt);

    // Replace existing diet if exists
    await AIDiet.findOneAndDelete({ userId });

    const diet = await AIDiet.create({
      userId,
      durationDays: numDays,
      dietPlan,
      expiresAt: getExpiryDate(numDays),
    });

    return res.status(201).json({
      success: true,
      message: "AI diet generated successfully",
      data: diet,
    });
  } catch (err) {
    console.error("AI Diet Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =====================================================
   GET ACTIVE DIET
===================================================== */

exports.getActiveDiet = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const diet = await AIDiet.findOne({ userId });
    if (!diet) {
      return res.status(404).json({
        success: false,
        message: "No active diet. Generate a new one.",
      });
    }

    return res.status(200).json({
      success: true,
      data: diet,
    });
  } catch (err) {
    console.error("Get Diet Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
