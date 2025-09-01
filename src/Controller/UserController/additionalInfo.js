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

    console.log("update is running")

    // Prepare update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
      });
    }


    // Update the provided fields only
    const updated = await UserAdditionalInfo.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'User additional info not found',
      });
    }

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
      return res.status(400).json({
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
      return res.status(400).json({
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

// UPLOAD Profile Picture with Mobile Optimization
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file || !req.file.filename) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const filePath = req.file.path;
    const uploadDir = path.dirname(filePath);

    // Import image optimization utilities
    const {
      optimizeProfilePicture,
      generateResponsiveUrls,
      cleanupOldImages,
      isSharpAvailable,
      generateFallbackResponsiveImages
    } = require('../../Utils/imageOptimizer');

    // Generate optimized versions for mobile
    let optimizedImages;
    if (isSharpAvailable()) {
      optimizedImages = await optimizeProfilePicture(filePath, uploadDir, filename);
    } else {
      console.log('Using fallback image processing (Sharp not available)');
      optimizedImages = await generateFallbackResponsiveImages(filePath, uploadDir, filename);
    }

    let additionalInfo = await UserAdditionalInfo.findOne({ userId });

    if (additionalInfo) {
      // Clean up old images if they exist
      if (additionalInfo.profilePicture) {
        cleanupOldImages(uploadDir, additionalInfo.profilePicture);
      }
      
      // Store the optimized image data
      additionalInfo.profilePicture = filename;
      additionalInfo.profilePictureSizes = optimizedImages; // Store all sizes
      await additionalInfo.save();
    } else {
      additionalInfo = new UserAdditionalInfo({ 
        userId, 
        profilePicture: filename,
        profilePictureSizes: optimizedImages
      });
      await additionalInfo.save();

      const user = await User.findById(userId);
      if (user && !user.additionalInfo) {
        user.additionalInfo = additionalInfo._id;
        await user.save();
      }
    }

    // Generate responsive URLs for different screen sizes
    const baseUrl = `/uploads/profile/${userId}`;
    const responsiveUrls = generateResponsiveUrls(baseUrl, filename);

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded and optimized successfully',
      data: { 
        profilePictureUrl: responsiveUrls.medium, // Default to medium size
        responsiveUrls,
        optimizedSizes: optimizedImages,
        additionalInfo 
      },
    });

  } catch (error) {
    // Delete uploaded file if error occurs
    if (req.file && req.file.filename) {
      const errorFilePath = path.join(__dirname, `../../../uploads/profile/${req.user.id}/${req.file.filename}`);
      if (fs.existsSync(errorFilePath)) fs.unlinkSync(errorFilePath);
    }

    console.error('Profile picture upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message,
    });
  }
};

// Get optimized profile picture URLs
exports.getProfilePictureUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const { size = 'medium' } = req.query; // Default to medium size

    const additionalInfo = await UserAdditionalInfo.findOne({ userId });

    if (!additionalInfo || !additionalInfo.profilePicture) {
      return res.status(404).json({
        success: false,
        message: 'Profile picture not found'
      });
    }

    const baseUrl = `/uploads/profile/${userId}`;
    const responsiveUrls = {
      thumbnail: `${baseUrl}/${additionalInfo.profilePictureSizes?.thumbnail || additionalInfo.profilePicture}`,
      small: `${baseUrl}/${additionalInfo.profilePictureSizes?.small || additionalInfo.profilePicture}`,
      medium: `${baseUrl}/${additionalInfo.profilePictureSizes?.medium || additionalInfo.profilePicture}`,
      large: `${baseUrl}/${additionalInfo.profilePictureSizes?.large || additionalInfo.profilePicture}`,
      original: `${baseUrl}/${additionalInfo.profilePictureSizes?.original || additionalInfo.profilePicture}`
    };

    res.status(200).json({
      success: true,
      data: {
        currentSize: responsiveUrls[size] || responsiveUrls.medium,
        allSizes: responsiveUrls,
        selectedSize: size
      }
    });

  } catch (error) {
    console.error('Error fetching profile picture URLs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};