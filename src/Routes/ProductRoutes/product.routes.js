const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const { authentication, isSellerOrAdmin } = require("../../Middleware/userAuth");

const {
  uploadProductImages,
  handleUploadError,
} = require("../../Middleware/productImageUpload");

const {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
} = require("../../Controller/ProductsController/product/product.controller");

const {
  uploadProductImages: uploadProductImagesController,
  deleteProductImage,
} = require("../../Controller/ProductsController/product/product.images.controller");

/* =========================================================
   ✅ PUBLIC
========================================================= */
router.get("/", asyncHandler(getAllProducts));
router.get("/:id", asyncHandler(getSingleProduct));

/* =========================================================
   ✅ SELLER / ADMIN / SUPERADMIN
========================================================= */
router.post("/", authentication, isSellerOrAdmin, asyncHandler(createProduct));
router.patch("/:id", authentication, isSellerOrAdmin, asyncHandler(updateProduct));
router.delete("/:id", authentication, isSellerOrAdmin, asyncHandler(deleteProduct));

/* =========================================================
   ✅ PRODUCT IMAGES
========================================================= */
router.post(
  "/:id/images",
  authentication,
  isSellerOrAdmin,
  uploadProductImages,   // ✅ multer (field name = images)
  handleUploadError,     // ✅ multer errors
  asyncHandler(uploadProductImagesController)
);

router.delete(
  "/:id/images/:imageId",
  authentication,
  isSellerOrAdmin,
  asyncHandler(deleteProductImage)
);

module.exports = router;
