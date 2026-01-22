const express = require("express");
const router = express.Router();

const asyncHandler = require("../../Utils/aysncHandler");
const { authentication, isSuperAdmin } = require("../../Middleware/userAuth");

const {
  createSubCategory,
  getAllSubCategories,
  updateSubCategory,
  deleteSubCategory,
} = require("../../Controller/ProductsController/catalog/subcategory.controller");

/* =========================================================
   ✅ PUBLIC
========================================================= */

// GET /api/v1/subcategories
router.get("/", asyncHandler(getAllSubCategories));

/* =========================================================
   ✅ SUPERADMIN ONLY
========================================================= */

// POST /api/v1/subcategories
router.post("/", authentication, isSuperAdmin, asyncHandler(createSubCategory));

// PATCH /api/v1/subcategories/:id
router.patch("/:id", authentication, isSuperAdmin, asyncHandler(updateSubCategory));

// DELETE /api/v1/subcategories/:id (soft delete)
router.delete("/:id", authentication, isSuperAdmin, asyncHandler(deleteSubCategory));

module.exports = router;
