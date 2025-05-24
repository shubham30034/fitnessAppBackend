const express = require('express');

const route = express.Router();


const {getAllExercises,getExerciseById,getAllExercisesFromJson,getExerciseByMuscelAndLevel} = require('../../Controller/ExerciseController/Exercise');


// Route to insert exercises from JSON file
route.post('/insertExercises', getAllExercisesFromJson);
route.get('/exercises',getAllExercises);
route.get('/exerciseById', getExerciseById);
route.get('/exerciseByMuscleAndLevel', getExerciseByMuscelAndLevel);


module.exports = route;