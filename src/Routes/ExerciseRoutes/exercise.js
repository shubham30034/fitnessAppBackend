const express = require('express');

const route = express.Router();


const {getAllExercises,getExerciseById} = require('../../Controller/ExerciseController/Exercise');


route.get('/exercises',getAllExercises);
route.get('/exerciseById', getExerciseById);



module.exports = route;