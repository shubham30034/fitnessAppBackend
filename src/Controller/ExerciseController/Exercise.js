const axios = require('axios');
const Exercise = require('../../Model/fitnessModel/exercise');

require('dotenv').config();

exports.getAllExercises = async (req, res) => {
    try {
        // Get page and limit from request body (or default values)
        const { page , limit } = req.body;

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




const exerciseCache = {};

exports.getExerciseById = async (req, res) => {

    try {
        const { exerciseId } = req.body;
        console.log('Fetching exercise with ID:', exerciseId);

        // Check if the exercise data is already cached
        if (exerciseCache[exerciseId]) {
            console.log('Returning cached data for exerciseId:', exerciseId);
            return res.status(200).json({
                status: true,
                message: "Exercise fetched from cache successfully",
                data: exerciseCache[exerciseId],
            });
        }

        // If not cached, fetch the exercise data from the API
        const options = {
            method: 'GET',
            url: `https://exercisedb.p.rapidapi.com/exercises/exercise/${exerciseId}`,
            headers: {
                'x-rapidapi-key': `${process.env.RAPIDAPI_KEY}`,
                'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
            },
        };

        const response = await axios.request(options);
        console.log('Fetched exercise data from API:', response.data);

        // Cache the exercise data (store the gifUrl as well)
        exerciseCache[exerciseId] = response.data;

        // Return the fetched data
        res.status(200).json({
            status: true,
            message: "Exercise fetched successfully",
            data: response.data,
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

