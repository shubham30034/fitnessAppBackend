const express = require("express")
const app = express()

require("dotenv").config()

const {connectDB} = require("./src/Config/DbConnection")
connectDB()

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})
