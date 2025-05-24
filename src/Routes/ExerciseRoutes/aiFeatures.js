const express = require('express');
const route = express.Router();

const { aiWorkoutPlanner } = require("../../Controller/ExerciseController/aiWorkoutSuggestion");
const { authentication } = require("../../Middleware/userAuth");


// Define a POST route to create a workout plan
route.post('/create-plan',authentication, aiWorkoutPlanner);

module.exports = route;
