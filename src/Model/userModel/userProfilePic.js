const mongoose = require('mongoose');



const userProfilePicSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // Ensure one profile pic per user
    },
    profilePicture: {
        type: String,
        required: true, // Ensure a profile picture is always provided
    },
    }, { timestamps: true })



module.exports = mongoose.model('UserProfilePic', userProfilePicSchema);