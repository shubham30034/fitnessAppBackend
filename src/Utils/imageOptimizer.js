const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

/* ===============================
   PROFILE IMAGE SIZES
================================ */
const PROFILE_SIZES = {
  small: 150,
  medium: 300,
};

/* ===============================
   VALIDATION
================================ */
const validateImageFile = (file) => {
  if (!file) return { valid: false, error: "No file provided" };

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return { valid: false, error: "Only JPG, PNG, WEBP allowed" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: "Image must be under 5MB" };
  }

  return { valid: true };
};

/* ===============================
   OPTIMIZE PROFILE IMAGE
================================ */
const optimizeProfilePicture = async (inputPath, outputDir, filename) => {
  const results = {};
  const baseName = path.parse(filename).name;

  for (const [key, size] of Object.entries(PROFILE_SIZES)) {
    const outName = `${baseName}_${key}.webp`;
    const outPath = path.join(outputDir, outName);

    if (!sharp) {
      fs.copyFileSync(inputPath, outPath);
      results[key] = outName;
      continue;
    }

    await sharp(inputPath)
      .rotate()
      .resize(size, size, { fit: "cover" })
      .webp({ quality: 75 })
      .toFile(outPath);

    results[key] = outName;
  }

  return results;
};

/* ===============================
   CLEANUP OLD IMAGES (SAFE)
================================ */
const cleanupOldImages = (dir, oldFilename) => {
  if (!oldFilename || !fs.existsSync(dir)) return;

  const oldBase = path.parse(oldFilename).name;

  fs.readdirSync(dir).forEach(file => {
    if (file.startsWith(oldBase) && file.endsWith(".webp")) {
      fs.unlinkSync(path.join(dir, file));
    }
  });
};

/* ===============================
   GENERATE URLS
================================ */
const generateProfileUrls = (userId, images) => {
  const base = `/uploads/profile/${userId}`;
  return {
    small: `${base}/${images.small}`,
    medium: `${base}/${images.medium}`,
  };
};

module.exports = {
  validateImageFile,
  optimizeProfilePicture,
  cleanupOldImages,
  generateProfileUrls,
};
