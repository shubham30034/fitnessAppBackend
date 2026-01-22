// controllers/admin/admin.order.controller.js
const mongoose = require("mongoose");
const Order = require("../../../Model/ProductsModel/orderSchema");
const Product = require("../../../Model/ProductsModel/product");

const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
/**
 * ✅ ADMIN: Get all orders
 * Query:
 *  page, limit, search(orderNumber), userId, status, paymentStatus,
 *  fromDate, toDate, sortBy, sortOrder
 */
exports.getAllOrdersForAdmin = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    userId,
    status,
    paymentStatus,
    fromDate,
    toDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query = {};

  if (search) {
    query.orderNumber = { $regex: search, $options: "i" };
  }

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId))
      throw new ApiError(400, "Invalid userId");
    query.userId = userId;
  }

  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) query.createdAt.$lte = new Date(toDate);
  }

  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate({
        path: "userId",
        select: "phone additionalInfo role",
        populate: { path: "additionalInfo", select: "name email" },
      })
      .populate("products.productId", "name price productImages sellerId")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Order.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalOrders: total,
        limit: Number(limit),
      },
    },
  });
});

/**
 * ✅ ADMIN: Get order details
 */
exports.getOrderDetailsForAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const order = await Order.findById(orderId)
    .populate({
      path: "userId",
      select: "phone additionalInfo role",
      populate: { path: "additionalInfo", select: "name email" },
    })
    .populate("products.productId", "name price productImages sellerId category subcategory")
    .lean();

  if (!order) throw new ApiError(404, "Order not found");

  res.json({ success: true, data: order });
});

/**
 * ✅ ADMIN: Update order status
 * Allowed:
 * Pending -> Confirmed -> Shipped -> Delivered
 * Pending/Confirmed -> Cancelled
 */
exports.updateOrderStatusForAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const allowed = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid status");

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  // ✅ status machine validation
  const validTransitions = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Shipped", "Cancelled"],
    Shipped: ["Delivered"],
    Delivered: [],
    Cancelled: [],
  };

  const possible = validTransitions[order.status] || [];
  if (!possible.includes(status)) {
    throw new ApiError(
      400,
      `Invalid transition: ${order.status} -> ${status}`
    );
  }

  order.status = status;
  await order.save();

  res.json({ success: true, message: "Order status updated", data: order });
});

/**
 * ✅ ADMIN: Cancel order (refund not handled here)
 * If payment paid and order already confirmed -> cancel + restore stock (optional)
 */
exports.cancelOrderForAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { restoreStock = true } = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.status === "Delivered") {
    throw new ApiError(400, "Delivered order cannot be cancelled");
  }

  // already cancelled -> idempotent
  if (order.status === "Cancelled") {
    return res.json({ success: true, message: "Already cancelled", data: order });
  }

  // restore stock if paid/confirmed/shipped and restoreStock true
  if (restoreStock && order.paymentStatus === "Paid") {
    for (const item of order.products) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { quantity: item.quantity } }
      );
    }
  }

  order.status = "Cancelled";
  order.paymentStatus =
    order.paymentStatus === "Paid" ? "Paid" : order.paymentStatus;

  await order.save();

  res.json({ success: true, message: "Order cancelled", data: order });
});

/**
 * ✅ ADMIN: Orders Analytics (dashboard)
 */
exports.getOrderAnalyticsForAdmin = asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const days = Number(period);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const summary = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, 1, 0] } },
        pendingPayments: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, 1, 0] } },
        failedPayments: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Failed"] }, 1, 0] } },

        delivered: { $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0] } },
        shipped: { $sum: { $cond: [{ $eq: ["$status", "Shipped"] }, 1, 0] } },
        confirmed: { $sum: { $cond: [{ $eq: ["$status", "Confirmed"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } },

        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$totalPrice", 0],
          },
        },
        avgOrderValue: {
          $avg: {
            $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$totalPrice", null],
          },
        },
      },
    },
  ]);

  // monthly revenue trend (YYYY-MM)
  const monthly = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate }, paymentStatus: "Paid" } },
    {
      $group: {
        _id: { $substr: [{ $toString: "$createdAt" }, 0, 7] },
        revenue: { $sum: "$totalPrice" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    success: true,
    data: {
      periodDays: days,
      summary: summary?.[0] || {},
      monthly: monthly.map((m) => ({
        month: m._id,
        revenue: m.revenue,
        orders: m.orders,
      })),
    },
  });
});
