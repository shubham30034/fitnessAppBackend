// controllers/userExerciseController.js
const UserExercise = require('../../Model/fitnessModel/userExerciseSchema');
const Set = require('../../Model/fitnessModel/setSchema');



exports.addUserExercises = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exerciseIds } = req.body; // expect an array of exerciseId strings

    console.log('exerciseIds:', exerciseIds);

  if(!exerciseIds) {
    return res.status(400).json({ 
        success: false,
        message: "exerciseIds is required",
    })
  }

    if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) {
      return res.status(400).json({ error: 'exerciseIds must be a non-empty array' });
    }

    // Find already added ones
    const existing = await UserExercise.find({
      userId,
      exerciseId: { $in: exerciseIds }
    });

    const existingIds = existing.map(ex => ex.exerciseId);

    // Filter out duplicates
    const newExerciseIds = exerciseIds.filter(id => !existingIds.includes(id));

    // Prepare bulk documents
    const newExercises = newExerciseIds.map(id => ({
      userId,
      exerciseId: id
    }));

    // Insert many
    const inserted = await UserExercise.insertMany(newExercises);

    res.status(201).json({
        success: true,
      message: 'Exercises added successfully',
      added: inserted,
      skipped: existingIds // list of ones already present
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add exercises to tracker' });
  }
};


exports.getUserExercises = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('userId:', userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    const userExercises = await UserExercise.find({ userId }).populate({
      path: 'exerciseId',
      select: 'name bodyPart equipment',
    });

    if (!userExercises || userExercises.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No exercises found for this user',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User exercises fetched successfully',
      data: userExercises,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user exercises',
      error: error.message,
    });
  }
};


exports.removeUserExercises = async (req, res) => {
  
    try {
        const userId = req.user.id;
        const  {exerciseId} = req.body; // expect an array of exerciseId strings
    
      if(!exerciseId) {
        return res.status(400).json({ 
            success: false,
            message: "exerciseId is required",
        })
      }

     const deleted = await UserExercise.findByIdAndDelete({ _id: exerciseId});

     console.log('deleted:', deleted);

     if (!deleted) {
        return res.status(404).json({
            success: false,
            message: 'No exercises found for this user',
        });
     }
    
        return res.status(200).json({
        success: true,
        message: 'Exercises removed successfully',
        deleted: deleted,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
        success: false,
        message: 'Error removing user exercises',
        error: error.message,
        });
    }



}




// record a set for a tracked exercise
exports.recordSet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId, reps, weight, notes } = req.body;

    if (!userExerciseId || !reps || !weight) {
      return res.status(400).json({
        success: false,
        message: 'userExerciseId, reps, and weight are required'
      });
    }

    const set = new Set({ userExerciseId, reps, weight, notes, userId }); // ✅ include notes
    await set.save();

    res.status(201).json({
      success: true,
      message: 'Set added successfully',
      data: set
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to add set',
      error: err.message
    });
  }
};



// Get all recorded sets for a user
exports.getRecordedSets = async (req, res) => {
  try {
    const userId = req.user.id;

    
    const sets = await Set.find({ userId }).populate({
      path: 'userExerciseId', // 'ref' should be 'path' for populating with nested data
      populate: {
        path: 'exerciseId', // 'ref' is the model name, 'path' should be used for nested populate
        select: 'name bodyPart equipment',
      },
    });

    if (!sets || sets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No sets found for this user exercise',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User exercise sets fetched successfully',
      data: sets,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user exercises',
      error: error.message,
    });
  }
};


// Get exercise reps for today
exports.getExerciseRepsToday = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;



    if (!userId || !userExerciseId) {
      return res.status(400).json({
        success: false,
        message: 'userId and userExerciseId are required',
      });
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    const sets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).populate({
      path: 'userExerciseId',
      populate: {
        path: 'exerciseId',
        select: 'name bodyPart equipment',
      },
    });

    res.status(200).json({
      success: true,
      message: 'User exercise sets fetched successfully',
      data: sets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
};




// Helper to get the previous day's date in 'YYYY-MM-DD' format
function getPreviousDayDate() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1); // Ensure UTC alignment
  return yesterday.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

// Get exercise reps for the previous day
exports.getExerciseRepsPreviousDay = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    if (!userExerciseId) {
      return res.status(400).json({
        success: false,
        message: 'userExerciseId is required',
      });
    }

    const previousDayDate = getPreviousDayDate();

    const start = new Date(`${previousDayDate}T00:00:00.000Z`); // Start of previous day in UTC
    const end = new Date(`${previousDayDate}T23:59:59.999Z`); // End of previous day in UTC

    // Log the start and end dates to check for correctness
    console.log('Previous Day Start:', start);
    console.log('Previous Day End:', end);

    // Fetch sets from the database within the previous day date range
    const sets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: start, $lte: end }, // Date range for previous day
    })
      .sort({ date: 1 }) // Optional: Sort by exercise date
      .populate({
        path: 'userExerciseId',
        populate: {
          path: 'exerciseId',
          select: 'name bodyPart equipment',
        },
      });

    if (!sets.length) {
      return res.status(404).json({
        success: false,
        message: 'No sets found for this exercise on the previous day',
      });
    }

    // Calculate total reps for the previous day
    const totalRepsPreviousDay = sets.reduce((total, set) => total + (set.reps || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'Exercise reps for the previous day fetched successfully',
      exercise: sets[0]?.userExerciseId?.exerciseId,
      previousDayDate,
      totalRepsPreviousDay,
      sets,
    });
  } catch (error) {
    console.error('Error in getExerciseRepsPreviousDay:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching exercise reps for the previous day',
      error: error.message,
    });
  }
};



// Update a set
exports.updateSet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reps, weight, notes, date, setId } = req.body;

    // Ensure `setId` is provided
    if (!setId) {
      return res.status(400).json({
        success: false,
        message: 'setId is required',
      });
    }

    // Validate if any of the fields are provided to update
    if (![reps, weight, notes, date].some(Boolean)) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (reps, weight, notes, date) is required to update',
      });
    }

    // Validate `date` if it's provided, for proper format (ISO date)
    if (date && isNaN(Date.parse(date))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format',
      });
    }

    // Attempt to find and update the set
    const updatedSet = await Set.findByIdAndUpdate(
      setId,
      { reps, weight, notes, date }, // Fields to update
      { new: true, runValidators: true }
    );

    // If set is not found
    if (!updatedSet) {
      return res.status(404).json({
        success: false,
        message: 'Set not found',
      });
    }

    // Return the updated set in the response
    return res.status(200).json({
      success: true,
      message: 'Set updated successfully',
      data: updatedSet,
    });

  } catch (err) {
    console.error('Error updating set:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update set',
      error: err.message,
    });
  }
};





//   Get all sets for a specific date
exports.getSetsByDate = async (req, res) => {
  try {
    const userId = req.user._id;
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({
            success: false,
            message: 'date is required'
         })
    }

    if (!date) {
      return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
    }

    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1); // next day for range

    // Find all user tracked exercises
    const userExercises = await UserExercise.find({ userId });

    const userExerciseIds = userExercises.map(e => e._id);

    const sets = await Set.find({
      userExerciseId: { $in: userExerciseIds },
      date: { $gte: start, $lt: end }
    }).populate({
      path: 'userExerciseId',
      populate: {
        path: 'exerciseId', // Note: this will only work if exerciseId is ObjectId (you may need to refactor)
        model: 'Exercise'
      }
    });

    // Map to a user-friendly format
    const response = sets.map(set => ({
      exerciseId: set.userExerciseId.exerciseId.exerciseId || set.userExerciseId.exerciseId,
      name: set.userExerciseId.exerciseId.name || '',
      reps: set.reps,
      weight: set.weight,
      time: set.date
    }));

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get sets by date' });
  }
};





// Helper to get ISO week number from a date
function getISOWeek(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target - firstThursday;
  return 1 + Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

// Get exercise analytics for the last 2 months
exports.getExerciseRepsAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    if (!userExerciseId) {
      return res.status(400).json({
        success: false,
        message: 'userExerciseId is required',
      });
    }

    // Calculate date 60 days ago
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setUTCDate(twoMonthsAgo.getUTCDate() - 60);

    // Fetch sets within the last 2 months using `date`, not `createdAt`
    const sets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: twoMonthsAgo }, // ✅ use `date`
    })
      .sort({ date: 1 }) // ✅ sort by workout date
      .populate({
        path: 'userExerciseId',
        populate: {
          path: 'exerciseId',
          select: 'name bodyPart equipment',
        },
      });

    if (!sets.length) {
      return res.status(404).json({
        success: false,
        message: 'No sets found for this exercise in the last 2 months',
      });
    }

    // Track total reps and reps grouped by day/week/month
    const dailyReps = {};
    const weeklyReps = {};
    const monthlyReps = {};
    let totalReps = 0;

    for (const set of sets) {
      const date = new Date(set.date); // ✅ use workout `date` field
      const reps = set.reps || 0;
      totalReps += reps;

      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const weekKey = `${date.getUTCFullYear()}-W${getISOWeek(date)}`;
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

      dailyReps[dateKey] = (dailyReps[dateKey] || 0) + reps;
      weeklyReps[weekKey] = (weeklyReps[weekKey] || 0) + reps;
      monthlyReps[monthKey] = (monthlyReps[monthKey] || 0) + reps;
    }

    // Format output for graphing
    const daily = Object.entries(dailyReps).map(([date, reps]) => ({ date, reps }));
    const weekly = Object.entries(weeklyReps).map(([week, reps]) => ({ week, reps }));
    const monthly = Object.entries(monthlyReps).map(([month, reps]) => ({ month, reps }));

    return res.status(200).json({
      success: true,
      message: 'Exercise reps graph data fetched successfully',
      exercise: sets[0]?.userExerciseId?.exerciseId,
      data: {
        totalRepsInLast2Months: totalReps,
        daily,
        weekly,
        monthly,
      },
    });

  } catch (error) {
    console.error('Error in getExerciseRepsAnalytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching exercise graph data',
      error: error.message,
    });
  }
};
