const multer = require('multer');
const path = require('path');
const fs = require('fs');


const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const productId = req.params.productId;
    const uploadPath = path.join(__dirname, `../../uploads/products/${productId}`);

    // Create folder if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    // Use timestamp + original name to avoid collisions
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [".jpg", ".jpeg", ".png"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) cb(null, true);
  else cb(new Error("Only JPG, JPEG, PNG files are allowed"));
};

// Allow max 3 images, each up to 5MB
const uploadProductImage = multer({
  storage: productStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB per file
  }
}).array("productImages", 3); // <-- max 3 images

module.exports = uploadProductImage;
