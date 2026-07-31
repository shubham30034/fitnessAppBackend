const mongoose = require("mongoose");
const Product = require("../../../Model/ProductsModel/product");
const Category = require("../../../Model/ProductsModel/category");
const SubCategory = require("../../../Model/ProductsModel/subCategory");
const Order = require("../../../Model/ProductsModel/orderSchema");

const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");

/* ================= HELPERS ================= */
const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toBool = (v) => {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return null;
};

const allowedSortFields = [
  "createdAt",
  "updatedAt",
  "price",
  "quantity",
  "viewCount",
  "saleCount",
  "averageRating",
  "name",
];

const DEFAULT_ADMIN_ANALYTICS = {
  totalProducts: 0,
  activeProducts: 0,
  featuredProducts: 0,
  lowStockProducts: 0,
  totalInventoryValue: 0,
  totalRevenuePotential: 0,
  averagePrice: 0,
  activeSellers: 0,
};

/* =========================================================
   ADMIN: GET ALL PRODUCTS
========================================================= */
exports.getAllProductsForAdmin = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    subcategory,
    sellerId,
    status,
    minPrice,
    maxPrice,
    sortBy = "createdAt",
    sortOrder = "desc",
    lowStock,
    featured,
    analytics = "false",
  } = req.query;

  const safeLimit = Math.min(Number(limit), 100);
  const skip = (Number(page) - 1) * safeLimit;

  const query = {};

  if (search) {
    const safe = escapeRegex(String(search).slice(0, 50));
    query.$or = [
      { name: { $regex: safe, $options: "i" } },
      { brand: { $regex: safe, $options: "i" } },
      { sku: { $regex: safe, $options: "i" } },
    ];
  }

  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;
  if (sellerId) query.sellerId = sellerId;

  if (status === "active") query.isActive = true;
  if (status === "inactive") query.isActive = false;
  if (featured === "true") query.isFeatured = true;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (lowStock === "true") {
    query.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };
  }

  const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sort = { [finalSortBy]: sortOrder === "asc" ? 1 : -1 };

  const [products, total] = await Promise.all([
    Product.find(query)
      .select(`
        name slug description brand sku
        price originalPrice
        quantity lowStockThreshold
        isActive isFeatured
        viewCount saleCount averageRating
        category subcategory sellerId
        createdAt updatedAt
      `)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .populate({
        path: "sellerId",
        select: "role additionalInfo",
        populate: { path: "additionalInfo", select: "name email phone" },
      })
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Product.countDocuments(query),
  ]);

  /* ===== Analytics ===== */
  let analyticsData = null;
  if (analytics === "true") {
    const analyticsMatch = JSON.parse(JSON.stringify(query));

    const [stats, sellers] = await Promise.all([
      Product.aggregate([
        { $match: analyticsMatch },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: { $sum: { $cond: ["$isActive", 1, 0] } },
            featuredProducts: { $sum: { $cond: ["$isFeatured", 1, 0] } },
            lowStockProducts: {
              $sum: { $cond: [{ $lte: ["$quantity", "$lowStockThreshold"] }, 1, 0] },
            },
            totalInventoryValue: { $sum: { $multiply: ["$price", "$quantity"] } },
            totalRevenuePotential: {
              $sum: { $multiply: ["$price", { $ifNull: ["$saleCount", 0] }] },
            },
            averagePrice: { $avg: "$price" },
          },
        },
      ]),
      Product.aggregate([
        { $match: analyticsMatch },
        { $group: { _id: "$sellerId", active: { $sum: { $cond: ["$isActive", 1, 0] } } } },
        { $match: { active: { $gt: 0 } } },
        { $count: "activeSellers" },
      ]),
    ]);

    analyticsData = stats[0] || DEFAULT_ADMIN_ANALYTICS;
    analyticsData.activeSellers = sellers?.[0]?.activeSellers || 0;
  }

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / safeLimit),
        totalProducts: total,
        limit: safeLimit,
      },
      analytics: analyticsData,
    },
  });
});

/* =========================================================
   ADMIN: PRODUCT DETAILS WITH REVENUE ANALYTICS
========================================================= */
exports.getProductDetailsForAdmin = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  const product = await Product.findById(productId)
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate({
      path: "sellerId",
      select: "role additionalInfo",
      populate: { path: "additionalInfo", select: "name email phone" },
    });

  if (!product) throw new ApiError(404, "Product not found");

  const revenueStats = await Order.aggregate([
    { $match: { "products.productId": new mongoose.Types.ObjectId(productId), paymentStatus: "Paid" } },
    { $unwind: "$products" },
    { $match: { "products.productId": new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
        totalQuantity: { $sum: "$products.quantity" },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      product,
      analytics: revenueStats[0] || { totalRevenue: 0, totalQuantity: 0, totalOrders: 0 },
    },
  });
});

/* =========================================================
   ADMIN: BULK STATUS UPDATE
========================================================= */
exports.bulkUpdateProductStatus = asyncHandler(async (req, res) => {
  const { productIds, isActive, isFeatured } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0)
    throw new ApiError(400, "productIds array required");

  if (productIds.length > 500)
    throw new ApiError(400, "Bulk limit exceeded");

  const ids = productIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const update = {};

  if (isActive !== undefined) {
    const val = toBool(isActive);
    if (val === null) throw new ApiError(400, "isActive must be boolean");
    update.isActive = val;
  }

  if (isFeatured !== undefined) {
    const val = toBool(isFeatured);
    if (val === null) throw new ApiError(400, "isFeatured must be boolean");
    update.isFeatured = val;
  }

  if (!Object.keys(update).length)
    throw new ApiError(400, "Provide isActive or isFeatured");

  const result = await Product.updateMany({ _id: { $in: ids } }, update);

  res.json({
    success: true,
    message: `Updated ${result.modifiedCount} products`,
  });
});
