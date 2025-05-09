const cloudinary = require("cloudinary").v2;

const uploadImageToCloudinary = async (file, folder, height, quality) => {
  const options = { folder };

  if (height) {
    options.height = height;
  }

  if (quality) {
    options.quality = quality;
  }

  options.resource_type = "auto";

  return await cloudinary.uploader.upload(file.tempFilePath, options);
};

const uploadMultipleImagesToCloudinary = async (files, folder, height, quality) => {
  const uploadedUrls = [];

  for (let file of files) {
    const result = await uploadImageToCloudinary(file, folder, height, quality);
    uploadedUrls.push(result.secure_url);
  }

  return uploadedUrls;
};

module.exports = {
  uploadImageToCloudinary,
  uploadMultipleImagesToCloudinary
};
