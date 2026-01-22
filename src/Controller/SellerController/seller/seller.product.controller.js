// src/controllers/seller/seller.product.controller.js
const mongoose = require("mongoose");
const Product = require("../../../Model/ProductsModel/product");
const Category = require("../../../Model/ProductsModel/category");
const SubCategory = require("../../../Model/ProductsModel/subCategory");

const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");

/**
 * ✅ SELLER: List own products (search/filter/pagination + analytics)
 * Query:
 *  page, limit, search, category, subcategory, status(active/inactive),
 *  sortBy, sortOrder
 */
exports.getOwnProducts = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  const {
    page = 1,
    limit = 10,
    search,
    category,
    subcategory,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query = { sellerId };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
    ];
  }

  if (category) {
    if (mongoose.Types.ObjectId.isValid(category)) query.category = category;
    else {
      const cat = await Category.findOne({
        $or: [
          { name: { $regex: category, $options: "i" } },
          { slug: { $regex: category, $options: "i" } },
        ],
      }).select("_id");
      if (cat) query.category = cat._id;
    }
  }

  if (subcategory) {
    if (mongoose.Types.ObjectId.isValid(subcategory)) query.subcategory = subcategory;
    else {
      const sub = await SubCategory.findOne({
        $or: [
          { name: { $regex: subcategory, $options: "i" } },
          { slug: { $regex: subcategory, $options: "i" } },
        ],
      }).select("_id");
      if (sub) query.subcategory = sub._id;
    }
  }

  if (status === "active") query.isActive = true;
  if (status === "inactive") query.isActive = false;

  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(query),
  ]);

  // ✅ analytics (seller dashboard)
  const analyticsAgg = await Product.aggregate([
    { $match: { sellerId: new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: ["$isActive", 1, 0] } },
        inactiveProducts: { $sum: { $cond: ["$isActive", 0, 1] } },
        totalViews: { $sum: { $ifNull: ["$viewCount", 0] } },
        totalSales: { $sum: { $ifNull: ["$saleCount", 0] } },
        avgRating: { $avg: { $ifNull: ["$averageRating", 0] } },
        lowStockProducts: {
          $sum: {
            $cond: [{ $lte: ["$quantity", "$lowStockThreshold"] }, 1, 0],
          },
        },
        totalInventoryValue: { $sum: { $multiply: ["$price", "$quantity"] } },
      },
    },
  ]);

  const analytics =
    analyticsAgg?.[0] || {
      totalProducts: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      totalViews: 0,
      totalSales: 0,
      avgRating: 0,
      lowStockProducts: 0,
      totalInventoryValue: 0,
    };

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalProducts: total,
        limit: Number(limit),
      },
      analytics,
    },
  });
});

/**
 * ✅ SELLER: Update own product status (active/inactive, featured)
 */
exports.updateOwnProductStatus = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const { productId } = req.params;
  const { isActive, isFeatured } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  const product = await Product.findOne({ _id: productId, sellerId });
  if (!product) throw new ApiError(404, "Product not found");

  if (isActive === undefined && isFeatured === undefined)
    throw new ApiError(400, "Provide isActive or isFeatured");

  if (isActive !== undefined) product.isActive = !!isActive;
  if (isFeatured !== undefined) product.isFeatured = !!isFeatured;

  await product.save();

  res.json({
    success: true,
    message: "Product status updated",
    data: { productId, isActive: product.isActive, isFeatured: product.isFeatured },
  });
});

/**
 * ✅ SELLER: Get single own product with safe analytics fields
 */
exports.getOwnProductDetails = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  const product = await Product.findOne({ _id: productId, sellerId })
    .populate("category", "name slug")
    .populate("subcategory", "name slug");

  if (!product) throw new ApiError(404, "Product not found");

  res.json({ success: true, data: product });
});
