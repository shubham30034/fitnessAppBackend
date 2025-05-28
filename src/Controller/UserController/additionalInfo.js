const UserAdditionalInfo = require('../../Model/userModel/additionalInfo');
const User = require('../../Model/userModel/userModel');
const fs = require('fs');
const path = require('path');
const {additionalInfoValidate} = require("../../validator/loginValidation")

// CREATE Additional Info
exports.createAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, address } = req.body;

    const {error} = await additionalInfoValidate({name,email,address})
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let existingInfo = await UserAdditionalInfo.findOne({ userId });

    if (existingInfo) {
      let updated = false;
      if (!existingInfo.name && name) { existingInfo.name = name; updated = true; }
      if (!existingInfo.email && email) { existingInfo.email = email; updated = true; }
      if (!existingInfo.address && address) { existingInfo.address = address; updated = true; }

      if (updated) {
        await existingInfo.save();
        if (!user.additionalInfo) {
          user.additionalInfo = existingInfo._id;
          await user.save();
        }
        return res.status(200).json({
          success: true,
          message: 'Additional info updated successfully',
          data: existingInfo,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Additional info already exists for this user',
      });
    }

    // Create new
    const additionalInfo = new UserAdditionalInfo({ userId, name, email, address });
    await additionalInfo.save();

    user.additionalInfo = additionalInfo._id;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Additional info created successfully',
      data: additionalInfo,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating additional info',
      error: error.message,
    });
  }
};


// UPDATE Additional Info
exports.updateAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, address } = req.body;



 const {error} = await additionalInfoValidate({name,email,address})
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    
    const updated = await UserAdditionalInfo.findOneAndUpdate(
      { userId },
      { name, email, address },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Additional info updated successfully',
      data: updated,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating additional info',
      error: error.message,
    });
  }
};


// GET Additional Info
exports.getAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;


    if(!userId){
      return res.tatus(400).json({
        success:false,
        message:"unable to find userId",
      })
    }

    const additionalInfo = await UserAdditionalInfo.findOne({ userId })
      .populate({ path: 'userId', select: 'phone' }); // profilePicture is string, no populate

    if (!additionalInfo) {
      return res.status(404).json({ success: false, message: 'Additional info not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Additional info fetched successfully',
      data: additionalInfo,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching additional info',
      error: error.message,
    });
  }
};


// DELETE Additional Info
exports.deleteAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    
    if(!userId){
      return res.tatus(400).json({
        success:false,
        message:"unable to find userId",
      })
    }


    const additionalInfo = await UserAdditionalInfo.findOne({ userId });
    if (!additionalInfo) {
      return res.status(404).json({ success: false, message: 'No additional info found to delete' });
    }

    // Construct user profile folder path
    const userProfileFolder = path.join(__dirname, `../../../uploads/profile/${userId}`);

    // Check if folder exists and delete it recursively
    if (fs.existsSync(userProfileFolder)) {
      fs.rmSync(userProfileFolder, { recursive: true, force: true });
    }

    // Delete additional info document
    await UserAdditionalInfo.findOneAndDelete({ userId });

    // Remove reference from User model
    await User.findByIdAndUpdate(userId, { $unset: { additionalInfo: '' } });

    res.status(200).json({
      success: true,
      message: 'Additional info and profile picture folder deleted successfully',
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting additional info',
      error: error.message,
    });
  }
};

// UPLOAD Profile Picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file || !req.file.filename) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filename = req.file.filename; // just filename, e.g. "168500000-original.jpg"

    let additionalInfo = await UserAdditionalInfo.findOne({ userId });

    if (additionalInfo) {
      // Remove old file if exists
      if (additionalInfo.profilePicture) {
        const oldFilePath = path.join(__dirname, `../../../uploads/profile/${userId}/${additionalInfo.profilePicture}`);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      additionalInfo.profilePicture = filename;
      await additionalInfo.save();
    } else {
      additionalInfo = new UserAdditionalInfo({ userId, profilePicture: filename });
      await additionalInfo.save();

      const user = await User.findById(userId);
      if (user && !user.additionalInfo) {
        user.additionalInfo = additionalInfo._id;
        await user.save();
      }
    }

    // Construct full URL/path to send in response
    const profilePictureUrl = `/uploads/profile/${userId}/${filename}`;

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: { profilePictureUrl, additionalInfo },
    });

  } catch (error) {
    // Delete uploaded file if error occurs
    if (req.file && req.file.filename) {
      const errorFilePath = path.join(__dirname, `../../../uploads/profile/${req.user.id}/${req.file.filename}`);
      if (fs.existsSync(errorFilePath)) fs.unlinkSync(errorFilePath);
    }

    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message,
    });
  }
};