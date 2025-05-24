// utils/openRouter.js
const fetch = require("node-fetch"); // or use global fetch if using Node 18+

const callOpenRouter = async (prompt) => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEP_SEEK_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("OpenRouter call failed:", err.message);
    throw err;
  }
};

module.exports = callOpenRouter;
