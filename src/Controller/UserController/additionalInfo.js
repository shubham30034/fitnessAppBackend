const UserAdditionalInfo = require('../../Models/UserAdditionalInfo');
const User = require('../../Models/User'); // Assuming you have a User model
const uploadFileToCloudinary = require("../../Utils/imageUploader")
const path = require('path');


exports.createAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, email, address } = req.body;


    // Step 1: Check if additional info already exists
    const existingInfo = await UserAdditionalInfo.findOne({ userId });
    if (existingInfo) {
      return res.status(400).json({
        success: false,
        message: 'Additional info already exists for this user',
      });
    }

    // Step 2: Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Step 3: Check if image file is provided
    const file = req.files?.imageFile;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Step 4: Validate file type
    const supportedTypes = ["jpg", "jpeg", "png"];
    const fileType = path.extname(file.name).substring(1).toLowerCase();
    const isFileSupported = (type, types) => types.includes(type);

    if (!isFileSupported(fileType, supportedTypes)) {
      return res.status(400).json({
        success: false,
        message: "File type not supported",
      });
    }

    // Step 5: Upload file to Cloudinary
    const response = await uploadFileToCloudinary(file, "Codehelp");
    const profilePicture = response.secure_url;

    // Step 6: Save additional info
    const additionalInfo = new UserAdditionalInfo({
      userId,
      name,
      email,
      address,
      profilePicture,
    });

    await additionalInfo.save();

    // Step 7: Link to user
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


exports.getAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const additionalInfo = await UserAdditionalInfo.findOne({ userId }).populate({
      path: 'userId',
      select: 'phone'
    });

    if (!additionalInfo) {
      return res.status(404).json({ success: false, message: 'Additional info not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Additional info fetched successfully',
      data: additionalInfo
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching additional info',
      error: error.message
    });
  }
};

exports.updateAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, email, address, profilePicture } = req.body;

    const updated = await UserAdditionalInfo.findOneAndUpdate(
      { userId },
      { name, email, address, profilePicture },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'No additional info found to update' });
    }

    res.status(200).json({
      success: true,
      message: 'Additional info updated successfully',
      data: updated
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating additional info',
      error: error.message
    });
  }
};

exports.deleteAdditionalInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const deleted = await UserAdditionalInfo.findOneAndDelete({ userId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'No additional info found to delete' });
    }

    await User.findByIdAndUpdate(userId, { $unset: { additionalInfo: "" } });

    res.status(200).json({
      success: true,
      message: 'Additional info deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting additional info',
      error: error.message
    });
  }
};
