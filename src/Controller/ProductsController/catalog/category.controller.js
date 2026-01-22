const Category = require("../../../Model/ProductsModel/category");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const allowedCategories = [
  "supplement","clothes","accessories","equipment","nutrition","wellness",
  "technology","books","apparel","footwear"
];

exports.createCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "superadmin") throw new ApiError(403, "Not authorized");

  const { name, description, image, sortOrder } = req.body;
  if (!name || typeof name !== "string") throw new ApiError(400, "Category name required");

  const trimmed = name.trim().toLowerCase();
  if (!allowedCategories.includes(trimmed)) {
    throw new ApiError(400, `Category must be one of: ${allowedCategories.join(", ")}`);
  }

  const exists = await Category.findOne({ name: trimmed });
  if (exists) throw new ApiError(400, "Category already exists");

  const category = await Category.create({
    name: trimmed,
    description: description?.trim(),
    image: image?.trim(),
    sortOrder: typeof sortOrder === "number" ? sortOrder : 0
  });

  res.status(201).json({ success: true, data: category });
});

exports.getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();

  res.json({ success: true, data: categories });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "superadmin") throw new ApiError(403, "Not authorized");

  const { id } = req.params;
  const { name, description, image, isActive, sortOrder } = req.body;

  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, "Category not found");

  if (name) {
    const trimmed = name.trim().toLowerCase();
    if (!allowedCategories.includes(trimmed)) {
      throw new ApiError(400, `Category must be one of: ${allowedCategories.join(", ")}`);
    }

    const dup = await Category.findOne({ name: trimmed, _id: { $ne: id } });
    if (dup) throw new ApiError(400, "Category name already exists");

    category.name = trimmed;
    category.slug = trimmed; // slug pre-hook will normalize too
  }

  if (description !== undefined) category.description = description?.trim();
  if (image !== undefined) category.image = image?.trim();
  if (isActive !== undefined) category.isActive = !!isActive;
  if (sortOrder !== undefined) category.sortOrder = sortOrder;

  await category.save();

  res.json({ success: true, data: category });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "superadmin") throw new ApiError(403, "Not authorized");

  const { id } = req.params;
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, "Category not found");

  // Soft delete (recommended)
  category.isActive = false;
  await category.save();

  res.json({ success: true, message: "Category deactivated" });
});
