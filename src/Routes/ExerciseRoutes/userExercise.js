const express = require('express');
const router = express.Router();

const {
  addUserExercises,
  removeUserExercises,
  getUserExercises,
  recordSet,
  updateSet,
  getRecordedSets,
  getSetsByDate,
previousWorkOutOfExercise,
getExerciseRepsAnalytics,
getExerciseRepsToday,
compareTodayWithPreviousWorkout
} = require('../../Controller/ExerciseController/userExercise');

const { authentication } = require("../../Middleware/userAuth");

// Exercise Routes
router.post('/', authentication, addUserExercises);
router.get('/user-exercises', authentication, getUserExercises);
router.delete('/', authentication, removeUserExercises);

// Set Routes
router.post('/set', authentication, recordSet);
router.patch('/set', authentication, updateSet);
router.get('/set', authentication, getRecordedSets);
router.get('/set/previous-sets', authentication, previousWorkOutOfExercise);
router.get('/set/today', authentication, getExerciseRepsToday);
router.get('/sets/by-date', authentication, getSetsByDate);
router.get('/set/compare',authentication,compareTodayWithPreviousWorkout)

// Analytics Routes
router.get('/analytics', authentication,  getExerciseRepsAnalytics);


module.exports = router;
