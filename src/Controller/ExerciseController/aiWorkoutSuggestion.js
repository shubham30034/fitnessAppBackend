const AIWorkoutPlan = require("../../Model/fitnessModel/aiWorkoutPlanner");
const User = require("../../Model/userModel/userModel");
const fetch = require("node-fetch");
const openRouter = require("../../Utils/aiApi")
const {aiWorkoutPlannerValidation} = require("../../validator/workoutValidation")

exports.aiWorkoutPlanner = async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal, fitness_level, total_weeks } = req.body;


    const {error} = aiWorkoutPlannerValidation({goal,fitness_level,total_weeks})

    if (error) {
  return res.status(400).json({ success: false, message: "Validation failed", errors: error.details.map(e => e.message) });
}



    const days_per_week = 5;
    const total_sessions = total_weeks * days_per_week;

    const schedule = {
      days_per_week,
      session_duration: 60
    };

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if workout plan already exists
    const existingPlan = await AIWorkoutPlan.findOne({ userId });
    if (existingPlan) {
      return res.status(400).json({ success: false, message: "Plan already exists" });
    }

    // Construct improved prompt
    const prompt = `
You are an expert fitness coach.

Create a workout plan lasting exactly ${total_weeks} weeks for a(n) ${fitness_level} individual with the goal: "${goal}".

The plan has 5 workout sessions per week (total ${total_sessions} sessions). Each session is approximately 60 minutes.

Number the sessions sequentially from "1" to "${total_sessions}".

Each session should contain:
- "day": session number as a string (e.g., "1", "2", ...)
- "focus": main muscle groups targeted (e.g., "Chest and Triceps")
- "exercises": an array of exercises with each exercise having:
   - "name": string (exercise name)
   - "sets": number
   - "reps": string (e.g., "8-10")
   - "notes": string (optional instructions)

Return ONLY a valid JSON object matching the structure below with NO explanations, no markdown, no extra text, no code fences, no comments:

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

Make sure:
- The JSON is complete and properly formatted.
- Strings use double quotes.
- No trailing commas.
- No partial or truncated JSON.

Your response should be only the JSON object above.
    `;

    // Call AI API
  const result = await openRouter(prompt)

    let content = result.choices?.[0]?.message?.content || "";

    // Remove markdown code fences if any
    if (content.startsWith("```")) {
      content = content.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    }

    // Parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return res.status(500).json({ success: false, message: "Invalid JSON from AI", error: err.message });
    }

    const sessions = parsed.sessions || [];

    // Days of the week in order
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    // Build weeks array from sessions
    const weeksMap = {};

    sessions.forEach((session) => {
      const sessionNumber = parseInt(session.day, 10);
      const weekNum = Math.ceil(sessionNumber / days_per_week);
      const dayIndex = (sessionNumber - 1) % days_per_week;

      if (!weeksMap[weekNum]) {
        weeksMap[weekNum] = [];
      }

      weeksMap[weekNum].push({
        day: dayNames[dayIndex],
        exercises: (session.exercises || []).map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps || "",
          notes: ex.notes || ""
        }))
      });
    });

    // Convert map to array
    const weeks = Object.keys(weeksMap).map(weekStr => ({
      week: parseInt(weekStr, 10),
      days: weeksMap[weekStr]
    }));

    // Save new workout plan
    const newPlan = new AIWorkoutPlan({
      userId,
      goal,
      fitness_level,
      total_weeks,
      schedule,
      weeks
    });

    await newPlan.save();

    res.status(201).json({ success: true, message: "Workout plan created", data: newPlan });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};







