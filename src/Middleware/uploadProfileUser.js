const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* =========================================
   FILE FILTER (SAFE + SIMPLE)
========================================= */
const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(new Error("No file provided"));
  }

  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only JPG, JPEG, PNG, and WebP images are allowed")
    );
  }

  cb(null, true);
};

/* =========================================
   STORAGE CONFIG
========================================= */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user.id;

    if (!userId) {
      return cb(new Error("Unauthorized upload"));
    }

    const uploadPath = path.join(
      __dirname,
      `../../uploads/profile/${userId}`
    );

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `profile_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}${ext}`;

    cb(null, uniqueName);
  },
});

/* =========================================
   MULTER INSTANCE
========================================= */
const uploadSingleImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
}).single("image"); // 👈 FRONTEND MUST SEND "image"

/* =========================================
   ERROR HANDLER (CENTRALIZED)
========================================= */
const handleUploadError = (err, req, res, next) => {
  if (!err) return next();

  // Multer specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Max size is 10MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Upload error: " + err.message,
    });
  }

  // Custom errors
  return res.status(400).json({
    success: false,
    message: err.message || "File upload failed",
  });
};

module.exports = {
  uploadSingleImage,
  handleUploadError,
};
