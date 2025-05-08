const express = require("express")
const app = express()
const cors = require("cors")

require("dotenv").config()

app.use(express.json())
app.use(cors())


// Import routes
const userRoutes = require("./src/Routes/UserRoutes/userRoutes")


 app.use("/api/v1/user", userRoutes)




const {connectDB} = require("./src/Config/DbConnection")
connectDB()

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})
