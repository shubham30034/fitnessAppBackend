const UserAdditionalInfo = require("../../Model/userModel/additionalInfo");
const User = require("../../Model/userModel/userModel");
const fs = require("fs");
const path = require("path");
const { additionalInfoValidate } = require("../../validator/loginValidation");

const {
  optimizeProfilePicture,
  cleanupOldImages,
  generateProfileUrls,
  validateImageFile,
  isSharpAvailable,
  generateFallbackResponsiveImages,
} = require("../../Utils/imageOptimizer");

/* =====================================================
   CREATE ADDITIONAL INFO (ONE TIME)
===================================================== */
exports.createAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, address } = req.body;

    const { error } = additionalInfoValidate({ name, email, address });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const existing = await UserAdditionalInfo.findOne({ userId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Additional info already exists. Use update instead.",
      });
    }

    const info = await UserAdditionalInfo.create({
      userId,
      name,
      email,
      address,
    });

    await User.findByIdAndUpdate(userId, { additionalInfo: info._id });

    res.status(201).json({
      success: true,
      message: "Additional info created successfully",
      data: info,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create additional info",
      error: error.message,
    });
  }
};

/* =====================================================
   UPDATE ADDITIONAL INFO
===================================================== */
exports.updateAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, address } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;

    if (!Object.keys(updateData).length) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided",
      });
    }

    const updated = await UserAdditionalInfo.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Additional info not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Additional info updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update additional info",
      error: error.message,
    });
  }
};

/* =====================================================
   GET ADDITIONAL INFO
===================================================== */
exports.getAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    const info = await UserAdditionalInfo.findOne({ userId }).populate({
      path: "userId",
      select: "phone",
    });

    if (!info) {
      return res.status(404).json({
        success: false,
        message: "Additional info not found",
      });
    }

    res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch additional info",
      error: error.message,
    });
  }
};

/* =====================================================
   DELETE ADDITIONAL INFO + FILES
===================================================== */
exports.deleteAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    const info = await UserAdditionalInfo.findOne({ userId });
    if (!info) {
      return res.status(404).json({
        success: false,
        message: "No additional info to delete",
      });
    }

    const userFolder = path.join(
      __dirname,
      `../../../uploads/profile/${userId}`
    );

    if (fs.existsSync(userFolder)) {
      fs.rmSync(userFolder, { recursive: true, force: true });
    }

    await UserAdditionalInfo.deleteOne({ userId });
    await User.findByIdAndUpdate(userId, {
      $unset: { additionalInfo: "" },
    });

    res.status(200).json({
      success: true,
      message: "Additional info deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete additional info",
      error: error.message,
    });
  }
};

/* =====================================================
   UPLOAD PROFILE PICTURE (LOCAL + OPTIMIZED)
===================================================== */
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // validate
    const validation = validateImageFile(req.file);
    if (!validation.valid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const uploadDir = path.dirname(req.file.path);
    const filename = req.file.filename;

    let info = await UserAdditionalInfo.findOne({ userId });

    // ✅ delete OLD profile images (small + medium)
    if (info?.profilePicture) {
      cleanupOldImages(uploadDir, info.profilePicture);
    }

    // ✅ generate optimized images
    const optimizedImages = await optimizeProfilePicture(
      req.file.path,
      uploadDir,
      filename
    );

    // ✅ DELETE ORIGINAL IMAGE (IMPORTANT)
    fs.unlinkSync(req.file.path);

    if (!info) {
      info = await UserAdditionalInfo.create({
        userId,
        profilePicture: filename, // base reference
        profilePictureSizes: optimizedImages,
      });

      await User.findByIdAndUpdate(userId, {
        additionalInfo: info._id,
      });
    } else {
      info.profilePicture = filename;
      info.profilePictureSizes = optimizedImages;
      await info.save();
    }

    const urls = generateProfileUrls(userId, optimizedImages);

    return res.status(200).json({
      success: true,
      message: "Profile picture updated",
      data: {
        default: urls.medium,
        responsive: urls,
      },
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Profile picture upload failed",
      error: error.message,
    });
  }
};


/* =====================================================
   GET PROFILE PICTURE URLS
===================================================== */
exports.getProfilePictureUrls = async (req, res) => {
  try {
    const userId = req.user.id;

    const info = await UserAdditionalInfo.findOne({ userId });
    if (!info?.profilePictureSizes) {
      return res.status(404).json({
        success: false,
        message: "Profile picture not found",
      });
    }

    const urls = generateProfileUrls(userId, info.profilePictureSizes);

    res.status(200).json({
      success: true,
      data: urls,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile picture",
      error: error.message,
    });
  }
};
