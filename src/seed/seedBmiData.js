require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const BMICategory = require("../Model/bmiCategorySchema/bmiCategorySchema");


console.log("Loaded env:", process.env.JWT_SECRET);

// BMI category seed data
const seedData = [
  {
    category: "Underweight",
    min: 0,
    max: 18.4,
    dietAdvice: "Eat calorie-rich foods like nuts, bananas, cheese, and eggs. Eat more frequently."
  },
  {
    category: "Normal weight",
    min: 18.5,
    max: 24.9,
    dietAdvice: "Maintain a balanced diet of fruits, vegetables, lean proteins, and grains."
  },
  {
    category: "Overweight",
    min: 25,
    max: 29.9,
    dietAdvice: "Reduce processed food. Eat more fiber. Include cardio and strength training."
  },
  {
    category: "Obese",
    min: 30,
    max: 100,
    dietAdvice: "Consult a doctor. Follow a strict low-carb diet. Avoid sugary and fried foods."
  }
];

// Run the seed function
const seedBMIData = async () => {
  try {
    console.log(process.env.MONGO_URI,"dff")
    await mongoose.connect(process.env.MONGO_URI); // Use the same URI as your main app
    await BMICategory.deleteMany();
    await BMICategory.insertMany(seedData);
    console.log("✅ BMI category data seeded successfully.");
  } catch (err) {
    console.error("❌ Error seeding BMI data:", err);
  } finally {
    mongoose.disconnect();
  }
};

seedBMIData();
