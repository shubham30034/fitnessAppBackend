// utils/openRouter.js
const fetch = require("node-fetch"); // Node <18

const callOpenRouter = async (prompt) => {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DEEP_SEEK_KEY}`,
          "Content-Type": "application/json",

          // ⚠️ OpenRouter strongly recommends these
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "Fitness App Backend",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1", // ✅ FIXED
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenRouter error: ${response.status} - ${errorBody}`
      );
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("OpenRouter call failed:", err.message);
    throw err;
  }
};

module.exports = callOpenRouter;
