const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const { authentication, isAdminOrSuperAdmin } = require("../../Middleware/userAuth");

const {
  getAllProductsForAdmin,
  getProductDetailsForAdmin,
  bulkUpdateProductStatus,
} = require("../../Controller/adminController/product/admin.product.controller");

/* 🔐 Admin access */
router.use(authentication);
router.use(isAdminOrSuperAdmin);

/* 📦 LIST PRODUCTS */
router.get("/", asyncHandler(getAllProductsForAdmin));

/* 📄 PRODUCT DETAILS */
router.get("/:productId", asyncHandler(getProductDetailsForAdmin));

/* 🔄 BULK UPDATE */
router.patch("/bulk-status", asyncHandler(bulkUpdateProductStatus));

module.exports = router;
