const Product = require('../../Model/ProductsModel/product');
const Order = require('../../Model/ProductsModel/orderSchema');
const { instance } = require("../../Config/razerpay");
const crypto = require("crypto");
const {buyProductValidation} = require("../../validator/productValidation")


exports.buyProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity, address } = req.body;

    // Validate input
    const { error } = buyProductValidation({ productId, quantity, address });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check stock
    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Product is not available in stock",
      });
    }

    // Check if product is active
    if (product.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Calculate order amount and create Razorpay order
    const amount = product.price * quantity;
    const currency = "INR";
    const options = {
      amount: amount * 100,
      currency,
      receipt: `order_rcptid_${Date.now()}`,
      notes: { productId, userId },
    };

    const paymentResponse = await instance.orders.create(options);

    // Save order in DB
    const newOrder = new Order({
      userId,
      productId,
      quantity,
      totalPrice: amount,
      address,
      status: "Pending",
      paymentStatus: "Pending",
    });
    await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: newOrder,
      razorpayOrder: paymentResponse,
    });
  } catch (error) {
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


if (!userId) {
  return res.status(401).json({ success: false, message: "Unauthorized: user ID missing" });
}


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
    const userId = req.user.id;
    const { orderId } = req.params;

    if (!userId) {
  return res.status(401).json({ success: false, message: "Unauthorized: user ID missing" });
}

if(!orderId){
  return res.status(400).json({
    success:false,
    message:"order id is required"
  })
}

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














