// src/controllers/seller/seller.order.controller.js
const mongoose = require("mongoose");
const Order = require("../../../Model/ProductsModel/orderSchema");
const Product = require("../../../Model/ProductsModel/product");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");

/**
 * ✅ SELLER: List orders that contain seller's products
 * Query: page, limit, status, paymentStatus
 */
exports.listSellerOrders = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  const { page = 1, limit = 20, status, paymentStatus } = req.query;

  // seller product IDs
  const sellerProducts = await Product.find({ sellerId })
    .select("_id name productImages price")
    .lean();

  const productIdList = sellerProducts.map((p) => p._id);
  if (productIdList.length === 0) {
    return res.json({ success: true, data: [], pagination: { totalOrders: 0 } });
  }

  const query = {
    "products.productId": { $in: productIdList },
  };
  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate({
        path: "userId",
        select: "phone additionalInfo",
        populate: { path: "additionalInfo", select: "name email" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Order.countDocuments(query),
  ]);

  // shape response: keep only seller's products in each order
  const shaped = orders.map((order) => {
    const orderProductsForSeller = order.products
      .filter((p) =>
        productIdList.some((id) => id.toString() === p.productId.toString())
      )
      .map((p) => {
        const doc = sellerProducts.find(
          (sp) => sp._id.toString() === p.productId.toString()
        );

        return {
          productId: p.productId,
          name: p.nameSnapshot || doc?.name || "Product",
          price: p.price,
          quantity: p.quantity,
          image:
            p.imageSnapshot ||
            (Array.isArray(doc?.productImages) ? doc.productImages?.[0] : undefined),
        };
      });

    const totalAmount = orderProductsForSeller.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    return {
      _id: order._id,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
      customer: {
        name: order.userId?.additionalInfo?.name || "Customer",
        email: order.userId?.additionalInfo?.email || "",
        phone: order.userId?.phone || "",
      },
      products: orderProductsForSeller,
      totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      address: order.address,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  });

  res.json({
    success: true,
    data: shaped,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalOrders: total,
      limit: Number(limit),
    },
  });
});

/**
 * ✅ SELLER: Get one order details (only seller product portion)
 */
exports.getSellerOrderDetails = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const sellerProducts = await Product.find({ sellerId })
    .select("_id name productImages")
    .lean();

  const productIdStrList = sellerProducts.map((p) => p._id.toString());

  const order = await Order.findById(orderId)
    .populate({
      path: "userId",
      select: "phone additionalInfo",
      populate: { path: "additionalInfo", select: "name email" },
    })
    .lean();

  if (!order) throw new ApiError(404, "Order not found");

  // ensure order contains seller's product
  const contains = order.products.some((p) =>
    productIdStrList.includes(p.productId.toString())
  );
  if (!contains) throw new ApiError(403, "Not authorized for this order");

  const orderProductsForSeller = order.products
    .filter((p) => productIdStrList.includes(p.productId.toString()))
    .map((p) => {
      const doc = sellerProducts.find(
        (sp) => sp._id.toString() === p.productId.toString()
      );
      return {
        productId: p.productId,
        name: p.nameSnapshot || doc?.name || "Product",
        price: p.price,
        quantity: p.quantity,
        image:
          p.imageSnapshot ||
          (Array.isArray(doc?.productImages) ? doc.productImages?.[0] : undefined),
      };
    });

  const totalAmount = orderProductsForSeller.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  res.json({
    success: true,
    data: {
      _id: order._id,
      orderNumber: order.orderNumber,
      customer: {
        name: order.userId?.additionalInfo?.name || "Customer",
        email: order.userId?.additionalInfo?.email || "",
        phone: order.userId?.phone || "",
      },
      products: orderProductsForSeller,
      totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      address: order.address,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

/**
 * ✅ SELLER: Update order status (strict)
 * Allowed:
 *  Confirmed -> Shipped -> Delivered
 *  Confirmed -> Cancelled (optional)
 *
 * IMPORTANT:
 * Seller should NOT update Pending (payment not done yet).
 */
exports.updateSellerOrderStatus = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const { orderId } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const allowed = ["Confirmed", "Shipped", "Delivered", "Cancelled"];
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid status");

  // make sure seller has product in this order
  const sellerProducts = await Product.find({ sellerId }).select("_id").lean();
  const productIds = sellerProducts.map((p) => p._id);

  const order = await Order.findOne({
    _id: orderId,
    "products.productId": { $in: productIds },
  });

  if (!order) throw new ApiError(404, "Order not found/unauthorized");

  // ✅ transition machine
  const transitions = {
    Pending: [], // seller cannot touch
    Confirmed: ["Shipped", "Cancelled"],
    Shipped: ["Delivered"],
    Delivered: [],
    Cancelled: [],
  };

  const possible = transitions[order.status] || [];
  if (!possible.includes(status)) {
    throw new ApiError(400, `Invalid transition: ${order.status} -> ${status}`);
  }

  // extra safety: can't ship unless paid
  if (["Shipped", "Delivered"].includes(status) && order.paymentStatus !== "Paid") {
    throw new ApiError(400, "Cannot ship/deliver unpaid order");
  }

  order.status = status;
  await order.save();

  res.json({ success: true, message: "Order status updated", data: order });
});
