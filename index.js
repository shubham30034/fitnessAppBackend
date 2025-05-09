const express = require("express")
const app = express()
const cors = require("cors")

require("dotenv").config()

app.use(express.json())
app.use(cors())


// Import routes
const userRoutes = require("./src/Routes/UserRoutes/userRoutes")
const productRoutes = require("./src/Routes/ProductRoutes/productRoutes")
const superAdminRoutes = require("./src/Routes/SuperAdminRoutes/superAdminRoutes")
const coachSellerRoutes = require("./src/Routes/ProductRoutes/coachSeller")


app.use("/api/v1/user", userRoutes)
app.use("/api/v1/products", productRoutes)
app.use("/api/v1/superadmin", superAdminRoutes)
app.use("/api/v1/coach", coachSellerRoutes)




const {connectDB} = require("./src/Config/DbConnection")
connectDB()

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})
