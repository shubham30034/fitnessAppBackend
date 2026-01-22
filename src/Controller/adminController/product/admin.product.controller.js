// controllers/admin/admin.product.controller.js
const mongoose = require("mongoose");
const Product = require("../../../Model/ProductsModel/product");
const Category = require("../../../Model/ProductsModel/category");
const SubCategory = require("../../../Model/ProductsModel/subCategory");
const Order = require("../../../Model/ProductsModel/orderSchema");

const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");

/**
 * ✅ ADMIN: Get all products (advanced filters + analytics)
 * Query:
 *  page, limit, search, category, subcategory, sellerId, status(active/inactive),
 *  minPrice, maxPrice, sortBy, sortOrder, lowStock(true), featured(true)
 */
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
  } = req.query;

  const query = {};

  // search
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
    ];
  }

  // category can be ObjectId OR category name slug/name
  if (category) {
    if (mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    } else {
      const cat = await Category.findOne({
        $or: [
          { name: { $regex: category, $options: "i" } },
          { slug: { $regex: category, $options: "i" } },
        ],
      }).select("_id");
      if (cat) query.category = cat._id;
    }
  }

  // subcategory can be ObjectId OR name/slug
  if (subcategory) {
    if (mongoose.Types.ObjectId.isValid(subcategory)) {
      query.subcategory = subcategory;
    } else {
      const sub = await SubCategory.findOne({
        $or: [
          { name: { $regex: subcategory, $options: "i" } },
          { slug: { $regex: subcategory, $options: "i" } },
        ],
      }).select("_id");
      if (sub) query.subcategory = sub._id;
    }
  }

  if (sellerId) {
    if (!mongoose.Types.ObjectId.isValid(sellerId))
      throw new ApiError(400, "Invalid sellerId");
    query.sellerId = sellerId;
  }

  if (status === "active") query.isActive = true;
  if (status === "inactive") query.isActive = false;

  if (featured === "true") query.isFeatured = true;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // low stock
  if (lowStock === "true") {
    query.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };
  }

  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .populate({
        path: "sellerId",
        select: "phone additionalInfo role",
        populate: { path: "additionalInfo", select: "name email" },
      })
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(query),
  ]);

  // analytics: based on same query (filtered)
  const analyticsAgg = await Product.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: ["$isActive", 1, 0] } },
        featuredProducts: { $sum: { $cond: ["$isFeatured", 1, 0] } },
        lowStockProducts: {
          $sum: {
            $cond: [{ $lte: ["$quantity", "$lowStockThreshold"] }, 1, 0],
          },
        },
        totalInventoryValue: { $sum: { $multiply: ["$price", "$quantity"] } },
        totalRevenuePotential: {
          $sum: { $multiply: ["$price", { $ifNull: ["$saleCount", 0] }] },
        },
        averagePrice: { $avg: "$price" },
      },
    },
  ]);

  // active sellers count for this query
  const activeSellersAgg = await Product.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$sellerId",
        activeCount: { $sum: { $cond: ["$isActive", 1, 0] } },
      },
    },
    { $match: { activeCount: { $gt: 0 } } },
    { $count: "activeSellers" },
  ]);

  const analytics = analyticsAgg?.[0] || {
    totalProducts: 0,
    activeProducts: 0,
    featuredProducts: 0,
    lowStockProducts: 0,
    totalInventoryValue: 0,
    totalRevenuePotential: 0,
    averagePrice: 0,
  };

  analytics.activeSellers = activeSellersAgg?.[0]?.activeSellers || 0;

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
 * ✅ ADMIN: Product details with order analytics
 */
exports.getProductDetailsForAdmin = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  const product = await Product.findById(productId)
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate({
      path: "sellerId",
      select: "phone additionalInfo role",
      populate: { path: "additionalInfo", select: "name email" },
    });

  if (!product) throw new ApiError(404, "Product not found");

  const orders = await Order.find({ "products.productId": productId })
    .select("products totalPrice status paymentStatus createdAt userId orderNumber")
    .populate({ path: "userId", select: "phone additionalInfo", populate: { path: "additionalInfo", select: "name email" } })
    .lean();

  let totalRevenue = 0;
  let totalQuantity = 0;
  const monthlySales = {};

  for (const order of orders) {
    const orderItem = order.products.find(
      (p) => p.productId.toString() === productId
    );
    if (!orderItem) continue;

    // Only count paid/confirmed deliveries as revenue (production sane)
    if (order.paymentStatus === "Paid") {
      const rev = orderItem.price * orderItem.quantity;
      totalRevenue += rev;
      totalQuantity += orderItem.quantity;

      const month = new Date(order.createdAt).toISOString().slice(0, 7);
      monthlySales[month] = (monthlySales[month] || 0) + rev;
    }
  }

  res.json({
    success: true,
    data: {
      product,
      analytics: {
        totalOrders: orders.length,
        totalRevenue,
        totalQuantity,
        averageOrderValue: orders.length ? totalRevenue / orders.length : 0,
        monthlySales: Object.entries(monthlySales)
          .map(([month, revenue]) => ({ month, revenue }))
          .sort((a, b) => b.month.localeCompare(a.month)),
      },
      orders,
    },
  });
});

/**
 * ✅ ADMIN: Update any product (superadmin)
 */
exports.updateProductForAdmin = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

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

  // regenerate slug if name changed
  if (req.body.name && req.body.name.trim() !== product.name) {
    product.slug = await Product.generateUniqueSlug(req.body.name, productId);
    product.name = req.body.name.trim();
  }

  await product.save();

  res.json({ success: true, message: "Product updated", data: product });
});

/**
 * ✅ ADMIN: Bulk update status/featured
 */
exports.bulkUpdateProductStatus = asyncHandler(async (req, res) => {
  const { productIds, isActive, isFeatured } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0)
    throw new ApiError(400, "productIds array required");

  const ids = productIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (ids.length !== productIds.length)
    throw new ApiError(400, "One or more invalid product IDs");

  const update = {};
  if (isActive !== undefined) update.isActive = !!isActive;
  if (isFeatured !== undefined) update.isFeatured = !!isFeatured;

  if (!Object.keys(update).length)
    throw new ApiError(400, "Provide isActive or isFeatured");

  const result = await Product.updateMany({ _id: { $in: ids } }, update);

  res.json({
    success: true,
    message: `Updated ${result.modifiedCount} products`,
    data: { modifiedCount: result.modifiedCount },
  });
});

/**
 * ✅ ADMIN: Delete product (HARD delete only if safe)
 * Recommended: use soft delete instead in production.
 */
exports.deleteProductForAdmin = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  const activeOrder = await Order.findOne({
    "products.productId": productId,
    status: { $in: ["Pending", "Confirmed", "Shipped"] },
  }).select("_id");

  if (activeOrder)
    throw new ApiError(400, "Cannot delete product with active orders");

  // soft delete (safe)
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  product.isActive = false;
  await product.save();

  res.json({ success: true, message: "Product deactivated" });
});

/**
 * ✅ ADMIN: Overall analytics (dashboard)
 */
exports.getProductAnalytics = asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const days = Number(period);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // top products (by revenue from orders)
  const topProducts = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate }, paymentStatus: "Paid" } },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.productId",
        totalSold: { $sum: "$products.quantity" },
        totalRevenue: {
          $sum: { $multiply: ["$products.price", "$products.quantity"] },
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productInfo",
      },
    },
    { $unwind: "$productInfo" },
    {
      $project: {
        productId: "$_id",
        name: "$productInfo.name",
        price: "$productInfo.price",
        totalSold: 1,
        totalRevenue: 1,
        viewCount: "$productInfo.viewCount",
      },
    },
  ]);

  // overall
  const overall = await Product.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: ["$isActive", 1, 0] } },
        featuredProducts: { $sum: { $cond: ["$isFeatured", 1, 0] } },
        lowStockProducts: {
          $sum: {
            $cond: [{ $lte: ["$quantity", "$lowStockThreshold"] }, 1, 0],
          },
        },
        totalInventoryValue: { $sum: { $multiply: ["$price", "$quantity"] } },
        avgPrice: { $avg: "$price" },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      summary: overall?.[0] || {},
      topProducts,
      periodDays: days,
    },
  });
});
