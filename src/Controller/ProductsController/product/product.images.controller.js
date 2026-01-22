const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const Product = require("../../../Model/ProductsModel/product");
const ApiError = require("../../../Utils/ApiError");
const asyncHandler = require("../../../Utils/aysncHandler");

const {
  validateImageFile,
  optimizeProductImage,
  safeUnlink,
} = require("../../../Utils/productImageOptimizer");

/* =========================
   HELPERS
========================= */

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// ✅ Base uploads root (project root)
const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "products");

// ✅ URL builder (IMPORTANT: productId included)
const url = (productId, filename) => `/uploads/products/${productId}/${filename}`;

const makeImageId = () => crypto.randomBytes(12).toString("hex");

// ✅ Variants URL
const variantUrlsFromId = (productId, id) => ({
  thumbnail: url(productId, `${id}_thumbnail.webp`),
  small: url(productId, `${id}_small.webp`),
  medium: url(productId, `${id}_medium.webp`),
  large: url(productId, `${id}_large.webp`),
});

const basenameFromUrl = (u) => path.basename(u || "");

const removeFromProductImages = (productImages = [], mediumUrl = "") => {
  const b = basenameFromUrl(mediumUrl);
  return productImages.filter((x) => basenameFromUrl(x) !== b);
};

/* =====================================================
   ✅ UPLOAD PRODUCT IMAGES (PER PRODUCT FOLDER)
===================================================== */
exports.uploadProductImages = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "Please upload at least 1 image");
  }

  if (!Array.isArray(product.productImages)) product.productImages = [];
  if (!Array.isArray(product.productImagesOptimized))
    product.productImagesOptimized = [];

  // ✅ product folder path
  const PRODUCT_DIR = path.join(UPLOAD_ROOT, productId);
  ensureDir(PRODUCT_DIR);

  // ✅ max images
  const MAX = 2;
  const already = product.productImagesOptimized.length;
  const remaining = MAX - already;

  if (remaining <= 0) {
    req.files.forEach((f) => safeUnlink(f.path));
    throw new ApiError(400, "Maximum 2 images allowed.");
  }

  if (req.files.length > remaining) {
    req.files.forEach((f) => safeUnlink(f.path));
    throw new ApiError(400, `Only ${remaining} more images allowed (max 2).`);
  }

  // ✅ validate first
  for (const file of req.files) {
    const check = validateImageFile(file);
    if (!check.valid) {
      req.files.forEach((f) => safeUnlink(f.path));
      throw new ApiError(400, check.error);
    }
  }

  const createdOnDisk = []; // rollback list
  const newOptimizedDocs = [];
  const newProductImages = [];

  try {
    for (const file of req.files) {
      const inputPath = file.path;
      const imageId = makeImageId();

      // ✅ sharp output now goes inside PRODUCT_DIR
      const { files } = await optimizeProductImage(inputPath, PRODUCT_DIR, imageId);

      // delete original uploaded file
      safeUnlink(inputPath);

      // track for rollback
      createdOnDisk.push(
        ...Object.values(files).map((f) => path.join(PRODUCT_DIR, f))
      );

      // urls include productId
      const urls = variantUrlsFromId(productId, imageId);

      newOptimizedDocs.push({
        id: imageId,
        optimized: {
          thumbnail: urls.thumbnail,
          small: urls.small,
          medium: urls.medium,
          large: urls.large,
        },
        createdAt: new Date(),
      });

      // ✅ store only medium in main productImages
      newProductImages.push(urls.medium);
    }

    // prevent duplicate id
    const existingIds = new Set(product.productImagesOptimized.map((x) => x.id));
    for (const doc of newOptimizedDocs) {
      if (existingIds.has(doc.id)) {
        throw new ApiError(500, "Image id collision, retry upload");
      }
    }

    // apply DB changes
    product.productImagesOptimized.push(...newOptimizedDocs);
    product.productImages.push(...newProductImages);

    await product.save();

    return res.status(201).json({
      success: true,
      message: "Product images uploaded successfully",
      data: {
        productId: product._id,
        uploadedCount: newOptimizedDocs.length,
        productImages: product.productImages,
        productImagesOptimized: product.productImagesOptimized,
      },
    });
  } catch (err) {
    // rollback disk files
    createdOnDisk.forEach((p) => safeUnlink(p));
    req.files.forEach((f) => safeUnlink(f.path));

    if (err instanceof ApiError) throw err;
    throw new ApiError(500, err.message || "Upload failed");
  }
});

/* =====================================================
   ✅ DELETE PRODUCT IMAGE (PER PRODUCT FOLDER)
===================================================== */
exports.deleteProductImage = asyncHandler(async (req, res) => {
  const { id: productId, imageId } = req.params;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  if (!Array.isArray(product.productImagesOptimized) || product.productImagesOptimized.length === 0) {
    throw new ApiError(404, "No images found for this product");
  }

  const idx = product.productImagesOptimized.findIndex((img) => img.id === imageId);
  if (idx === -1) throw new ApiError(404, "Image not found");

  const img = product.productImagesOptimized[idx];
  const o = img.optimized || {};

  // ✅ per product folder
  const PRODUCT_DIR = path.join(UPLOAD_ROOT, productId);

  // disk files inside product folder
  const files = [o.thumbnail, o.small, o.medium, o.large]
    .filter(Boolean)
    .map((u) => path.join(PRODUCT_DIR, path.basename(u)));

  // remove from DB arrays
  product.productImagesOptimized.splice(idx, 1);
  product.productImages = removeFromProductImages(product.productImages, o.medium);

  await product.save();

  // delete disk after DB success
  files.forEach((p) => safeUnlink(p));

  return res.status(200).json({
    success: true,
    message: "Product image deleted successfully",
    data: {
      productId: product._id,
      deletedImageId: imageId,
      productImages: product.productImages,
      productImagesOptimized: product.productImagesOptimized,
    },
  });
});
