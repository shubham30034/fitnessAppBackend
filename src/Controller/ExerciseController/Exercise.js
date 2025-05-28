const axios = require('axios');
const Exercise = require('../../Model/fitnessModel/exercise');
const fs = require('fs');
const path = require('path');
const{paginationValidation,exerciseFilterValidation} = require("../../validator/workoutValidation")

require('dotenv').config();

exports.getAllExercisesFromJson = async (req, res) => {
  try {
    // Load and parse the JSON file
    const filePath = path.join(__dirname, 'exercises.json');
    const rawData = fs.readFileSync(filePath);
    const exercises = JSON.parse(rawData);

    // Map JSON data to match your schema (rename id → exerciseId)
    const formattedExercises = exercises.map(ex => ({
      exerciseId: ex.id,
      name: ex.name,
      force: ex.force,
      level: ex.level,
      mechanic: ex.mechanic,
      equipment: ex.equipment,
      primaryMuscles: ex.primaryMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      instructions: ex.instructions,
      category: ex.category,
      images: ex.images
    }));

    // Insert into DB (ignore duplicates)
    await Exercise.insertMany(formattedExercises, { ordered: false });

    res.status(201).json({ message: 'Exercises inserted successfully' });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Some duplicates were skipped', error: err });
    } else {
      res.status(500).json({ message: 'Failed to insert exercises', error: err.message });
    }
  }
};



exports.getAllExercises = async (req, res) => {
    try {
        // Get page and limit from request body (or default values)
        const { page , limit } = req.body;

        const {error} = paginationValidation({page,limit})

        
         if (error) {
       return res.status(400).json({
         status: false,
        message: "Validation failed",
       errors: error.details.map(e => e.message),
       });
      }


        // Fetch exercises with pagination
        const allExercises = await Exercise.find({})
            .limit(Number(limit))  // Limit the number of exercises returned
            .skip((Number(page) - 1) * Number(limit));  // Skip exercises for pagination

        // Get the total count of exercises (for pagination info)
        const totalExercises = await Exercise.countDocuments();

        // Check if exercises are found
        if (allExercises.length > 0) {
            return res.status(200).json({
                status: true,
                message: "All exercises fetched successfully",
                data: allExercises,
                totalExercises: totalExercises,
                totalPages: Math.ceil(totalExercises / limit),  // Total number of pages
                currentPage: page
            });
        } else {
            return res.status(404).json({
                status: false,
                message: "No exercises found",
            });
        }

    } catch (error) {
        console.error("Error fetching exercises:", error);
        res.status(500).json({
            status: false,
            message: "Error fetching exercises",
            error: error.message,
        });
    }
};

exports.getExerciseByMuscelAndLevel = async (req, res) => {
  try {
    // Get the muscle and level from the request body
    const { muscle, level } = req.body;


      const {error} = exerciseFilterValidation({muscle,level})

        
         if (error) {
       return res.status(400).json({
         status: false,
        message: "Validation failed",
       errors: error.details.map(e => e.message),
       });
      }

    // Validate the muscle and level
    if (!muscle || !level) {
      return res.status(400).json({
        status: false,
        message: "Muscle and level are required",
      });
    }

    // Fetch exercises by muscle and level from the database
    const response = await Exercise.find({
      primaryMuscles: { $in: [muscle] },
      level: level
    });

    // Return the result (even if empty)
    return res.status(200).json({
      status: true,
      message: response.length > 0
        ? "Exercises fetched successfully"
        : "No exercises found for the given muscle and level",
      data: response,
    });

  } catch (error) {
    console.error("Error fetching exercises by muscle and level:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching exercises by muscle and level",
      error: error.message,
    });
  }
};


exports.getExerciseById = async (req, res) => {

    try {
        // Get the exercise ID from the request body
        const { exerciseId } = req.body;

        // Validate the exercise ID
        if (!exerciseId) {
            return res.status(400).json({
                status: false,
                message: "Exercise ID is required",
            });
        }


        // Fetch the exercise by ID from the database
        const response = await Exercise.findOne({ exerciseId: exerciseId });

        // Check if the exercise was found
        if (!response) {
            return res.status(404).json({
                status: false,
                message: "Exercise not found",
            });
        }

        // Return the fetched data
        res.status(200).json({
            status: true,
            message: "Exercise fetched successfully",
            data: response,
        });
    } catch (error) {
        console.error("Error fetching exercise by ID:", error);
        res.status(500).json({
            status: false,
            message: "Error fetching exercise by ID",
            error: error.message,
        });
    }
};

