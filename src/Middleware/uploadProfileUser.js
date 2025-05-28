const multer = require('multer');
const path = require('path');
const fs = require('fs');

const singleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user.id; // Note: req.user.id must exist before multer runs
    const uploadPath = path.join(__dirname, `../../uploads/profile/${userId}`);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) cb(null, true);
  else cb(new Error("Only JPG, JPEG, PNG files are allowed"));
};

const uploadSingleImage = multer({
  storage: singleStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}).single('image');

module.exports = uploadSingleImage;
