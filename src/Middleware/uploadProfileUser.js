const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateImageFile } = require('../Utils/imageOptimizer');

// Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
  // Validate image file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return cb(new Error(validation.error));
  }

  // Additional validation for profile pictures
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only JPG, JPEG, PNG, and WebP files are allowed"));
  }

  // Check file size (10MB max for profile pictures)
  if (file.size > 10 * 1024 * 1024) {
    return cb(new Error("File size must be less than 10MB"));
  }

  cb(null, true);
};

const singleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user.id;
    const uploadPath = path.join(__dirname, `../../uploads/profile/${userId}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    
    // Generate unique filename with timestamp and random string
    const uniqueName = `profile_${timestamp}_${randomString}${ext}`;
    cb(null, uniqueName);
  }
});

// Enhanced multer configuration for mobile optimization
const uploadSingleImage = multer({
  storage: singleStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // Only one file
  }
}).single('image');

// Enhanced error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one image is allowed.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + error.message
    });
  }

  if (error.message.includes('Only JPG, JPEG, PNG, and WebP files are allowed')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only JPG, JPEG, PNG, and WebP images are allowed.'
    });
  }

  if (error.message.includes('File size must be less than 10MB')) {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 10MB.'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'File upload failed: ' + error.message
  });
};

module.exports = {
  uploadSingleImage,
  handleUploadError
};
