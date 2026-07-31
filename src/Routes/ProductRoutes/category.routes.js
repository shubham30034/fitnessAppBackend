const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const {
  authentication,
  isSuperAdmin,
} = require("../../Middleware/userAuth");

const {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} = require("../../Controller/ProductsController/catalog/category.controller");

/* =========================================================
   ✅ PUBLIC ROUTES
========================================================= */

/**
 * GET /api/v1/categories
 * Get all active categories
 */
router.get("/", asyncHandler(getAllCategories));

/* =========================================================
   ✅ SUPER ADMIN ROUTES
========================================================= */

/**
 * POST /api/v1/categories
 * Create category
 */
router.post(
  "/",
  authentication,
  isSuperAdmin,
  asyncHandler(createCategory)
);

/**
 * PATCH /api/v1/categories/:id
 * Update category
 */
router.patch(
  "/:id",
  authentication,
  isSuperAdmin,
  asyncHandler(updateCategory)
);

/**
 * DELETE /api/v1/categories/:id
 * Soft delete category
 */
router.delete(
  "/:id",
  authentication,
  isSuperAdmin,
  asyncHandler(deleteCategory)
);

module.exports = router;