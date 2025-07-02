const multer = require('multer');
const path = require('path');
const fs = require('fs');

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const productId = req.params.productId;
    const uploadPath = path.join(__dirname, `../../uploads/products/${productId}`);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, PNG files are allowed'));
  }
};

const uploadProductImage = multer({
  storage: productStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).array('productImage', 3); // ✅ Fixed field name

module.exports = uploadProductImage;
