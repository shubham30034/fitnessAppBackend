const Product = require('../../Model/ProductsModel/product');
const Order = require('../../Model/ProductsModel/orderSchema');
const Cart = require('../../Model/ProductsModel/cart');
const { instance } = require("../../Config/razerpay");
const crypto = require("crypto");
const { buyProductValidation } = require("../../validator/productValidation");

// ✅ 1. Buy Now (Direct)
exports.buyProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity, address } = req.body;

    const { error } = buyProductValidation({ productId, quantity, address });
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: "Product not available" });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ success: false, message: "Insufficient stock" });
    }

    const amount = product.price * quantity;

    const razorpayOrder = await instance.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `buy_now_${Date.now()}`,
      notes: { userId, productId }
    });

    const newOrder = await Order.create({
      userId,
      products: [{ productId, quantity, price: product.price }],
      totalPrice: amount,
      address,
      status: "Pending",
      paymentStatus: "Pending",
      razorpayOrderId: razorpayOrder.id,
      razorpayReceipt: razorpayOrder.receipt
    });

    res.status(201).json({
      success: true,
      message: "Buy now order created",
      order: newOrder,
      razorpayOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ✅ 2. Checkout from Cart
exports.checkoutFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, message: "Address is required" });
    }

    // Load user's cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const products = [];
    let totalPrice = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      if (!product || !product.isActive || product.quantity < cartItem.quantity) {
        return res.status(400).json({ success: false, message: `Product unavailable or insufficient stock: ${product?.name}` });
      }

      products.push({
        productId: product._id,
        quantity: cartItem.quantity,
        price: product.price
      });

      totalPrice += product.price * cartItem.quantity;
    }

    const razorpayOrder = await instance.orders.create({
      amount: totalPrice * 100,
      currency: "INR",
      receipt: `cart_order_${Date.now()}`,
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

    // Clear the user's cart after creating the order
    cart.items = [];
    await cart.save();

    res.status(201).json({
      success: true,
      message: "Cart order created",
      order,
      razorpayOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error during checkout", error: error.message });
  }
};

// ✅ 3. Razorpay Webhook Verification
exports.verifySignature = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  const shasum = crypto.createHmac("sha256", webhookSecret);
  // Use rawBody if attached by middleware to avoid JSON re-serialization issues
  const payload = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
  shasum.update(payload);
  const digest = shasum.digest("hex");

  if (signature === digest) {
    console.log("🔐 Payment authorized");

    const { userId } = req.body.payload.payment.entity.notes || {};
    const paymentOrderId = req.body.payload?.payment?.entity?.order_id; // Razorpay order id

    try {
      // Match the pending order using a robust criteria. Prefer matching by Razorpay order id stored in receipt if available.
      const order = await Order.findOneAndUpdate(
        { userId, paymentStatus: "Pending", razorpayOrderId: paymentOrderId },
        { paymentStatus: "Paid", status: "Confirmed" },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({ success: false, message: "No pending order found" });
      }

      // Update stock
      for (const item of order.products) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity }
        });
      }

      res.status(200).json({
        success: true,
        message: "Payment verified and order confirmed",
        order
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  } else {
    res.status(400).json({ success: false, message: "Invalid signature" });
  }
};

// ✅ 4. Get all orders for user
exports.getAllOrdersOfUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ userId }).populate("products.productId");
    if (!orders.length) {
      return res.status(404).json({ success: false, message: "No orders found" });
    }

    res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching orders", error: error.message });
  }
};

// ✅ 5. Get Invoice by orderId
exports.getInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId }).populate("products.productId");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const invoice = {
      invoiceId: `INV-${order._id}`,
      userId: order.userId,
      products: order.products.map(p => ({
        name: p.productId.name,
        quantity: p.quantity,
        pricePerItem: p.price,
        total: p.price * p.quantity
      })),
      totalAmount: order.totalPrice,
      address: order.address,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      orderDate: order.createdAt,
    };

    res.status(200).json({
      success: true,
      message: "Invoice generated successfully",
      invoice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to generate invoice", error: error.message });
  }
};
