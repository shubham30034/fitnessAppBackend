const mongoose = require("mongoose");
const UserExercise = require("../../Model/fitnessModel/userExerciseSchema");
const Set = require("../../Model/fitnessModel/setSchema");

/* =====================================================
   ADD USER EXERCISES
===================================================== */
exports.addUserExercises = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exerciseIds } = req.body;

    if (!Array.isArray(exerciseIds) || !exerciseIds.length) {
      return res.status(400).json({
        success: false,
        message: "exerciseIds must be a non-empty array",
      });
    }

    const objectIds = exerciseIds.map(id => new mongoose.Types.ObjectId(id));

    const existing = await UserExercise.find({
      userId,
      exerciseId: { $in: objectIds },
    });

    const existingIds = existing.map(e => e.exerciseId.toString());
    const newIds = exerciseIds.filter(id => !existingIds.includes(id));

    if (!newIds.length) {
      return res.json({
        success: true,
        message: "All exercises already added",
        added: [],
        skipped: existingIds,
      });
    }

    const docs = newIds.map(id => ({
      userId,
      exerciseId: id,
    }));

    const inserted = await UserExercise.insertMany(docs, { ordered: false });

    res.status(201).json({
      success: true,
      message: "Exercises added successfully",
      added: inserted,
      skipped: existingIds,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate exercise detected",
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   GET USER EXERCISES
===================================================== */
exports.getUserExercises = async (req, res) => {
  const userId = req.user.id;

  const userExercises = await UserExercise.find({ userId }).populate({
    path: "exerciseId",
    select: "name primaryMuscles equipment",
  });

  if (!userExercises.length) {
    return res.status(404).json({
      success: false,
      message: "No exercises found for this user",
    });
  }

  res.json({
    success: true,
    data: userExercises,
  });
};

/* =====================================================
   REMOVE USER EXERCISE (SECURE + CASCADE)
===================================================== */
exports.removeUserExercises = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    if (!userExerciseId) {
      return res.status(400).json({
        success: false,
        message: "userExerciseId is required",
      });
    }

    const deleted = await UserExercise.findOneAndDelete({
      _id: userExerciseId,
      userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Exercise not found",
      });
    }

    await Set.deleteMany({ userExerciseId, userId });

    res.json({
      success: true,
      message: "Exercise and related sets removed",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   RECORD SET
===================================================== */
exports.recordSet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId, reps, weight, notes, restTime } = req.body;

    if (!userExerciseId || !reps || weight === undefined) {
      return res.status(400).json({
        success: false,
        message: "userExerciseId, reps and weight are required",
      });
    }

    const userExercise = await UserExercise.findOne({
      _id: userExerciseId,
      userId,
    });

    if (!userExercise) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized exercise access",
      });
    }

    const set = await Set.create({
      userId,
      userExerciseId,
      reps,
      weight,
      notes,
      restTime,
    });

    res.status(201).json({
      success: true,
      message: "Set added successfully",
      data: set,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   GET ALL RECORDED SETS
===================================================== */
exports.getRecordedSets = async (req, res) => {
  const userId = req.user.id;

  const sets = await Set.find({ userId }).populate({
    path: "userExerciseId",
    populate: {
      path: "exerciseId",
      select: "name primaryMuscles equipment",
    },
  });

  if (!sets.length) {
    return res.status(404).json({
      success: false,
      message: "No sets found",
    });
  }

  res.json({ success: true, data: sets });
};

/* =====================================================
   GET TODAY SETS
===================================================== */
exports.getExerciseRepsToday = async (req, res) => {
  const userId = req.user.id;
  const { userExerciseId } = req.body;

  if (!userExerciseId) {
    return res.status(400).json({
      success: false,
      message: "userExerciseId required",
    });
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const sets = await Set.find({
    userId,
    userExerciseId,
    date: { $gte: start, $lte: end },
  });

  if (!sets.length) {
    return res.status(404).json({
      success: false,
      message: "No sets found for today",
    });
  }

  res.json({ success: true, data: sets });
};

/* =====================================================
   PREVIOUS WORKOUT (LAST 5 SESSIONS)
===================================================== */
exports.previousWorkOutOfExercise = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    if (!userExerciseId) {
      return res.status(400).json({
        success: false,
        message: "userExerciseId required",
      });
    }

    const sessions = await Set.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          userExerciseId: new mongoose.Types.ObjectId(userExerciseId),
        },
      },
      {
        $addFields: {
          workoutDate: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
        },
      },
      {
        $group: {
          _id: "$workoutDate",
          sets: {
            $push: {
              reps: "$reps",
              weight: "$weight",
              notes: "$notes",
              restTime: "$restTime",
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 5 },
    ]);

    if (!sessions.length) {
      return res.status(404).json({
        success: false,
        message: "No previous workouts found",
      });
    }

    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   COMPARE TODAY VS PREVIOUS
===================================================== */
exports.compareTodayWithPreviousWorkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    const startToday = new Date();
    startToday.setUTCHours(0, 0, 0, 0);

    const todaySets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: startToday },
    });

    const prevSet = await Set.find({
      userId,
      userExerciseId,
      date: { $lt: startToday },
    })
      .sort({ date: -1 })
      .limit(1);

    if (!todaySets.length || !prevSet.length) {
      return res.status(404).json({
        success: false,
        message: "Insufficient data for comparison",
      });
    }

    const calc = sets => {
      let reps = 0;
      let volume = 0;
      sets.forEach(s => {
        reps += s.reps;
        volume += s.reps * s.weight;
      });
      return { reps, volume };
    };

    const today = calc(todaySets);

    const prevDate = new Date(prevSet[0].date);
    const prevStart = new Date(prevDate);
    prevStart.setUTCHours(0, 0, 0, 0);
    const prevEnd = new Date(prevDate);
    prevEnd.setUTCHours(23, 59, 59, 999);

    const previousSets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: prevStart, $lte: prevEnd },
    });

    const prev = calc(previousSets);

    res.json({
      success: true,
      data: {
        repsDiff: today.reps - prev.reps,
        volumeDiff: today.volume - prev.volume,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   UPDATE SET (OWNERSHIP SAFE)
===================================================== */
exports.updateSet = async (req, res) => {
  const userId = req.user.id;
  const { setId, reps, weight, notes, date } = req.body;

  if (!setId) {
    return res.status(400).json({
      success: false,
      message: "setId required",
    });
  }

  const update = {};
  if (reps !== undefined) update.reps = reps;
  if (weight !== undefined) update.weight = weight;
  if (notes !== undefined) update.notes = notes;
  if (date !== undefined) update.date = date;

  const updated = await Set.findOneAndUpdate(
    { _id: setId, userId },
    update,
    { new: true, runValidators: true }
  );

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Set not found",
    });
  }

  res.json({ success: true, data: updated });
};

/* =====================================================
   GET SETS BY DATE
===================================================== */
exports.getSetsByDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date is required (YYYY-MM-DD)",
      });
    }

    const start = new Date(date);
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);

    const sets = await Set.find({
      userId,
      date: { $gte: start, $lt: end },
    }).populate({
      path: "userExerciseId",
      populate: {
        path: "exerciseId",
        select: "name equipment",
      },
    });

    res.json({ success: true, data: sets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   ANALYTICS (LAST 60 DAYS)
===================================================== */
function getISOWeek(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.floor((target - firstThursday) / (7 * 86400000));
}

exports.getExerciseRepsAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userExerciseId } = req.body;

    const fromDate = new Date();
    fromDate.setUTCDate(fromDate.getUTCDate() - 60);

    const sets = await Set.find({
      userId,
      userExerciseId,
      date: { $gte: fromDate },
    }).sort({ date: 1 });

    if (!sets.length) {
      return res.status(404).json({
        success: false,
        message: "No data found",
      });
    }

    const daily = {};
    const weekly = {};
    const monthly = {};
    let totalReps = 0;

    sets.forEach(s => {
      totalReps += s.reps;
      const d = new Date(s.date);
      const day = d.toISOString().split("T")[0];
      const week = `${d.getUTCFullYear()}-W${getISOWeek(d)}`;
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

      daily[day] = (daily[day] || 0) + s.reps;
      weekly[week] = (weekly[week] || 0) + s.reps;
      monthly[month] = (monthly[month] || 0) + s.reps;
    });

    res.json({
      success: true,
      data: {
        totalReps,
        daily: Object.entries(daily).map(([date, reps]) => ({ date, reps })),
        weekly: Object.entries(weekly).map(([week, reps]) => ({ week, reps })),
        monthly: Object.entries(monthly).map(([month, reps]) => ({ month, reps })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
