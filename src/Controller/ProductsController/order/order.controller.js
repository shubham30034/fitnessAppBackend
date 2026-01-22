const Product = require("../../../Model/ProductsModel/product");
const Order = require("../../../Model/ProductsModel/orderSchema");
const Cart = require("../../../Model/ProductsModel/cart");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const { instance } = require("../../../Config/razerpay");

exports.buyNow = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity = 1, address } = req.body;

  if (!address) throw new ApiError(400, "Address required");

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, "Product not available");

  if (quantity > product.quantity) throw new ApiError(400, "Insufficient stock");

  const totalPrice = product.price * quantity;

  const razorpayOrder = await instance.orders.create({
    amount: totalPrice * 100,
    currency: "INR",
    receipt: `buy_now_${Date.now()}`,
    notes: { userId }
  });

  const order = await Order.create({
    userId,
    products: [{
      productId: product._id,
      quantity,
      price: product.price,
      nameSnapshot: product.name,
      imageSnapshot: product.productImages?.[0]
    }],
    totalPrice,
    address,
    status: "Pending",
    paymentStatus: "Pending",
    razorpayOrderId: razorpayOrder.id,
    razorpayReceipt: razorpayOrder.receipt
  });

  res.status(201).json({ success: true, order, razorpayOrder });
});

exports.checkoutFromCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { address } = req.body;
  if (!address) throw new ApiError(400, "Address required");

  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) throw new ApiError(400, "Cart is empty");

  const products = [];
  let totalPrice = 0;

  for (const item of cart.items) {
    const p = item.product;
    if (!p || !p.isActive) throw new ApiError(400, `Product unavailable: ${p?.name}`);
    if (item.quantity > p.quantity) throw new ApiError(400, `Insufficient stock: ${p.name}`);

    products.push({
      productId: p._id,
      quantity: item.quantity,
      price: p.price,
      nameSnapshot: p.name,
      imageSnapshot: p.productImages?.[0]
    });

    totalPrice += p.price * item.quantity;
  }

  const razorpayOrder = await instance.orders.create({
    amount: totalPrice * 100,
    currency: "INR",
    receipt: `cart_${Date.now()}`,
    notes: { userId }
  });

  const order = await Order.create({
    userId,
    products,
    totalPrice,
    address,
    status: "Pending",
    paymentStatus: "Pending",
    razorpayOrderId: razorpayOrder.id,
    razorpayReceipt: razorpayOrder.receipt
  });

  // clear cart AFTER order created
  cart.items = [];
  await cart.save();

  res.status(201).json({ success: true, order, razorpayOrder });
});

exports.getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const orders = await Order.find({ userId })
    .sort({ createdAt: -1 })
    .populate("products.productId", "name price productImages");

  res.json({ success: true, data: orders });
});

exports.getInvoice = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  const order = await Order.findOne({ _id: orderId, userId }).populate("products.productId");
  if (!order) throw new ApiError(404, "Order not found");

  const invoice = {
    invoiceId: `INV-${order._id}`,
    orderNumber: order.orderNumber,
    products: order.products.map(p => ({
      name: p.nameSnapshot || p.productId?.name,
      quantity: p.quantity,
      pricePerItem: p.price,
      total: p.price * p.quantity
    })),
    totalAmount: order.totalPrice,
    address: order.address,
    paymentStatus: order.paymentStatus,
    orderStatus: order.status,
    orderDate: order.createdAt
  };

  res.json({ success: true, data: invoice });
});
