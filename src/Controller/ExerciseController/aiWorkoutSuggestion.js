const AIWorkoutPlan = require("../../Model/fitnessModel/aiWorkoutPlanner");
const User = require("../../Model/userModel/userModel");
const openRouter = require("../../Utils/aiApi");
const { aiWorkoutPlannerValidation } = require("../../validator/workoutValidation");

/* =====================================================
   CREATE / REGENERATE AI WORKOUT PLAN (RAW SAVE)
===================================================== */
exports.aiWorkoutPlanner = async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal, fitness_level, total_weeks } = req.body;

    /* ---------- validation ---------- */
    const { error } = aiWorkoutPlannerValidation({
      goal,
      fitness_level,
      total_weeks,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map(e => e.message),
      });
    }

    /* ---------- user check ---------- */
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const days_per_week = 5;
    const total_sessions = total_weeks * days_per_week;

    /* ---------- AI PROMPT ---------- */
    const prompt = `
You are an expert fitness coach.

Create a workout plan for a ${fitness_level} person with goal "${goal}".

Rules:
- Duration: ${total_weeks} weeks
- Workouts per week: ${days_per_week}
- Total sessions: ${total_sessions}

Each session must include:
- day (string)
- focus (muscle group)
- exercises array:
  - name (string)
  - sets (number)
  - reps (string)
  - notes (string)

Return ONLY valid JSON:

{
  "sessions": [
    {
      "day": "1",
      "focus": "Chest and Triceps",
      "exercises": [
        { "name": "Bench Press", "sets": 4, "reps": "8-10", "notes": "Controlled reps" }
      ]
    }
  ]
}

No markdown.
No explanation.
Only JSON.
`;

    /* ---------- AI CALL ---------- */
    const result = await openRouter(prompt);
    let content = result?.choices?.[0]?.message?.content || "";

    if (content.startsWith("```")) {
      content = content.replace(/```(?:json)?/g, "").trim();
    }

    /* ---------- SAFE PARSE ---------- */
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({
        success: false,
        message: "AI returned invalid JSON",
      });
    }

    if (!parsed || !Array.isArray(parsed.sessions)) {
      return res.status(500).json({
        success: false,
        message: "Invalid AI workout plan structure",
      });
    }

    /* ---------- CREATE or REGENERATE ---------- */
    const existingPlan = await AIWorkoutPlan.findOne({ userId });

    if (existingPlan) {
      existingPlan.goal = goal;
      existingPlan.fitness_level = fitness_level;
      existingPlan.total_weeks = total_weeks;
      existingPlan.plan = parsed;
      existingPlan.createdAt = new Date();

      await existingPlan.save();

      return res.status(200).json({
        success: true,
        message: "Workout plan regenerated successfully",
        data: existingPlan,
      });
    }

    const newPlan = await AIWorkoutPlan.create({
      userId,
      goal,
      fitness_level,
      total_weeks,
      plan: parsed,
    });

    return res.status(201).json({
      success: true,
      message: "Workout plan created successfully",
      data: newPlan,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/* =====================================================
   GET CURRENT WORKOUT PLAN
===================================================== */
exports.getWorkoutPlan = async (req, res) => {
  try {
    const userId = req.user.id;

    const plan = await AIWorkoutPlan.findOne({ userId });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "No workout plan found",
      });
    }

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workout plan",
      error: error.message,
    });
  }
};

/* =====================================================
   DELETE WORKOUT PLAN
===================================================== */
exports.deleteWorkoutPlan = async (req, res) => {
  try {
    const userId = req.user.id;

    const deleted = await AIWorkoutPlan.findOneAndDelete({ userId });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "No workout plan to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Workout plan deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete workout plan",
      error: error.message,
    });
  }
};
