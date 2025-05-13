const express = require("express")
const app = express()
const cors = require("cors")

require("dotenv").config()

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }));



// Import routes
const userRoutes = require("./src/Routes/UserRoutes/userRoutes")
const productRoutes = require("./src/Routes/ProductRoutes/productRoutes")
const superAdminRoutes = require("./src/Routes/SuperAdminRoutes/superAdminRoutes")
const coachSellerRoutes = require("./src/Routes/CoachSellerRoute/coachSeller")
const exerciseRoutes = require("./src/Routes/ExerciseRoutes/exercise")
const userExerciseRoutes = require("./src/Routes/ExerciseRoutes/userExercise")


app.use("/api/v1/user", userRoutes)
app.use("/api/v1/products", productRoutes)
app.use("/api/v1/superadmin", superAdminRoutes)
app.use("/api/v1/coach", coachSellerRoutes)
app.use("/api/v1/exercise", exerciseRoutes)
app.use("/api/v1/user-exercise", userExerciseRoutes)




const {connectDB} = require("./src/Config/DbConnection")
connectDB()

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})
