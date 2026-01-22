const Product = require("../../../Model/ProductsModel/product");
const Category = require("../../../Model/ProductsModel/category");
const SubCategory = require("../../../Model/ProductsModel/subCategory");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const mongoose = require("mongoose");

// ✅ VALIDATOR IMPORT
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require("../../../validator/productValidation");

exports.createProduct = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  // ✅ VALIDATION ADDED
  const { error } = validateCreateProduct({ ...req.body, sellerId });
  if (error) throw new ApiError(400, error.details[0].message);

  const {
    name,
    description,
    brand,
    price,
    originalPrice,
    quantity,
    lowStockThreshold,
    category,
    subcategory,
    metaTitle,
    metaDescription,
    keywords,
    isActive,
    isFeatured,
    variants,
  } = req.body;

  if (!name || !description || price === undefined || !category)
    throw new ApiError(400, "name, description, price, category are required");

  if (!mongoose.Types.ObjectId.isValid(category))
    throw new ApiError(400, "Invalid category");
  const cat = await Category.findById(category);
  if (!cat || !cat.isActive)
    throw new ApiError(404, "Category not found/inactive");

  if (subcategory) {
    if (!mongoose.Types.ObjectId.isValid(subcategory))
      throw new ApiError(400, "Invalid subcategory");
    const sub = await SubCategory.findById(subcategory);
    if (!sub || !sub.isActive)
      throw new ApiError(404, "Subcategory not found/inactive");
  }

  // Prevent duplicate product name per seller
  const dup = await Product.findOne({
    sellerId,
    name: name.trim(),
    isActive: true,
  });
  if (dup) throw new ApiError(400, "Product with this name already exists");

  const slug = await Product.generateUniqueSlug(name);

  const product = await Product.create({
    sellerId,
    name: name.trim(),
    description: description.trim(),
    brand: brand?.trim(),
    slug,
    price: Number(price),
    originalPrice:
      originalPrice !== undefined ? Number(originalPrice) : undefined,
    quantity: quantity !== undefined ? Number(quantity) : 0,
    lowStockThreshold:
      lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
    category,
    subcategory,
    metaTitle: metaTitle?.trim(),
    metaDescription: metaDescription?.trim(),
    keywords: Array.isArray(keywords)
      ? keywords.map((k) => String(k).trim())
      : [],
    isActive: isActive !== undefined ? !!isActive : true,
    isFeatured: isFeatured !== undefined ? !!isFeatured : false,
    variants: Array.isArray(variants) ? variants : [],
  });

  res.status(201).json({ success: true, data: product });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const { id } = req.params;

  // ✅ VALIDATION ADDED
  const { error } = validateUpdateProduct({ productId: id, ...req.body });
  if (error) throw new ApiError(400, error.details[0].message);

  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(400, "Invalid product id");

  const product = await Product.findOne({ _id: id, sellerId });
  if (!product) throw new ApiError(404, "Product not found/unauthorized");

  const allowedFields = [
    "name",
    "description",
    "brand",
    "price",
    "originalPrice",
    "quantity",
    "lowStockThreshold",
    "category",
    "subcategory",
    "metaTitle",
    "metaDescription",
    "keywords",
    "isActive",
    "isFeatured",
    "variants",
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) product[key] = req.body[key];
  }

  if (req.body.name && req.body.name.trim() !== product.name) {
    product.slug = await Product.generateUniqueSlug(req.body.name, id);
    product.name = req.body.name.trim();
  }

  await product.save();
  res.json({ success: true, data: product });
});

exports.getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    subcategory,
    minPrice,
    maxPrice,
    sortBy = "createdAt",
    sortOrder = "desc",
    search,
    brand,
    inStock,
    featured,
  } = req.query;

  const query = { isActive: true };

  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;

  if (brand) query.brand = { $regex: brand, $options: "i" };
  if (featured === "true") query.isFeatured = true;
  if (inStock === "true") query.quantity = { $gt: 0 };

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (search) query.$text = { $search: search };

  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
  const skip = (Number(page) - 1) * Number(limit);

  const products = await Product.find(query)
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .sort(sort)
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Product.countDocuments(query);

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalProducts: total,
      },
    },
  });
});

exports.getSingleProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(400, "Invalid product id");

  const product = await Product.findOneAndUpdate(
    { _id: id, isActive: true },
    { $inc: { viewCount: 1 } },
    { new: true }
  )
    .populate("category", "name slug description")
    .populate("subcategory", "name slug");

  if (!product) throw new ApiError(404, "Product not found");

  res.json({ success: true, data: product });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(400, "Invalid product id");

  const product = await Product.findOne({ _id: id, sellerId });
  if (!product) throw new ApiError(404, "Product not found/unauthorized");

  // soft delete
  product.isActive = false;
  await product.save();

  res.json({ success: true, message: "Product deactivated" });
});
