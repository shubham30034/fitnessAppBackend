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

  // Additional validation for product images
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Only JPG, JPEG, PNG, and WebP files are allowed'));
  }

  // Check file size (15MB max for product images)
  if (file.size > 15 * 1024 * 1024) {
    return cb(new Error('File size must be less than 15MB'));
  }

  cb(null, true);
};

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const productId = req.params.productId;
    const uploadPath = path.join(__dirname, `../../uploads/products/${productId}`);
    
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
    const uniqueName = `product_${timestamp}_${randomString}${ext}`;
    cb(null, uniqueName);
  }
});

// Enhanced multer configuration for mobile optimization
const uploadProductImage = multer({
  storage: productStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
    files: 3 // Maximum 3 files
  },
}).array('productImage', 3);

// Enhanced error handling middleware
const handleProductUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 15MB per image.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 3 images are allowed.'
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

  if (error.message.includes('File size must be less than 15MB')) {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 15MB per image.'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'File upload failed: ' + error.message
  });
};

module.exports = {
  uploadProductImage,
  handleProductUploadError
};
