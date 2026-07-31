const mongoose = require("mongoose");
const Product = require("../../../Model/ProductsModel/product");
const Order = require("../../../Model/ProductsModel/orderSchema");
const Cart = require("../../../Model/ProductsModel/cart");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const { instance } = require("../../../Config/razerpay");

const {
  validateBuyNow,
  validateCartCheckout,
} = require("../../../validator/orderValidation");

const isDev = process.env.NODE_ENV !== "production";

/* ================= RAZORPAY ORDER CREATION ================= */
const createRazorpayOrder = async (amount, receipt, userId) => {
  if (isDev) return { id: `dev_order_${Date.now()}`, receipt };

  return await instance.orders.create({
    amount,
    currency: "INR",
    receipt,
    notes: { userId: String(userId) },
  });
};

/* =========================================================
   BUY NOW
========================================================= */
exports.buyNow = asyncHandler(async (req, res) => {
  const { error, value } = validateBuyNow(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const userId = req.user.id;
  const { productId, quantity, address } = value;

  // Block multiple pending orders
  const existing = await Order.exists({
    userId,
    paymentStatus: "Pending",
    status: "Pending",
  });

  if (existing)
    throw new ApiError(400, "Complete or cancel existing order first");

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, "Product unavailable");

  if (quantity > product.quantity)
    throw new ApiError(400, "Insufficient stock");

  const totalPrice = Number((product.price * quantity).toFixed(2));
  const receipt = `buy_${userId}_${Date.now()}`;

  const razorpayOrder = await createRazorpayOrder(
    Math.round(totalPrice * 100),
    receipt,
    userId
  );

  const order = await Order.create({
    userId,
    products: [
      {
        productId: product._id,
        quantity,
        price: product.price,
        nameSnapshot: product.name,
        imageSnapshot: product.productImages?.[0] || null,
      },
    ],
    totalPrice,
    address,
    status: "Pending",
    paymentStatus: "Pending",
    razorpayOrderId: razorpayOrder.id,
    razorpayReceipt: receipt,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  res.status(201).json({ success: true, orderId: order._id, razorpayOrder });
});

/* =========================================================
   CHECKOUT FROM CART
========================================================= */
exports.checkoutFromCart = asyncHandler(async (req, res) => {
  const { error, value } = validateCartCheckout(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const userId = req.user.id;
  const { address } = value;

  const existing = await Order.exists({
    userId,
    paymentStatus: "Pending",
    status: "Pending",
  });

  if (existing)
    throw new ApiError(400, "Complete or cancel existing order first");

  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0)
    throw new ApiError(400, "Cart empty");

  const products = [];
  let totalPrice = 0;

  for (const item of cart.items) {
    const p = item.product;

    if (!p || !p.isActive)
      throw new ApiError(400, `Unavailable: ${p?.name || "Item"}`);

    if (item.quantity > p.quantity)
      throw new ApiError(400, `Insufficient stock: ${p.name}`);

    products.push({
      productId: p._id,
      quantity: item.quantity,
      price: p.price,
      nameSnapshot: p.name,
      imageSnapshot: p.productImages?.[0] || null,
    });

    totalPrice += p.price * item.quantity;
  }

  totalPrice = Number(totalPrice.toFixed(2));

  const receipt = `cart_${userId}_${Date.now()}`;
  const razorpayOrder = await createRazorpayOrder(
    Math.round(totalPrice * 100),
    receipt,
    userId
  );

  const order = await Order.create({
    userId,
    products,
    totalPrice,
    address,
    status: "Pending",
    paymentStatus: "Pending",
    razorpayOrderId: razorpayOrder.id,
    razorpayReceipt: receipt,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  res.status(201).json({ success: true, orderId: order._id, razorpayOrder });
});

/* =========================================================
   MY ORDERS
========================================================= */
exports.getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .populate("products.productId", "name price productImages");

  res.json({ success: true, data: orders });
});

/* =========================================================
   INVOICE
========================================================= */
exports.getInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const order = await Order.findOne({ _id: orderId, userId: req.user.id })
    .populate("products.productId");

  if (!order) throw new ApiError(404, "Order not found");

  res.json({
    success: true,
    data: {
      invoiceId: `INV-${order._id}`,
      orderNumber: order.orderNumber,
      products: order.products.map((p) => ({
        name: p.nameSnapshot || p.productId?.name,
        quantity: p.quantity,
        pricePerItem: p.price,
        total: p.price * p.quantity,
      })),
      totalAmount: order.totalPrice,
      address: order.address,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      orderDate: order.createdAt,
    },
  });
});




/* =========================================================
   GET SINGLE ORDER (USER)
========================================================= */
exports.getSingleOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const order = await Order.findOne({
    _id: orderId,
    userId,
  })
    .populate("products.productId", "name price productImages")
    .lean();

  if (!order)
    throw new ApiError(404, "Order not found");

  res.status(200).json({
    success: true,
    data: order,
  });
});


/* =========================================================
   CANCEL ORDER (USER)
========================================================= */
exports.cancelOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw new ApiError(400, "Invalid orderId");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({
      _id: orderId,
      userId,
    }).session(session);

    if (!order)
      throw new ApiError(404, "Order not found");

    if (order.status === "Cancelled")
      throw new ApiError(400, "Order already cancelled");

    if (["Packed", "Shipped", "Delivered"].includes(order.status))
      throw new ApiError(
        400,
        `Order cannot be cancelled once it is ${order.status}`
      );

    // ===== RESTORE STOCK ONLY IF PAYMENT WAS SUCCESSFUL =====
    if (order.paymentStatus === "Paid") {
      for (const item of order.products) {
        await Product.updateOne(
          { _id: item.productId },
          {
            $inc: {
              quantity: item.quantity,
              saleCount: -item.quantity,
            },
          },
          { session }
        );
      }

      // Refund integration can be added here
      // await razorpay.payments.refund(...);

      order.paymentStatus="Paid"
    }

    order.status = "Cancelled";
    order.cancelledAt = new Date();
    order.cancelledBy = "User";

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});