const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");

const {
  authentication,
  isSuperAdmin,
} = require("../../Middleware/userAuth");

const {
  createSubCategory,
  getAllSubCategories,
  updateSubCategory,
  deleteSubCategory,
} = require("../../Controller/ProductsController/catalog/subcategory.controller");

/* =========================================================
   ✅ PUBLIC ROUTES
========================================================= */

/**
 * GET /api/v1/subcategories
 * Get all active subcategories
 */
router.get("/", asyncHandler(getAllSubCategories));

/* =========================================================
   ✅ SUPER ADMIN ROUTES
========================================================= */

/**
 * POST /api/v1/subcategories
 * Create subcategory
 */
router.post(
  "/",
  authentication,
  isSuperAdmin,
  asyncHandler(createSubCategory)
);

/**
 * PATCH /api/v1/subcategories/:id
 * Update subcategory
 */
router.patch(
  "/:id",
  authentication,
  isSuperAdmin,
  asyncHandler(updateSubCategory)
);

/**
 * DELETE /api/v1/subcategories/:id
 * Soft delete subcategory
 */
router.delete(
  "/:id",
  authentication,
  isSuperAdmin,
  asyncHandler(deleteSubCategory)
);

module.exports = router;