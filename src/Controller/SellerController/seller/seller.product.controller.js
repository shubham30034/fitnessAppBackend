const mongoose = require("mongoose");
const Product = require("../../../Model/ProductsModel/product");
const Category = require("../../../Model/ProductsModel/category");
const SubCategory = require("../../../Model/ProductsModel/subCategory");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");

/* =========================
   Helpers
========================= */
const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toBool = (v) => {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return null;
};

const DEFAULT_ANALYTICS = {
  totalProducts: 0,
  activeProducts: 0,
  inactiveProducts: 0,
  totalViews: 0,
  totalSales: 0,
  avgRating: 0,
  lowStockProducts: 0,
  totalInventoryValue: 0,
};

/* =========================================================
   ✅ SELLER: LIST OWN PRODUCTS
========================================================= */
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
    analytics = "false",
  } = req.query;

  const safeLimit = Math.min(Number(limit), 50);
  const skip = (Number(page) - 1) * safeLimit;

  const baseQuery = { sellerId };

  /* ===== Search ===== */
  if (search) {
    const safeSearch = escapeRegex(String(search).slice(0, 50));
    baseQuery.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { brand: { $regex: safeSearch, $options: "i" } },
    ];
  }

  /* ===== Category Filter ===== */
  if (category) {
    if (mongoose.Types.ObjectId.isValid(category)) {
      baseQuery.category = category;
    } else {
      const safeCat = escapeRegex(String(category).slice(0, 50));
      const cat = await Category.findOne({
        $or: [{ name: { $regex: safeCat, $options: "i" } }, { slug: safeCat }],
      }).select("_id");
      if (cat) baseQuery.category = cat._id;
    }
  }

  /* ===== Subcategory Filter ===== */
  if (subcategory) {
    if (mongoose.Types.ObjectId.isValid(subcategory)) {
      baseQuery.subcategory = subcategory;
    } else {
      const safeSub = escapeRegex(String(subcategory).slice(0, 50));
      const sub = await SubCategory.findOne({
        $or: [{ name: { $regex: safeSub, $options: "i" } }, { slug: safeSub }],
      }).select("_id");
      if (sub) baseQuery.subcategory = sub._id;
    }
  }

  if (status === "active") baseQuery.isActive = true;
  if (status === "inactive") baseQuery.isActive = false;

  /* ===== Safe Sort ===== */
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

  const finalSortBy = allowedSortFields.includes(sortBy)
    ? sortBy
    : "createdAt";

  const sort = { [finalSortBy]: sortOrder === "asc" ? 1 : -1 };

  /* ===== Products + Count ===== */
  const [products, total] = await Promise.all([
    Product.find(baseQuery)
      .select("name price quantity isActive viewCount saleCount category subcategory")
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Product.countDocuments(baseQuery),
  ]);

  /* ===== Analytics (Aligned with Filters) ===== */
  let analyticsData = null;
  if (analytics === "true") {
    const matchStage = { ...baseQuery, sellerId: new mongoose.Types.ObjectId(sellerId) };

    const analyticsAgg = await Product.aggregate([
      { $match: matchStage },
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
            $sum: { $cond: [{ $lte: ["$quantity", "$lowStockThreshold"] }, 1, 0] },
          },
          totalInventoryValue: {
            $sum: { $multiply: ["$price", "$quantity"] },
          },
        },
      },
    ]);

    analyticsData = analyticsAgg?.[0] || DEFAULT_ANALYTICS;
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
   ✅ SELLER: UPDATE PRODUCT STATUS
========================================================= */
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

  if (isActive !== undefined) {
    const val = toBool(isActive);
    if (val === null) throw new ApiError(400, "isActive must be boolean");
    product.isActive = val;
  }

  if (isFeatured !== undefined) {
    const val = toBool(isFeatured);
    if (val === null) throw new ApiError(400, "isFeatured must be boolean");
    product.isFeatured = val;
  }

  await product.save();

  res.json({
    success: true,
    message: "Product status updated",
    data: {
      productId,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
    },
  });
});


/* =========================================================
   ✅ SELLER: GET SINGLE PRODUCT
========================================================= */
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




exports.getSellerDashboard = asyncHandler(async (req, res) => {
  const sellerId = new mongoose.Types.ObjectId(req.user.id);

  const sellerProducts = await Product.find(
    { sellerId },
    "_id saleCount"
  ).lean();

  const productIds = sellerProducts.map((p) => p._id);

  /* ================= PRODUCTS ================= */

  const productStats = await Product.aggregate([
    {
      $match: {
        sellerId,
      },
    },
    {
      $group: {
        _id: null,

        totalProducts: {
          $sum: 1,
        },

        activeProducts: {
          $sum: {
            $cond: ["$isActive", 1, 0],
          },
        },

        inactiveProducts: {
          $sum: {
            $cond: ["$isActive", 0, 1],
          },
        },

        lowStockProducts: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gt: ["$quantity", 0],
                  },
                  {
                    $lte: [
                      "$quantity",
                      "$lowStockThreshold",
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },

        outOfStockProducts: {
          $sum: {
            $cond: [
              {
                $eq: ["$quantity", 0],
              },
              1,
              0,
            ],
          },
        },

        totalViews: {
          $sum: {
            $ifNull: ["$viewCount", 0],
          },
        },

        averageRating: {
          $avg: {
            $ifNull: ["$averageRating", 0],
          },
        },
      },
    },
  ]);

  /* ================= ORDERS ================= */

  const orderStats = await Order.aggregate([
    {
      $match: {
        "products.productId": {
          $in: productIds,
        },
      },
    },

    {
      $unwind: "$products",
    },

    {
      $match: {
        "products.productId": {
          $in: productIds,
        },
      },
    },

    {
      $group: {
        _id: null,

        totalOrders: {
          $addToSet: "$_id",
        },

        pending: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "Pending"],
              },
              1,
              0,
            ],
          },
        },

        confirmed: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "Confirmed"],
              },
              1,
              0,
            ],
          },
        },

        shipped: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "Shipped"],
              },
              1,
              0,
            ],
          },
        },

        delivered: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "Delivered"],
              },
              1,
              0,
            ],
          },
        },

        cancelled: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "Cancelled"],
              },
              1,
              0,
            ],
          },
        },

        totalRevenue: {
          $sum: {
            $multiply: [
              "$products.price",
              "$products.quantity",
            ],
          },
        },

        totalSales: {
          $sum: "$products.quantity",
        },
      },
    },
  ]);

  /* ================= TOP PRODUCT ================= */

  const topSellingProduct = await Product.findOne({
    sellerId,
  })
    .sort({ saleCount: -1 })
    .select("name saleCount")
    .lean();

  const p = productStats[0] || {};

  const o = orderStats[0] || {};

  res.json({
    success: true,

    data: {
      overview: {
        totalProducts: p.totalProducts || 0,
        activeProducts: p.activeProducts || 0,
        inactiveProducts: p.inactiveProducts || 0,
        lowStockProducts: p.lowStockProducts || 0,
        outOfStockProducts: p.outOfStockProducts || 0,
      },

      orders: {
        totalOrders: o.totalOrders
          ? o.totalOrders.length
          : 0,

        pending: o.pending || 0,

        confirmed: o.confirmed || 0,

        shipped: o.shipped || 0,

        delivered: o.delivered || 0,

        cancelled: o.cancelled || 0,
      },

      sales: {
        totalRevenue: o.totalRevenue || 0,

        totalSales: o.totalSales || 0,
      },

      performance: {
        totalViews: p.totalViews || 0,

        averageRating:
          Number((p.averageRating || 0).toFixed(1)),

        topSellingProduct,
      },
    },
  });
});




exports.getLowStockProducts = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  const {
    page = 1,
    limit = 10,
    threshold,
    search,
    sortBy = "quantity",
    sortOrder = "asc",
  } = req.query;

  const safeLimit = Math.min(Number(limit), 50);
  const skip = (Number(page) - 1) * safeLimit;

  const query = {
    sellerId,
    isDeleted: false,
    quantity: { $gt: 0 },
  };

  if (search) {
    const safeSearch = String(search)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .slice(0, 50);

    query.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { brand: { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (threshold) {
    query.quantity = {
      $lte: Number(threshold),
      $gt: 0,
    };
  } else {
    query.$expr = {
      $and: [
        {
          $gt: ["$quantity", 0],
        },
        {
          $lte: [
            "$quantity",
            "$lowStockThreshold",
          ],
        },
      ],
    };
  }

  const allowedSort = [
    "quantity",
    "price",
    "name",
    "createdAt",
    "updatedAt",
  ];

  const finalSort = allowedSort.includes(sortBy)
    ? sortBy
    : "quantity";

  const sort = {
    [finalSort]: sortOrder === "desc" ? -1 : 1,
  };

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    Product.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    message: "Low stock products fetched successfully.",

    data: {
      products,

      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / safeLimit),
        totalProducts: total,
        limit: safeLimit,
      },
    },
  });
});




exports.getOutOfStockProducts = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  const {
    page = 1,
    limit = 10,
    search,
    sortBy = "updatedAt",
    sortOrder = "desc",
  } = req.query;

  const safeLimit = Math.min(Number(limit), 50);
  const skip = (Number(page) - 1) * safeLimit;

  const query = {
    sellerId,
    isDeleted: false,
    quantity: 0,
  };

  /* ===== Search ===== */

  if (search) {
    const safeSearch = String(search)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .slice(0, 50);

    query.$or = [
      {
        name: {
          $regex: safeSearch,
          $options: "i",
        },
      },
      {
        brand: {
          $regex: safeSearch,
          $options: "i",
        },
      },
    ];
  }

  /* ===== Safe Sorting ===== */

  const allowedSortFields = [
    "name",
    "price",
    "createdAt",
    "updatedAt",
    "saleCount",
    "viewCount",
  ];

  const finalSort = allowedSortFields.includes(sortBy)
    ? sortBy
    : "updatedAt";

  const sort = {
    [finalSort]: sortOrder === "asc" ? 1 : -1,
  };

  /* ===== Query ===== */

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    Product.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    message: "Out of stock products fetched successfully.",

    data: {
      products,

      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / safeLimit),
        totalProducts: total,
        limit: safeLimit,
      },
    },
  });
});







exports.getRevenueReport = asyncHandler(async (req, res) => {
  const sellerId = new mongoose.Types.ObjectId(req.user.id);

  const {
    range = "month",
    from,
    to,
  } = req.query;

  const { start, end } = getDateRange(range, from, to);

  /* ===========================
      Seller Products
  =========================== */

  const sellerProducts = await Product.find(
    { sellerId },
    "_id"
  ).lean();

  const productIds = sellerProducts.map(
    (p) => p._id
  );

  if (!productIds.length) {
    return res.status(200).json({
      success: true,
      data: {
        range,
        startDate: start,
        endDate: end,
        revenue: 0,
        totalOrders: 0,
        totalUnitsSold: 0,
        averageOrderValue: 0,
        dailyRevenue: [],
      },
    });
  }

  /* ===========================
      Revenue
  =========================== */

  const revenueData = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lte: end,
        },

        "products.productId": {
          $in: productIds,
        },
      },
    },

    {
      $unwind: "$products",
    },

    {
      $match: {
        "products.productId": {
          $in: productIds,
        },
      },
    },

    {
      $group: {
        _id: "$_id",

        revenue: {
          $sum: {
            $multiply: [
              "$products.price",
              "$products.quantity",
            ],
          },
        },

        quantity: {
          $sum: "$products.quantity",
        },
      },
    },

    {
      $group: {
        _id: null,

        totalRevenue: {
          $sum: "$revenue",
        },

        totalOrders: {
          $sum: 1,
        },

        totalUnitsSold: {
          $sum: "$quantity",
        },
      },
    },
  ]);

  const stats = revenueData[0] || {};

  const totalRevenue =
    stats.totalRevenue || 0;

  const totalOrders =
    stats.totalOrders || 0;

  const totalUnitsSold =
    stats.totalUnitsSold || 0;

  const averageOrderValue =
    totalOrders === 0
      ? 0
      : Number(
          (
            totalRevenue /
            totalOrders
          ).toFixed(2)
        );

  /* ===========================
      Daily Revenue Graph
  =========================== */

  const dailyRevenue =
    await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },

          "products.productId": {
            $in: productIds,
          },
        },
      },

      {
        $unwind: "$products",
      },

      {
        $match: {
          "products.productId": {
            $in: productIds,
          },
        },
      },

      {
        $group: {
          _id: {
            year: {
              $year: "$createdAt",
            },

            month: {
              $month: "$createdAt",
            },

            day: {
              $dayOfMonth:
                "$createdAt",
            },
          },

          revenue: {
            $sum: {
              $multiply: [
                "$products.price",
                "$products.quantity",
              ],
            },
          },
        },
      },

      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
    ]);
      /* ===========================
      Previous Period
  =========================== */

  const duration = end.getTime() - start.getTime();

  const previousStart = new Date(
    start.getTime() - duration
  );

  const previousEnd = new Date(
    start.getTime() - 1
  );

  const previousRevenueData =
    await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousStart,
            $lte: previousEnd,
          },

          "products.productId": {
            $in: productIds,
          },
        },
      },

      {
        $unwind: "$products",
      },

      {
        $match: {
          "products.productId": {
            $in: productIds,
          },
        },
      },

      {
        $group: {
          _id: "$_id",

          revenue: {
            $sum: {
              $multiply: [
                "$products.price",
                "$products.quantity",
              ],
            },
          },
        },
      },

      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: "$revenue",
          },
        },
      },
    ]);

  const previousRevenue =
    previousRevenueData[0]
      ?.totalRevenue || 0;

  const revenueGrowth =
    previousRevenue === 0
      ? totalRevenue > 0
        ? 100
        : 0
      : Number(
          (
            ((totalRevenue -
              previousRevenue) /
              previousRevenue) *
            100
          ).toFixed(2)
        );

  /* ===========================
      Response
  =========================== */

  res.status(200).json({
    success: true,

    data: {
      range,

      startDate: start,

      endDate: end,

      revenue: totalRevenue,

      totalOrders,

      totalUnitsSold,

      averageOrderValue,

      previousRevenue,

      revenueGrowth,

      dailyRevenue: dailyRevenue.map(
        (item) => ({
          date: `${item._id.year}-${String(
            item._id.month
          ).padStart(2, "0")}-${String(
            item._id.day
          ).padStart(2, "0")}`,

          revenue: item.revenue,
        })
      ),
    },
  });
});





exports.exportSalesReport = asyncHandler(async (req, res) => {
  const sellerId = new mongoose.Types.ObjectId(req.user.id);

  const {
    format = "excel",
    range = "month",
    from,
    to,
  } = req.query;

  /* ===========================
        Date Range
  =========================== */

  const { start, end } = getDateRange(range, from, to);

  /* ===========================
        Seller Products
  =========================== */

  const sellerProducts = await Product.find(
    { sellerId },
    "_id name"
  ).lean();

  const productIds = sellerProducts.map((p) => p._id);

  if (!productIds.length) {
    throw new ApiError(404, "No products found.");
  }

  /* ===========================
        Orders
  =========================== */

  const orders = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lte: end,
        },
        "products.productId": {
          $in: productIds,
        },
      },
    },
    {
      $unwind: "$products",
    },
    {
      $match: {
        "products.productId": {
          $in: productIds,
        },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "products.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $unwind: "$product",
    },
    {
      $project: {
        orderNumber: 1,
        status: 1,
        paymentStatus: 1,
        createdAt: 1,
        productName: "$product.name",
        price: "$products.price",
        quantity: "$products.quantity",
        total: {
          $multiply: ["$products.price", "$products.quantity"],
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  /* ===========================
        Summary
  =========================== */

  const uniqueOrderIds = new Set();
  let totalRevenue = 0;
  let totalQuantity = 0;

  orders.forEach((item) => {
    uniqueOrderIds.add(item.orderNumber); // or item._id if orderNumber is not unique
    totalRevenue += item.total;
    totalQuantity += item.quantity;
  });

  const summary = {
    totalOrders: uniqueOrderIds.size,
    totalRevenue,
    totalQuantity,
  };

  /* ===========================
        Export Switch
  =========================== */

  switch (format.toLowerCase()) {
    /* =====================================================
       EXCEL
    ===================================================== */
    case "excel": {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "E-Commerce Backend";
      workbook.company = "Seller Panel";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Sales Report");

      // Title
      worksheet.mergeCells("A1:H1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "SALES REPORT";
      titleCell.font = { bold: true, size: 18 };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      // Summary
      worksheet.addRow([]);
      worksheet.addRow(["Report Range", range.toUpperCase()]);
      worksheet.addRow(["Start Date", start.toLocaleDateString()]);
      worksheet.addRow(["End Date", end.toLocaleDateString()]);
      worksheet.addRow(["Total Orders", summary.totalOrders]);
      worksheet.addRow(["Total Quantity", summary.totalQuantity]);
      worksheet.addRow(["Total Revenue", summary.totalRevenue]);
      worksheet.addRow([]);

      // Table Header
      const header = worksheet.addRow([
        "Order Number",
        "Product",
        "Price",
        "Quantity",
        "Total",
        "Order Status",
        "Payment",
        "Order Date",
      ]);

      header.font = { bold: true };
      header.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9EAD3" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" },
        };
      });

      // Rows
      orders.forEach((item) => {
        worksheet.addRow([
          item.orderNumber,
          item.productName,
          item.price,
          item.quantity,
          item.total,
          item.status,
          item.paymentStatus,
          new Date(item.createdAt).toLocaleString(),
        ]);
      });

      // Auto width
      worksheet.columns.forEach((column) => {
        let max = 12;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const value = cell.value ? cell.value.toString() : "";
          if (value.length > max) max = value.length;
        });
        column.width = Math.min(max + 3, 40);
      });

      // Download
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Sales_Report_${Date.now()}.xlsx`
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    /* =====================================================
       CSV
    ===================================================== */
    case "csv": {
      const headers = [
        "Order Number",
        "Product",
        "Price",
        "Quantity",
        "Total",
        "Order Status",
        "Payment Status",
        "Order Date",
      ];

      const rows = orders.map((item) => [
        item.orderNumber,
        `"${(item.productName || "").replace(/"/g, '""')}"`,
        item.price,
        item.quantity,
        item.total,
        item.status,
        item.paymentStatus,
        new Date(item.createdAt).toLocaleString(),
      ]);

      const summaryRows = [
        ["Report Summary"],
        ["Range", range],
        ["Start Date", start.toLocaleDateString()],
        ["End Date", end.toLocaleDateString()],
        ["Total Orders", summary.totalOrders],
        ["Total Quantity", summary.totalQuantity],
        ["Total Revenue", summary.totalRevenue],
        [],
      ];

      const csvContent = [
        summaryRows.map((r) => r.join(",")).join("\n"),
        headers.join(","),
        rows.map((r) => r.join(",")).join("\n"),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Sales_Report_${Date.now()}.csv`
      );

      return res.status(200).send(csvContent);
    }

    /* =====================================================
       PDF
    ===================================================== */
    case "pdf": {
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Sales_Report_${Date.now()}.pdf`
      );

      doc.pipe(res);

      // Title
      doc.fontSize(22).text("Sales Report", { align: "center" });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Range : ${range.toUpperCase()}`);
      doc.text(`Start : ${start.toLocaleDateString()}`);
      doc.text(`End : ${end.toLocaleDateString()}`);
      doc.moveDown();

      // Summary
      doc.fontSize(16).text("Summary");
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Total Orders : ${summary.totalOrders}`);
      doc.text(`Total Quantity : ${summary.totalQuantity}`);
      doc.text(`Total Revenue : ₹${summary.totalRevenue}`);
      doc.moveDown();

      // Orders
      doc.fontSize(15).text("Orders");
      doc.moveDown(0.5);

      orders.forEach((item, index) => {
        doc.fontSize(11).text(`${index + 1}. ${item.productName}`);
        doc.text(`Order     : ${item.orderNumber}`);
        doc.text(`Price     : ₹${item.price}`);
        doc.text(`Quantity  : ${item.quantity}`);
        doc.text(`Total     : ₹${item.total}`);
        doc.text(`Status    : ${item.status}`);
        doc.text(`Payment   : ${item.paymentStatus}`);
        doc.text(
          `Date      : ${new Date(item.createdAt).toLocaleString()}`
        );
        doc.moveDown();

        if (doc.y > 730) {
          doc.addPage();
        }
      });

      // Footer
      doc.moveDown();
      doc
        .fontSize(10)
        .text(`Generated On : ${new Date().toLocaleString()}`, {
          align: "right",
        });

      doc.end();
      return;
    }

    default:
      throw new ApiError(400, "Supported formats: excel, csv, pdf");
  }
});



/* =========================================================
   Helpers
========================================================= */

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getDateRange = (range, from, to) => {
  const now = new Date();

  switch (range) {
    case "today":
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };

    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return {
        start: startOfDay(start),
        end: endOfDay(now),
      };
    }

    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start,
        end: endOfDay(now),
      };
    }

    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return {
        start,
        end: endOfDay(now),
      };
    }

    case "custom": {
      if (!from || !to) {
        throw new ApiError(400, "from and to dates are required");
      }
      return {
        start: startOfDay(new Date(from)),
        end: endOfDay(new Date(to)),
      };
    }

    default:
      return {
        start: new Date(0),
        end: endOfDay(now),
      };
  }
};

/* =========================================================
   SELLER ANALYTICS
========================================================= */

exports.getSellerAnalytics = asyncHandler(async (req, res) => {
  const sellerId = new mongoose.Types.ObjectId(req.user.id);

  const { range = "month", from, to } = req.query;

  const { start, end } = getDateRange(range, from, to);

  /* ============================================
     Seller Products
  ============================================ */

  const sellerProducts = await Product.find(
    { sellerId },
    "_id name saleCount viewCount averageRating"
  ).lean();

  const productIds = sellerProducts.map((p) => p._id);

  if (!productIds.length) {
    return res.json({
      success: true,
      data: {
        range,
        startDate: start,
        endDate: end,
        overview: {
          totalRevenue: 0,
          totalOrders: 0,
          totalUnitsSold: 0,
          averageOrderValue: 0,
        },
        growth: {
          revenue: 0,
          orders: 0,
          unitsSold: 0,
        },
        orderStatus: {
          Pending: 0,
          Confirmed: 0,
          Shipped: 0,
          Delivered: 0,
          Cancelled: 0,
        },
        topProducts: [],
        revenueTrend: [],
      },
    });
  }

  /* ============================================
     Common Match Stage
  ============================================ */

  const matchStage = {
    createdAt: {
      $gte: start,
      $lte: end,
    },
    "products.productId": {
      $in: productIds,
    },
  };

  /* ============================================
     Revenue + Orders Aggregation
  ============================================ */

  const analytics = await Order.aggregate([
    { $match: matchStage },
    { $unwind: "$products" },
    {
      $match: {
        "products.productId": { $in: productIds },
      },
    },
    {
      $group: {
        _id: "$_id", // group by order first → unique orders
        revenue: {
          $sum: {
            $multiply: ["$products.price", "$products.quantity"],
          },
        },
        unitsSold: { $sum: "$products.quantity" },
        status: { $first: "$status" },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$revenue" },
        totalOrders: { $sum: 1 },
        totalUnitsSold: { $sum: "$unitsSold" },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
        },
        confirmedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "Confirmed"] }, 1, 0] },
        },
        shippedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "Shipped"] }, 1, 0] },
        },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] },
        },
      },
    },
  ]);

  const stats = analytics[0] || {};

  const totalRevenue = stats.totalRevenue || 0;
  const totalOrders = stats.totalOrders || 0;
  const totalUnitsSold = stats.totalUnitsSold || 0;

  const averageOrderValue =
    totalOrders === 0
      ? 0
      : Number((totalRevenue / totalOrders).toFixed(2));

  /* ============================================
     Revenue Trend
  ============================================ */

  const revenueTrend = await Order.aggregate([
    { $match: matchStage },
    { $unwind: "$products" },
    {
      $match: {
        "products.productId": { $in: productIds },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        revenue: {
          $sum: {
            $multiply: ["$products.price", "$products.quantity"],
          },
        },
        orders: { $addToSet: "$_id" },
        unitsSold: { $sum: "$products.quantity" },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
        "_id.day": 1,
      },
    },
  ]).then((rows) =>
    rows.map((r) => ({
      date: `${r._id.year}-${String(r._id.month).padStart(2, "0")}-${String(
        r._id.day
      ).padStart(2, "0")}`,
      revenue: r.revenue,
      orders: r.orders.length,
      unitsSold: r.unitsSold,
    }))
  );

  /* ============================================
     Top Selling Products (all-time by saleCount)
  ============================================ */

  const topProducts = await Product.find({ sellerId })
    .sort({ saleCount: -1 })
    .limit(10)
    .select("name saleCount viewCount averageRating price")
    .lean();

  /* ============================================
     Previous Period Comparison
  ============================================ */

  const duration = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - duration);
  const previousEnd = new Date(start.getTime() - 1);

  const previousAnalytics = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: previousStart,
          $lte: previousEnd,
        },
        "products.productId": { $in: productIds },
      },
    },
    { $unwind: "$products" },
    {
      $match: {
        "products.productId": { $in: productIds },
      },
    },
    {
      $group: {
        _id: "$_id",
        revenue: {
          $sum: {
            $multiply: ["$products.price", "$products.quantity"],
          },
        },
        unitsSold: { $sum: "$products.quantity" },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$revenue" },
        orders: { $sum: 1 },
        unitsSold: { $sum: "$unitsSold" },
      },
    },
  ]);

  const previous = previousAnalytics[0] || {};
  const previousRevenue = previous.revenue || 0;
  const previousOrders = previous.orders || 0;
  const previousUnits = previous.unitsSold || 0;

  const calculateGrowth = (current, previous) => {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(2));
  };

  /* ============================================
     Final Response
  ============================================ */

  res.status(200).json({
    success: true,
    data: {
      range,
      startDate: start,
      endDate: end,
      overview: {
        totalRevenue,
        totalOrders,
        totalUnitsSold,
        averageOrderValue,
      },
      growth: {
        revenue: calculateGrowth(totalRevenue, previousRevenue),
        orders: calculateGrowth(totalOrders, previousOrders),
        unitsSold: calculateGrowth(totalUnitsSold, previousUnits),
      },
      orderStatus: {
        Pending: stats.pendingOrders || 0,
        Confirmed: stats.confirmedOrders || 0,
        Shipped: stats.shippedOrders || 0,
        Delivered: stats.deliveredOrders || 0,
        Cancelled: stats.cancelledOrders || 0,
      },
      topProducts,
      revenueTrend,
    },
  });
});