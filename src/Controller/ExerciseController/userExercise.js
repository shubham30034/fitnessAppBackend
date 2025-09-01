// controllers/userExerciseController.js
const UserExercise = require('../../Model/fitnessModel/userExerciseSchema');
const Set = require('../../Model/fitnessModel/setSchema');
const mongoose = require('mongoose');

exports.addUserExercises = async (req, res) => {
  try {
    // get userId and exerciseIds userId from the request and exerciseIds from the request body
    const userId = req.user.id;
    const { exerciseIds } = req.body; // expect an array of exerciseId strings

    console.log('exerciseIds:', exerciseIds);

    // Validate userId and exerciseIds
    if (!exerciseIds) {
      return res.status(400).json({
        success: false,
        message: "exerciseIds is required",
      });
    }




    if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) {
      return res.status(400).json({ error: 'exerciseIds must be a non-empty array' });
    }

    // Convert exerciseIds to ObjectIds if they are strings
    const objectIds = exerciseIds.map(id => new mongoose.Types.ObjectId(id));

    // Find already added ones (compare ObjectId correctly)
    const existing = await UserExercise.find({
      userId,
      exerciseId: { $in: objectIds }
    });



    // Convert existing exerciseIds to string for comparison
    const existingIds = existing.map(ex => ex.exerciseId.toString());

    // Filter out duplicates
    const newExerciseIds = exerciseIds.filter(id => !existingIds.includes(id));

    if (newExerciseIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All exercises are already added.',
        added: [],
        skipped: existingIds // list of already added ones
      });
    }

    // Prepare bulk documents
    const newExercises = newExerciseIds.map(id => ({
      userId,
      exerciseId: new mongoose.Types.ObjectId(id), // Make sure this is a valid ObjectId
    }));

    // Insert many and handle errors for duplicates
    try {
      const inserted = await UserExercise.insertMany(newExercises, { ordered: false });

      res.status(201).json({
        success: true,
        message: 'Exercises added successfully',
        added: inserted,
        skipped: existingIds, // list of already present
      });
    } catch (err) {
      if (err.code === 11000) {
        // Handle duplicate key error from MongoDB's unique constraint
        return res.status(409).json({
          success: false,
          message: 'Duplicate exercises found, some exercises were not added.',
        });
      }
      throw err; // Re-throw other unexpected errors
    }

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

    const userExercises = await UserExercise.find({ userId:userId }).populate({
      path: 'exerciseId',
      select: 'name primaryMuscles equipment',
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


exports.setRestTime = async (req, res) => {
  try {
    const { userId, restTime } = req.body;

    // Validate rest time
    if (![2, 3, 5].includes(restTime)) {
      return res.status(400).json({ success: false, message: 'Rest time must be 2, 3, or 5 minutes' });
    }

    // Update the user's rest time
    const user = await User.findByIdAndUpdate(userId, { restTime }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Rest time set successfully',
      restTime: user.restTime,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error setting rest time',
      error: error.message,
    });
  }
};



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

    // check if userExerciseId is valid and belongs to the current user
    const userExercise = await UserExercise.findById({_id: userExerciseId});


    // if not valid, return error
    if (!userExercise) {
      return res.status(404).json({
        success: false,
        message: 'User exercise not found'
      });
    }

    if (userExercise.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: This exercise is not owned by the current user'
      });
    }


    // create a new set and enter the data in database
    const set = new Set({ userExerciseId, reps, weight, notes, userId }); // ✅ include notes
    await set.save();



    // return success response

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

    if(!userId){
      return res.status(400).json({
        success:false,
        message:"unable to find userId"
      })
    }

    
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


  // Check if userExerciseId is valid

    const userExercise = await UserExercise.findById({_id: userExerciseId});


    if (!userExercise) {
      return res.status(404).json({
        success: false,
        message: 'User exercise not found'
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


    if (!sets || sets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No sets found for today',
      });
    }

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





// get previous workout of that exercise
exports.previousWorkOutOfExercise = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    if (!userExerciseId) {
      return res.status(400).json({
        success: false,
        message: "Please provide userExerciseId",
      });
    }

    // Step 1: Find last 5 distinct workout dates (descending)
    const lastWorkoutDates = await Set.aggregate([
      {
        $match: {
          userExerciseId: new mongoose.Types.ObjectId(userExerciseId),
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" }
          },
        },
      },
      {
        $sort: { _id: -1 } // latest dates first
      },
      {
        $limit: 5
      }
    ]);

    if (!lastWorkoutDates.length) {
      return res.status(404).json({
        success: false,
        message: "No previous workout found for this exercise",
      });
    }

    // Step 2: Fetch sets grouped by those dates
    const dates = lastWorkoutDates.map(d => d._id); // ["2025-05-13", "2025-05-10", ...]

    const sets = await Set.aggregate([
      {
        $match: {
          userExerciseId: new mongoose.Types.ObjectId(userExerciseId),
          userId: new mongoose.Types.ObjectId(userId),
          date: {
            $gte: new Date(dates[dates.length - 1]), // oldest date in the list
          }
        }
      },
      {
        $addFields: {
          workoutDate: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" }
          }
        }
      },
      {
        $match: {
          workoutDate: { $in: dates }
        }
      },
      {
        $sort: { date: -1 }
      },
      {
        $lookup: {
          from: "userexercises",
          localField: "userExerciseId",
          foreignField: "_id",
          as: "userExercise"
        }
      },
      { $unwind: "$userExercise" },
      {
        $lookup: {
          from: "exercises",
          localField: "userExercise.exerciseId",
          foreignField: "_id",
          as: "exercise"
        }
      },
      { $unwind: "$exercise" },
      {
        $project: {
          reps: 1,
          weight: 1,
          date: 1,
          workoutDate: 1,
          notes: 1,
          restTime: 1,
          exercise: {
            name: "$exercise.name",
            bodyPart: "$exercise.bodyPart",
            equipment: "$exercise.equipment"
          }
        }
      },
      {
        $group: {
          _id: "$workoutDate",
          sets: { $push: "$$ROOT" }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: "Previous workout sessions fetched successfully",
      data: sets,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching previous workout",
      error: error.message,
    });
  }
};



// camapare previous workout with lates date workout 
exports.compareTodayWithPreviousWorkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    if (!userId || !userExerciseId) {
      return res.status(400).json({
        success: false,
        message: 'userId and userExerciseId are required',
      });
    }

    const userExercise = await UserExercise.findById(userExerciseId);
    if (!userExercise) {
      return res.status(404).json({
        success: false,
        message: 'User exercise not found',
      });
    }

    // Get today's date range
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);

    // Fetch today's sets
    const todaysSets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: startOfToday, $lte: endOfToday },
    });

    // Fetch the most recent previous sets (excluding today)
    const previousSet = await Set.find({
      userId,
      userExerciseId,
      date: { $lt: startOfToday },
    })
      .sort({ date: -1 })
      .limit(1);

    if (!todaysSets.length || !previousSet.length) {
      return res.status(404).json({
        success: false,
        message: "Both today's and previous workout data required for comparison",
      });
    }

    const previousDate = previousSet[0].date;

    // Get all sets from that previous date
    const startOfPrev = new Date(previousDate);
    startOfPrev.setUTCHours(0, 0, 0, 0);

    const endOfPrev = new Date(previousDate);
    endOfPrev.setUTCHours(23, 59, 59, 999);

    const previousSets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: startOfPrev, $lte: endOfPrev },
    });

    // Helper to calculate metrics
    const calculateMetrics = (sets) => {
      let totalSets = sets.length;
      let totalReps = 0;
      let totalVolume = 0; // weight * reps
      let totalWeight = 0;

      sets.forEach(set => {
        totalReps += set.reps;
        totalVolume += set.reps * set.weight;
        totalWeight += set.weight;
      });

      const avgKgPerRep = totalReps ? totalVolume / totalReps : 0;

      return { totalSets, totalReps, totalVolume, avgKgPerRep };
    };

    const todayMetrics = calculateMetrics(todaysSets);
    const prevMetrics = calculateMetrics(previousSets);

    const getPercentageDiff = (today, prev) => {
      if (prev === 0) return today === 0 ? 0 : 100;
      return ((today - prev) / prev) * 100;
    };

    const comparison = {
      sets: {
        today: todayMetrics.totalSets,
        previous: prevMetrics.totalSets,
        changePercent: getPercentageDiff(todayMetrics.totalSets, prevMetrics.totalSets).toFixed(2)
      },
      reps: {
        today: todayMetrics.totalReps,
        previous: prevMetrics.totalReps,
        changePercent: getPercentageDiff(todayMetrics.totalReps, prevMetrics.totalReps).toFixed(2)
      },
      volume: {
        today: todayMetrics.totalVolume,
        previous: prevMetrics.totalVolume,
        changePercent: getPercentageDiff(todayMetrics.totalVolume, prevMetrics.totalVolume).toFixed(2)
      },
      kgPerRep: {
        today: todayMetrics.avgKgPerRep.toFixed(2),
        previous: prevMetrics.avgKgPerRep.toFixed(2),
        changePercent: getPercentageDiff(todayMetrics.avgKgPerRep, prevMetrics.avgKgPerRep).toFixed(2)
      }
    };

    return res.status(200).json({
      success: true,
      message: 'Workout comparison fetched successfully',
      data: comparison
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error during workout comparison',
      error: error.message
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

    // Validate if at least one field is provided
    if (![reps, weight, notes, date].some(Boolean)) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (reps, weight, notes, date) is required to update',
      });
    }

    // Validate date format and range (within last 2 months)
    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
      }

      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      if (parsedDate < twoMonthsAgo) {
        return res.status(400).json({
          success: false,
          message: 'Date must be within the last 2 months',
        });
      }
    }

    // Build the update object dynamically
    const updateData = {};
    if (reps !== undefined) updateData.reps = reps;
    if (weight !== undefined) updateData.weight = weight;
    if (notes !== undefined) updateData.notes = notes;
    if (date !== undefined) updateData.date = date;

    // Find and update the set
    const updatedSet = await Set.findByIdAndUpdate(
      setId,
      updateData,
      { new: true, runValidators: true }
    );

    // If set is not found
    if (!updatedSet) {
      return res.status(404).json({
        success: false,
        message: 'Set not found',
      });
    }

    // Return success response
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
    const userId = req.user.id;
    const { date } = req.body;
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

// not in considerationn


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
