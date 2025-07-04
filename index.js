const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
require("dotenv").config();


const app = express();
const server = http.createServer(app); // Use this instead of app.listen
const setupSocket = require("./src/Utils/socket"); // We'll create this next


app.use(
  cors({
    origin: "*", // allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true, // allow cookies if needed
  })
);

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));

// Import routes
const userRoutes = require("./src/Routes/UserRoutes/userRoutes");
const productRoutes = require("./src/Routes/ProductRoutes/productRoutes");
const superAdminRoutes = require("./src/Routes/SuperAdminRoutes/superAdminRoutes");
const coachSellerRoutes = require("./src/Routes/CoachSellerRoute/coachSeller");
const exerciseRoutes = require("./src/Routes/ExerciseRoutes/exercise");
const userExerciseRoutes = require("./src/Routes/ExerciseRoutes/userExercise");
const aiWorkoutPlanner = require("./src/Routes/ExerciseRoutes/aiFeatures");
const calculateBmi = require("./src/Routes/BmiCalulator/bmi");
const nutritionRoutes = require("./src/Routes/NutirtionRoutes/nutrition");
const aiNutritionPlanner = require("./src/Routes/NutirtionRoutes/aiNutrition");
const cartRoutes = require("./src/Routes/ProductRoutes/cart");
const coachingSessionRoutes = require("./src/Routes/CoachingSessionRoutes/coahingSession");

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/superadmin", superAdminRoutes);
app.use("/api/v1/coach", coachSellerRoutes);
app.use("/api/v1/exercise", exerciseRoutes);
app.use("/api/v1/user-exercise", userExerciseRoutes);
app.use("/api/v1/ai-workout", aiWorkoutPlanner);
app.use("/api/v1/bmi", calculateBmi);
app.use("/api/v1/nutrition", nutritionRoutes);
app.use("/api/v1/ai-nutrition", aiNutritionPlanner);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/coaching-session", coachingSessionRoutes);

// DB Connection
const { connectDB } = require("./src/Config/DbConnection");
connectDB();

// Initialize Socket.io
setupSocket(server);

server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
