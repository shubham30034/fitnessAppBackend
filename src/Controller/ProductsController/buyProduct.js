const Product = require('../../Model/ProductsModel/product');
const Order = require('../../Model/ProductsModel/orderSchema');
const { instance } = require("../../Config/razerpay");
const crypto = require("crypto");


exports.buyProduct = async (req, res) => {
  try {
    // ✅ Get the user's ID from the authenticated token (middleware should add it to req.user)
    const userId = req.user._id;

    // ✅ Extract product details from the request body
    const { productId, quantity, address } = req.body;

    // ✅ Validate request body
    if (!productId || !quantity || !address) {
      return res.status(400).json({
        success: false,
        message: "Product ID, quantity, and address are required",
      });
    }

    // ✅ Check if the product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ✅ Check if enough stock is available
    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Product is not available in stock",
      });
    }

    // ✅ Check if product is active
    if (product.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // ✅ Calculate order amount and define currency
    const amount = product.price * quantity;
    const currency = "INR";

    // ✅ Create Razorpay order options
    const options = {
      amount: amount * 100, // Razorpay takes amount in paise (1 INR = 100 paise)
      currency,
      receipt: `order_rcptid_${Date.now()}`, // Unique receipt ID
      notes: {
        productId,
        userId,
      },
    };

    // ✅ Create order in Razorpay
    const paymentResponse = await instance.orders.create(options);

    // ✅ Create order in your database
    const newOrder = new Order({
      userId,
      productId,
      quantity,
      totalPrice: amount,
      address,
      status: "Pending",          // Will update to 'Confirmed' on payment success
      paymentStatus: "Pending",   // Will update to 'Paid' after verification
    });

    await newOrder.save();

    // ✅ Send response to frontend with order details and Razorpay order
    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: newOrder,
      razorpayOrder: paymentResponse,
    });

  } catch (error) {
    // ❌ Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




exports.verifySignature = async (req, res) => {
  const webhookSecret = "12345678";

  const signature = req.headers["x-razorpay-signature"];

  const shasum = crypto.createHmac("sha256", webhookSecret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (signature === digest) {
    console.log("🔐 Payment is authorized");

    const { productId, userId } = req.body.payload.payment.entity.notes;

    try {
      // ✅ Find the order and update its payment status
      const order = await Order.findOneAndUpdate(
        { userId, productId },
        {
          paymentStatus: "Paid",
          status: "Confirmed",
        },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found for the given user and product.",
        });
      }

      // ✅ Update product stock
      const product = await Product.findByIdAndUpdate(
        productId,
        {
          $inc: { quantity: -order.quantity },
        },
        { new: true }
      );

      // ✅ Send success response (webhook acknowledgment)
      return res.status(200).json({
        success: true,
        message: "Signature verified and order confirmed.",
        updatedOrder: order,
        updatedProduct: product,
      });
    } catch (error) {
      console.error("Error in signature verification logic:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid signature. Unauthorized webhook request.",
    });
  }
};


exports.getAllOrdersOfUser = async (req, res) => {
   try {
    const { userId } = req.user;
    const orders = await Order.find({ userId }).populate("productId");
    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this user.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      orders,
    });
    
   } catch (error) {
     return res.status(500).json({
        success: false,
        message: "Error fetching orders",
        error: error.message,
     })
   }

}



exports.getInvoice = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    // ✅ Find the order and populate product details
    const order = await Order.findOne({ _id: orderId, userId }).populate('productId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const product = order.productId;

    // ✅ Create basic invoice data
    const invoice = {
      invoiceId: `INV-${order._id}`,
      userId: order.userId,
      productName: product.name,
      quantity: order.quantity,
      pricePerItem: product.price,
      totalAmount: order.totalPrice,
      address: order.address,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      orderDate: order.createdAt,
    };

    // ✅ Send JSON invoice (or render as HTML/PDF if needed)
    res.status(200).json({
      success: true,
      message: "Invoice generated successfully",
      invoice,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate invoice",
      error: error.message,
    });
  }
};














