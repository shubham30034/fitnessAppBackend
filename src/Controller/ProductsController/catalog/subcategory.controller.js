const SubCategory = require("../../../Model/ProductsModel/subCategory");
const Category = require("../../../Model/ProductsModel/category");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const mongoose = require("mongoose");

exports.createSubCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "superadmin") throw new ApiError(403, "Not authorized");

  const { name, categoryId, description, sortOrder } = req.body;

  if (!name || typeof name !== "string") throw new ApiError(400, "Subcategory name required");
  if (!mongoose.Types.ObjectId.isValid(categoryId)) throw new ApiError(400, "Invalid categoryId");

  const category = await Category.findById(categoryId);
  if (!category) throw new ApiError(404, "Category not found");

  const trimmed = name.trim();

  const dup = await SubCategory.findOne({ categoryId, name: trimmed });
  if (dup) throw new ApiError(400, "Subcategory already exists in this category");

  const sub = await SubCategory.create({
    name: trimmed,
    categoryId,
    description: description?.trim(),
    sortOrder: typeof sortOrder === "number" ? sortOrder : 0
  });

  res.status(201).json({ success: true, data: sub });
});

exports.getAllSubCategories = asyncHandler(async (req, res) => {
  const subs = await SubCategory.find({ isActive: true })
    .populate("categoryId", "name slug")
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();

  res.json({ success: true, data: subs });
});

exports.updateSubCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "superadmin") throw new ApiError(403, "Not authorized");

  const { id } = req.params;
  const { name, categoryId, description, isActive, sortOrder } = req.body;

  const sub = await SubCategory.findById(id);
  if (!sub) throw new ApiError(404, "Subcategory not found");

  if (categoryId) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) throw new ApiError(400, "Invalid categoryId");
    const category = await Category.findById(categoryId);
    if (!category) throw new ApiError(404, "Category not found");
    sub.categoryId = categoryId;
  }

  if (name) {
    const trimmed = name.trim();
    const dup = await SubCategory.findOne({
      categoryId: sub.categoryId,
      name: trimmed,
      _id: { $ne: id }
    });
    if (dup) throw new ApiError(400, "Subcategory name already exists in this category");
    sub.name = trimmed;
  }

  if (description !== undefined) sub.description = description?.trim();
  if (isActive !== undefined) sub.isActive = !!isActive;
  if (sortOrder !== undefined) sub.sortOrder = sortOrder;

  await sub.save();
  res.json({ success: true, data: sub });
});

exports.deleteSubCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "superadmin") throw new ApiError(403, "Not authorized");

  const { id } = req.params;
  const sub = await SubCategory.findById(id);
  if (!sub) throw new ApiError(404, "Subcategory not found");

  sub.isActive = false;
  await sub.save();

  res.json({ success: true, message: "Subcategory deactivated" });
});
