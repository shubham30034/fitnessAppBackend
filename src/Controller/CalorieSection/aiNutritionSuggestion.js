const AiDiet = require("../../Model/calorieModel/aiNutrition");
const fetch = require("node-fetch"); // npm install node-fetch@2
const openRouter = require("../../Utils/aiApi")
const {aiDietPlanValidation,updateWeekValidation,updateDayValidation} = require("../../validator/calorieValidation")

require("dotenv").config()

function buildPrompt({ age, gender, heightCm, weightKg, goal, dietaryPreferences, medicalConditions, numDays }) {
  return `You are a professional dietitian. Create a JSON array of ${numDays} daily diet plans for a person with the following profile:
- Age: ${age}, Gender: ${gender}
- Height: ${heightCm} cm, Weight: ${weightKg} kg
- Goal: ${goal}
- Dietary Preferences: ${dietaryPreferences.length ? dietaryPreferences.join(', ') : 'none'}
- Medical Conditions: ${medicalConditions.length ? medicalConditions.join(', ') : 'none'}

Each day's plan must include 4 meals: breakfast, lunch, dinner, snack.
**Use typical Indian foods and dishes for all meals, considering common Indian dietary habits.**
Each meal should list items with name, quantity (with units), and approximate calories.

Respond ONLY with valid JSON in the format:
[
  {
    "meals": [
      {
        "type": "breakfast",
        "items": [
          { "name": "poha", "quantity": "100g", "calories": 250 }
        ]
      }
    ]
  }
]`.trim();
}


function injectDates(dietPlan) {
  const today = new Date();
  return dietPlan.map((day, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return { ...day, date: date.toISOString().split('T')[0] };
  });
}

function sanitizeJSON(json) {
  return json.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
}

async function getDietPlanFromAI(userData) {
  const prompt = buildPrompt({ ...userData, numDays: userData.numWeeks * 7 });

  

  const { choices } = await openRouter(prompt);
  const aiContent = choices?.[0]?.message?.content;

  if (!aiContent) throw new Error("No content from AI");

  console.log("AI Raw Response:", aiContent);

  try {
    const sanitized = sanitizeJSON(aiContent);
    console.log("Sanitized JSON:", sanitized);
    return JSON.parse(sanitized);
  } catch (err) {
    console.error("Failed to parse AI response:", aiContent);
    throw new Error("Invalid JSON from AI");
  }
}

// ai Diet plan controller
exports.aiDietPlan = async (req, res) => {
  try {
    const { id: userId } = req.user || {};

    // Validate request body with Joi
    const { error, value } = aiDietPlanValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map(e => e.message),
      });
    }

    // Destructure validated data
    const {
      age, gender, heightCm, weightKg,
      goal, dietaryPreferences = [],
      medicalConditions = [], numWeeks = 1,
    } = value;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    // Check if diet plan already exists for this user
    if (await AiDiet.findOne({ userId })) {
      return res.status(409).json({ success: false, message: "AI diet plan already exists for this user" });
    }

    // Get raw diet plan from AI service
    const rawPlan = await getDietPlanFromAI({
      age, gender, heightCm, weightKg,
      goal, dietaryPreferences, medicalConditions, numWeeks
    });

    // Inject dates into the plan
    const datedPlan = injectDates(rawPlan);

    if (!Array.isArray(datedPlan) || datedPlan.length !== numWeeks * 7) {
      return res.status(400).json({ success: false, message: `Expected ${numWeeks * 7} days in diet plan` });
    }

    // Format weekly plans
    const weeklyPlans = Array.from({ length: numWeeks }, (_, w) => {
      const days = datedPlan.slice(w * 7, (w + 1) * 7).map(day => {
        const totalCalories = day.meals.reduce(
          (sum, meal) => sum + meal.items.reduce((s, item) => s + item.calories, 0), 0
        );
        return {
          date: new Date(day.date),
          dayOfWeek: new Date(day.date).toLocaleDateString("en-US", { weekday: "long" }),
          meals: day.meals,
          totalCalories
        };
      });
      return {
        weekNumber: w + 1,
        startDate: new Date(days[0].date),
        endDate: new Date(days[6].date),
        days
      };
    });

    // Save diet plan to database
    const newDiet = await AiDiet.create({
      userId,
      age, gender, heightCm, weightKg,
      goal, dietaryPreferences, medicalConditions,
      weeklyPlans,
      createdAt: new Date()
    });

    // Respond with success
    res.status(201).json({ success: true, message: "AI diet plan created", data: newDiet });

  } catch (err) {
    console.error("Diet Plan Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



// Helper: create prompt for updating diet plan (week or day)
function createUpdatePrompt(existingPlan, userRequest) {
  return `
You are a nutritionist AI.

Here is the current diet plan JSON:
${JSON.stringify(existingPlan, null, 2)}

The user requests the following change:
"${userRequest}"

Please provide the updated diet plan JSON with this change applied
Respond ONLY with raw, valid JSON. Do NOT include explanations, comments, markdown, or any non-JSON text. Even a single comment will break the application.
  `;
}

// Helper: call AI API to get updated plan JSON
async function callAIForUpdate(prompt) {
  const data = await openRouter(prompt)

  if(!data){
    return res.status(400).json({
      success:false,
      message:"unable to fetch data from ai"
    })
  }



  const aiMessage = data.choices?.[0]?.message?.content;

  console.log("aiMessage",aiMessage)

  if (!aiMessage) throw new Error("No content received from AI");

  try {
    return JSON.parse(aiMessage);
  } catch {
    // fallback extract JSON block
    const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("Failed to parse updated plan JSON from AI response");
  }
}

// Controller: PATCH update entire week plan using AI
exports.updateWeekWithAI = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { weekNumber, userRequest } = req.body;

      const { error } = updateWeekValidation({ weekNumber, userRequest });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map(e => e.message),
      });
    }

    const userDiet = await AiDiet.findOne({ userId });
    if (!userDiet) return res.status(404).json({ success: false, message: "Diet plan not found" });

    const weekPlan = userDiet.weeklyPlans.find(wp => wp.weekNumber === weekNumber);
    if (!weekPlan) return res.status(404).json({ success: false, message: `Week ${weekNumber} not found` });

    const prompt = createUpdatePrompt(weekPlan, userRequest);
    const updatedWeekPlan = await callAIForUpdate(prompt);

    const result = await AiDiet.updateOne(
      { userId, "weeklyPlans.weekNumber": weekNumber },
      { $set: { "weeklyPlans.$": updatedWeekPlan } }
    );

    res.status(200).json({ success: true, message: "Week plan updated successfully with AI", updatedWeekPlan, result });
  } catch (error) {
    console.error("Error updating week plan with AI:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Controller: PATCH update single day plan using AI
exports.updateDayWithAI = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { weekNumber, date, userRequest } = req.body;

   const { error } = updateDayValidation({ weekNumber, date, userRequest });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map(e => e.message),
      });
    }
    const userDiet = await AiDiet.findOne({ userId });
    if (!userDiet) return res.status(404).json({ success: false, message: "Diet plan not found" });

    const weekPlan = userDiet.weeklyPlans.find(wp => wp.weekNumber === weekNumber);
    if (!weekPlan) return res.status(404).json({ success: false, message: `Week ${weekNumber} not found` });

    const dayPlan = weekPlan.days.find(d => d.date.toISOString().slice(0, 10) === date);
    if (!dayPlan) return res.status(404).json({ success: false, message: `Day ${date} not found in week ${weekNumber}` });

    const prompt = createUpdatePrompt(dayPlan, userRequest);
    const updatedDayPlan = await callAIForUpdate(prompt);

    const result = await AiDiet.updateOne(
      { userId, "weeklyPlans.weekNumber": weekNumber },
      { $set: { "weeklyPlans.$[week].days.$[day]": updatedDayPlan } },
      { arrayFilters: [{ "week.weekNumber": weekNumber }, { "day.date": new Date(date) }] }
    );

    res.status(200).json({ success: true, message: "Day plan updated successfully with AI", updatedDayPlan, result });
  } catch (error) {
    console.error("Error updating day plan with AI:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



// Controller: Get AI Diet Plan for logged-in user
exports.getDietPlan = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const userDiet = await AiDiet.findOne({ userId });

    if (!userDiet) {
      return res.status(404).json({
        success: false,
        message: "Diet plan not found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      data: userDiet,
    });
  } catch (error) {
    console.error("Error fetching diet plan:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};
