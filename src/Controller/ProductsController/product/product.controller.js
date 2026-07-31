const Product = require("../../../Model/ProductsModel/product");
const Category = require("../../../Model/ProductsModel/category");
const SubCategory = require("../../../Model/ProductsModel/subCategory");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const mongoose = require("mongoose");

const {
  validateCreateProduct,
  validateUpdateProduct,
} = require("../../../validator/productValidation");


/* =========================================================
   ✅ CREATE PRODUCT (SELLER)
========================================================= */
exports.createProduct = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  const { error } = validateCreateProduct({ ...req.body, sellerId });
  if (error) throw new ApiError(400, error.details[0].message);

  let {
    name,
    description,
    brand,
    price,
    originalPrice,
    quantity = 0,
    lowStockThreshold = 5,
    category,
    subcategory,
    metaTitle,
    metaDescription,
    keywords,
    isActive,
    isFeatured,
    variants,
  } = req.body;

  // ===== PRICE & STOCK SANITY =====
  if (price < 0) throw new ApiError(400, "Price cannot be negative");
  if (quantity < 0) throw new ApiError(400, "Quantity cannot be negative");
  if (lowStockThreshold < 0)
    throw new ApiError(400, "lowStockThreshold cannot be negative");

  if (originalPrice !== undefined) {
    if (originalPrice < 0)
      throw new ApiError(400, "originalPrice cannot be negative");
    if (Number(originalPrice) <= Number(price))
      throw new ApiError(400, "originalPrice must be greater than price");
  }

  // ===== CATEGORY VALIDATION =====
  if (!mongoose.Types.ObjectId.isValid(category))
    throw new ApiError(400, "Invalid category");

  const cat = await Category.findById(category);
  if (!cat || !cat.isActive)
    throw new ApiError(404, "Category not found/inactive");

  // ===== SUBCATEGORY RELATION CHECK =====
  if (subcategory) {
    if (!mongoose.Types.ObjectId.isValid(subcategory))
      throw new ApiError(400, "Invalid subcategory");

    const sub = await SubCategory.findById(subcategory);
    if (!sub || !sub.isActive)
      throw new ApiError(404, "Subcategory not found/inactive");

    if (String(sub.category) !== String(category))
      throw new ApiError(400, "Subcategory does not belong to category");
  }

  // ===== DUPLICATE NAME PER SELLER =====
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
    quantity: Number(quantity),
    lowStockThreshold: Number(lowStockThreshold),
    category,
    subcategory,
    metaTitle: metaTitle?.trim(),
    metaDescription: metaDescription?.trim(),
    keywords: Array.isArray(keywords)
      ? keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    isActive: isActive ?? true,
    isFeatured: isFeatured ?? false,
    variants: Array.isArray(variants) ? variants : [],
  });

  res.status(201).json({ success: true, data: product });
});



/* =========================================================
   ✅ UPDATE PRODUCT
========================================================= */
exports.updateProduct = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const { id } = req.params;

  const { error } = validateUpdateProduct({ productId: id, ...req.body });
  if (error) throw new ApiError(400, error.details[0].message);

  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(400, "Invalid product id");

  const product =
    ["admin", "superadmin"].includes(role)
      ? await Product.findById(id)
      : await Product.findOne({ _id: id, sellerId: userId });

  if (!product) throw new ApiError(404, "Product not found/unauthorized");

  // ===== NAME CHANGE =====
  if (req.body.name && req.body.name.trim() !== product.name) {
    const dup = await Product.findOne({
      _id: { $ne: id },
      sellerId: product.sellerId,
      name: req.body.name.trim(),
      isActive: true,
    });
    if (dup) throw new ApiError(400, "Product with this name already exists");

    product.slug = await Product.generateUniqueSlug(req.body.name, id);
    product.name = req.body.name.trim();
  }

  // ===== APPLY FIELD UPDATES =====
  Object.assign(product, req.body);

  // ===== CATEGORY TREE INTEGRITY =====
  const finalCategory = req.body.category ?? product.category;
  const finalSubcategory =
    req.body.subcategory !== undefined
      ? req.body.subcategory
      : product.subcategory;

  if (finalSubcategory) {
    const sub = await SubCategory.findById(finalSubcategory);
    if (!sub || !sub.isActive)
      throw new ApiError(404, "Subcategory invalid");

    if (String(sub.category) !== String(finalCategory))
      throw new ApiError(400, "Subcategory does not belong to category");
  }

  // ===== PRICE & STOCK RULES =====
  if (product.price < 0) throw new ApiError(400, "Price cannot be negative");
  if (product.quantity < 0)
    throw new ApiError(400, "Quantity cannot be negative");

  if (product.originalPrice !== undefined) {
    if (product.originalPrice <= product.price)
      throw new ApiError(400, "originalPrice must be greater than price");
  }

  await product.save();

  res.json({ success: true, data: product });
});



/* =========================================================
   🌍 GET ALL PRODUCTS (SEARCH + FILTER + SORT + PAGINATION)
========================================================= */
exports.getAllProducts = asyncHandler(async (req, res) => {
  let {
    page = 1,
    limit = 12,
    search,
    category,
    subcategory,
    brand,
    featured,
    minPrice,
    maxPrice,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit) || 12, 1), 100);

  const filter = {
    isActive: true,
  };

  /* ================= SEARCH ================= */

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");

    filter.$or = [
      { name: regex },
      { brand: regex },
      { description: regex },
      { keywords: regex },
    ];
  }

  /* ================= CATEGORY ================= */

  if (category) {
    if (!mongoose.Types.ObjectId.isValid(category))
      throw new ApiError(400, "Invalid category");

    filter.category = category;
  }

  /* ================= SUBCATEGORY ================= */

  if (subcategory) {
    if (!mongoose.Types.ObjectId.isValid(subcategory))
      throw new ApiError(400, "Invalid subcategory");

    filter.subcategory = subcategory;
  }

  /* ================= BRAND ================= */

  if (brand) {
    filter.brand = new RegExp(`^${brand.trim()}$`, "i");
  }

  /* ================= FEATURED ================= */

  if (featured !== undefined) {
    filter.isFeatured = featured === "true";
  }

  /* ================= PRICE RANGE ================= */

  if (minPrice || maxPrice) {
    filter.price = {};

    if (minPrice) {
      filter.price.$gte = Number(minPrice);
    }

    if (maxPrice) {
      filter.price.$lte = Number(maxPrice);
    }
  }

  /* ================= SAFE SORT ================= */

  const allowedSortFields = [
    "createdAt",
    "price",
    "viewCount",
    "saleCount",
    "name",
  ];

  const safeSortBy = allowedSortFields.includes(sortBy)
    ? sortBy
    : "createdAt";

  const sort = {
    [safeSortBy]: sortOrder === "asc" ? 1 : -1,
  };

  /* ================= DATABASE ================= */

  const [products, totalProducts] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalProducts / limit);

  res.status(200).json({
    success: true,

    data: products,

    pagination: {
      currentPage: page,
      totalPages,
      totalProducts,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

/* =========================================================
   ✅ GET SINGLE PRODUCT (PUBLIC)
========================================================= */
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

/* =========================================================
   ✅ DELETE PRODUCT (SELLER OWN OR ADMIN/SUPERADMIN ANY)
========================================================= */
exports.deleteProduct = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(400, "Invalid product id");

  let product;
  if (["admin", "superadmin"].includes(role)) {
    product = await Product.findById(id);
  } else {
    product = await Product.findOne({ _id: id, sellerId: userId });
  }

  if (!product) throw new ApiError(404, "Product not found/unauthorized");

  // soft delete
  product.isActive = false;
  await product.save();

  res.json({ success: true, message: "Product deactivated" });
});

/* =========================================================
   ✅ GET PRODUCTS BY CATEGORY (PUBLIC)
========================================================= */
exports.getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { page = 1, limit = 12 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(categoryId))
    throw new ApiError(400, "Invalid category id");

  const cat = await Category.findById(categoryId);
  if (!cat || !cat.isActive)
    throw new ApiError(404, "Category not found/inactive");

  const skip = (Number(page) - 1) * Number(limit);

  const products = await Product.find({
    category: categoryId,
    isActive: true,
  })
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Product.countDocuments({
    category: categoryId,
    isActive: true,
  });

  res.json({
    success: true,
    data: {
      category: { _id: cat._id, name: cat.name, slug: cat.slug },
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalProducts: total,
      },
    },
  });
});
