const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

const PRODUCT_SIZES = {
  thumbnail: 200,
  small: 480,
  medium: 1080,
  large: 1600,
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const safeUnlink = (p) => {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
};

const validateImageFile = (file) => {
  if (!file) return { valid: false, error: "No file provided" };

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return { valid: false, error: "Only JPG, PNG, WEBP allowed" };
  }

  // product images can be slightly larger
  if (file.size > 8 * 1024 * 1024) {
    return { valid: false, error: "Image must be under 8MB" };
  }

  return { valid: true };
};

const optimizeProductImage = async (inputPath, outputDir, baseId) => {
  ensureDir(outputDir);

  const out = {};
  const outPaths = {};

  for (const [key, size] of Object.entries(PRODUCT_SIZES)) {
    const outName = `${baseId}_${key}.webp`;
    const outPath = path.join(outputDir, outName);

    // fallback: if sharp missing, copy
    if (!sharp) {
      fs.copyFileSync(inputPath, outPath);
      out[key] = outName;
      outPaths[key] = outPath;
      continue;
    }

    const pipeline = sharp(inputPath).rotate();

    if (key === "thumbnail") {
      await pipeline
        .resize(size, size, { fit: "cover" })
        .webp({ quality: 55 })
        .toFile(outPath);
    } else {
      await pipeline
        .resize({ width: size, withoutEnlargement: true })
        .webp({ quality: key === "large" ? 82 : 75 })
        .toFile(outPath);
    }

    out[key] = outName;
    outPaths[key] = outPath;
  }

  return { files: out, paths: outPaths };
};

const cleanupVariantsByFiles = (outputDir, filesObj = {}) => {
  Object.values(filesObj).forEach((file) => {
    safeUnlink(path.join(outputDir, file));
  });
};

module.exports = {
  validateImageFile,
  optimizeProductImage,
  cleanupVariantsByFiles,
  safeUnlink,
};
