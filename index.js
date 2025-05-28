const express = require("express")
const app = express()
const cors = require("cors")
const path = require("path")

require("dotenv").config()

app.use(express.json())
app.use(cors())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));



// Import routes
const userRoutes = require("./src/Routes/UserRoutes/userRoutes")
const productRoutes = require("./src/Routes/ProductRoutes/productRoutes")
const superAdminRoutes = require("./src/Routes/SuperAdminRoutes/superAdminRoutes")
const coachSellerRoutes = require("./src/Routes/CoachSellerRoute/coachSeller")
const exerciseRoutes = require("./src/Routes/ExerciseRoutes/exercise")
const userExerciseRoutes = require("./src/Routes/ExerciseRoutes/userExercise")
const aiWorkoutPlanner = require("./src/Routes/ExerciseRoutes/aiFeatures")
const calculateBmi = require("./src/Routes/BmiCalulator/bmi")
const nutritionRoutes = require("./src/Routes/NutirtionRoutes/nutrition")
const aiNutritionPlanner = require("./src/Routes/NutirtionRoutes/aiNutrition")


app.use("/api/v1/user", userRoutes)
app.use("/api/v1/products", productRoutes)
app.use("/api/v1/superadmin", superAdminRoutes)
app.use("/api/v1/coach", coachSellerRoutes)
app.use("/api/v1/exercise", exerciseRoutes)
app.use("/api/v1/user-exercise", userExerciseRoutes)
app.use("/api/v1/ai-workout",aiWorkoutPlanner)
app.use("/api/v1/bmi",calculateBmi)
app.use("/api/v1/nutrition",nutritionRoutes)
app.use("/api/v1/ai-nutrition",aiNutritionPlanner)





const {connectDB} = require("./src/Config/DbConnection")
connectDB()

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})
