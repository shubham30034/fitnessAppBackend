const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const { authentication, isSuperAdmin } = require("../../Middleware/userAuth");

const {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} = require("../../Controller/ProductsController/catalog/category.controller");

/* =========================================================
   ✅ PUBLIC
========================================================= */

// GET /api/v1/categories
router.get("/", asyncHandler(getAllCategories));

/* =========================================================
   ✅ SUPERADMIN ONLY
========================================================= */

// POST /api/v1/categories
router.post("/", authentication, isSuperAdmin, asyncHandler(createCategory));

// PATCH /api/v1/categories/:id
router.patch("/:id",  authentication, isSuperAdmin, asyncHandler(updateCategory));

// DELETE /api/v1/categories/:id (soft delete)
router.delete("/:id",  authentication, isSuperAdmin, asyncHandler(deleteCategory));

module.exports = router;
