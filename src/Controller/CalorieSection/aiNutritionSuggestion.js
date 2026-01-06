const AIDiet = require("../../Model/calorieModel/aiDiet");
const UserDietProfile = require("../../Model/calorieModel/userDietProfile");
const openRouter = require("../../Utils/aiApi");
const {
  dietProfileValidation,
  aiDietPlanValidation,
} = require("../../validator/calorieValidation");

/* =====================================================
   CONSTANTS
===================================================== */

const MAX_DAYS = 14;
const MAX_DAILY_CAL = 3000;
const MIN_DAILY_CAL = 1000;
const MAX_ITEM_CAL = 800;
const MAX_ITEM_GRAMS = 500;
const GENERATE_COOLDOWN_MINUTES = 10;

/* =====================================================
   HELPERS
===================================================== */

const now = () => new Date();

const getExpiryDate = (days) => {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return d;
};

/* =====================================================
   PROMPT
===================================================== */

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
Return STRICT VALID JSON ONLY.
NO markdown.
NO explanations.
NO reasoning.
NO comments.

Create a ${numDays}-day Indian diet plan.

Rules:
- Vegetarian Indian food
- Quantity in grams
- Calories realistic
- JSON must be COMPLETE

JSON format:
{
  "days": [
    {
      "label": "Day 1",
      "meals": [
        {
          "name": "Breakfast",
          "items": [
            { "food": "Poha", "quantityGrams": 100, "calories": 250 }
          ]
        }
      ]
    }
  ]
}

User:
Age: ${age}
Gender: ${gender}
Height: ${heightCm}
Weight: ${weightKg}
Goal: ${goal}
Dietary Preferences: ${
  dietaryPreferences.length ? dietaryPreferences.join(", ") : "none"
}
Medical Conditions: ${
  medicalConditions.length ? medicalConditions.join(", ") : "none"
}
`.trim();

/* =====================================================
   SAFE JSON EXTRACTION (FIXED)
===================================================== */

const extractJSON = (text) => {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("NO_JSON_FOUND");

  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error("INVALID_JSON");
  }
};

/* =====================================================
   AI RESPONSE VALIDATION
===================================================== */

const validateDietPlan = (diet) => {
  if (!diet || !Array.isArray(diet.days)) {
    throw new Error("AI_INVALID_STRUCTURE");
  }

  diet.days.forEach((day) => {
    if (!Array.isArray(day.meals)) {
      throw new Error("AI_INVALID_MEALS");
    }

    let dailyTotal = 0;

    day.meals.forEach((meal) => {
      if (!Array.isArray(meal.items)) {
        throw new Error("AI_INVALID_ITEMS");
      }

      meal.items.forEach((item) => {
        if (
          typeof item.calories !== "number" ||
          item.calories <= 0 ||
          item.calories > MAX_ITEM_CAL
        ) {
          throw new Error("AI_CALORIE_OUT_OF_RANGE");
        }

        if (
          typeof item.quantityGrams !== "number" ||
          item.quantityGrams <= 0 ||
          item.quantityGrams > MAX_ITEM_GRAMS
        ) {
          throw new Error("AI_GRAMS_OUT_OF_RANGE");
        }

        dailyTotal += item.calories;
      });
    });

    if (dailyTotal < MIN_DAILY_CAL || dailyTotal > MAX_DAILY_CAL) {
      throw new Error("AI_DAILY_CAL_INVALID");
    }
  });

  return true;
};

/* =====================================================
   AI CALL (FIXED)
===================================================== */

const getDietFromAI = async (prompt) => {
  try {
    const data = await openRouter(prompt);

    console.log("AI RAW RESPONSE:", JSON.stringify(data, null, 2));

    if (data?.error) {
      throw new Error(data.error.message || "AI_PROVIDER_ERROR");
    }

    const choice = data?.choices?.[0];

    // 🔒 HANDLE TRUNCATION
    if (choice?.finish_reason === "length") {
      const e = new Error("AI_RESPONSE_TRUNCATED");
      e.statusCode = 502;
      throw e;
    }

    let content;

    if (typeof choice?.message?.content === "string") {
      content = choice.message.content;
    } else if (Array.isArray(choice?.message?.content)) {
      content = choice.message.content.map((c) => c.text || "").join("");
    } else if (typeof choice?.text === "string") {
      content = choice.text;
    }

    if (!content || typeof content !== "string") {
      throw new Error("NO_AI_RESPONSE");
    }

    const json = extractJSON(content);
    validateDietPlan(json);

    return json;
  } catch (err) {
    const msg = err.message || "";

    if (
      msg.includes("credit") ||
      msg.includes("402") ||
      msg.includes("quota")
    ) {
      const e = new Error("AI_CREDITS_EXHAUSTED");
      e.statusCode = 503;
      throw e;
    }

    if (
      msg.includes("NO_JSON") ||
      msg.includes("INVALID_JSON") ||
      msg.includes("AI_INVALID")
    ) {
      const e = new Error("AI_INVALID_RESPONSE");
      e.statusCode = 502;
      throw e;
    }

    if (msg.includes("AI_RESPONSE_TRUNCATED")) {
      const e = new Error("AI_RESPONSE_TRUNCATED");
      e.statusCode = 502;
      throw e;
    }

    const e = new Error("AI_SERVICE_FAILED");
    e.statusCode = 502;
    throw e;
  }
};

/* =====================================================
   PROFILE UPSERT
===================================================== */

exports.upsertDietProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false });

    const { error, value } = dietProfileValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    const profile = await UserDietProfile.findOneAndUpdate(
      { userId },
      { ...value, userId },
      { new: true, upsert: true }
    );

    return res.json({ success: true, data: profile });
  } catch {
    return res.status(500).json({ success: false });
  }
};

/* =====================================================
   GET DIET PROFILE
===================================================== */

exports.getDietProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false });

    const profile = await UserDietProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ success: false });

    return res.json({ success: true, data: profile });
  } catch {
    return res.status(500).json({ success: false });
  }
};

/* =====================================================
   GENERATE AI DIET
===================================================== */

exports.generateAIDiet = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false });

    const { error, value } = aiDietPlanValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    const IS_PAID_MODEL = process.env.AI_TIER === "paid";

    const numDays = IS_PAID_MODEL
      ? Math.min(value.numDays || 7, 7)
      : Math.min(value.numDays || 3, 3);

    const profile = await UserDietProfile.findOne({ userId });
    if (!profile) {
      return res.status(400).json({
        success: false,
        message: "Create diet profile first",
      });
    }

    const existing = await AIDiet.findOne({ userId });
    if (
      existing &&
      existing.createdAt &&
      now() - existing.createdAt <
        GENERATE_COOLDOWN_MINUTES * 60 * 1000
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait before regenerating diet",
      });
    }

    const prompt = buildPrompt({ ...profile.toObject(), numDays });
    const dietPlan = await getDietFromAI(prompt);

    const diet = await AIDiet.findOneAndUpdate(
      { userId },
      {
        userId,
        durationDays: numDays,
        dietPlan,
        expiresAt: getExpiryDate(numDays),
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, data: diet });
  } catch (err) {
    const status = err.statusCode || 500;

    const errorMap = {
      AI_CREDITS_EXHAUSTED:
        "Diet generation temporarily unavailable. Try later.",
      AI_INVALID_RESPONSE:
        "We couldn’t generate a valid diet plan. Please retry.",
      AI_RESPONSE_TRUNCATED:
        "Diet generation was cut short. Please retry.",
      AI_SERVICE_FAILED:
        "Diet generation service is currently unavailable.",
    };

    return res.status(status).json({
      success: false,
      message: errorMap[err.message] || "Internal error",
    });
  }
};

/* =====================================================
   GET ACTIVE DIET
===================================================== */

exports.getActiveDiet = async (req, res) => {
  try {
    const diet = await AIDiet.findOne({ userId: req.user.id });
    if (!diet) return res.status(404).json({ success: false });

    if (diet.expiresAt < now()) {
      await AIDiet.deleteOne({ _id: diet._id });
      return res.status(404).json({ success: false });
    }

    return res.json({ success: true, data: diet });
  } catch {
    return res.status(500).json({ success: false });
  }
};

/* =====================================================
   RESET
===================================================== */

exports.deleteDietData = async (req, res) => {
  await Promise.all([
    UserDietProfile.deleteOne({ userId: req.user.id }),
    AIDiet.deleteOne({ userId: req.user.id }),
  ]);

  return res.json({ success: true });
};
