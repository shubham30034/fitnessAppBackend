const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../Utils/ApiError");

const UPLOAD_DIR = path.join(__dirname, "../../uploads/products");

// ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* =========================
   STORAGE
========================= */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // unique name
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

/* =========================
   FILE FILTER
========================= */
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];

  if (!allowed.includes(file.mimetype)) {
    return cb(new ApiError(400, "Only JPG, PNG, WEBP allowed"), false);
  }
  cb(null, true);
};

/* =========================
   UPLOADER
========================= */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // ✅ 8MB per file
    files: 2, // ✅ max 10 images
  },
});

/**
 * ✅ FIELD NAME FIXED:
 * Client/Postman should send key = "images"
 */
exports.uploadProductImages = upload.array("images", 10);

/* =========================
   ERROR HANDLER MIDDLEWARE
========================= */
exports.handleUploadError = (err, req, res, next) => {
  // Multer errors
  if (err && err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Each image must be under 8MB",
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Maximum 2 images allowed",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "Upload error",
    });
  }

  // ApiError from fileFilter
  if (err instanceof ApiError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};
