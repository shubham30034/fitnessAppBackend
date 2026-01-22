const Cart = require("../../../Model/ProductsModel/cart");
const Product = require("../../../Model/ProductsModel/product");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const mongoose = require("mongoose");

exports.addToCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity = 1 } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(400, "Invalid productId");
  if (typeof quantity !== "number" || quantity <= 0) throw new ApiError(400, "Invalid quantity");

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, "Product not found/inactive");

  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });

  const idx = cart.items.findIndex(i => i.product.toString() === productId);

  if (idx > -1) {
    const newQty = cart.items[idx].quantity + quantity;
    if (newQty > product.quantity) throw new ApiError(400, "Not enough stock");
    cart.items[idx].quantity = newQty;
  } else {
    if (quantity > product.quantity) throw new ApiError(400, "Not enough stock");
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();
  res.json({ success: true, message: "Added to cart", data: cart });
});

exports.getCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart) throw new ApiError(404, "Cart not found");
  res.json({ success: true, data: cart });
});

exports.updateCartItemQuantity = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(400, "Invalid productId");
  if (typeof quantity !== "number") throw new ApiError(400, "Quantity must be number");

  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new ApiError(404, "Cart not found");

  const idx = cart.items.findIndex(i => i.product.toString() === productId);
  if (idx === -1) throw new ApiError(404, "Product not in cart");

  if (quantity <= 0) {
    cart.items.splice(idx, 1);
    await cart.save();
    return res.json({ success: true, message: "Item removed", data: cart });
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, "Product not found/inactive");

  if (quantity > product.quantity) throw new ApiError(400, "Not enough stock");

  cart.items[idx].quantity = quantity;
  await cart.save();

  res.json({ success: true, message: "Cart updated", data: cart });
});

exports.removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(400, "Invalid productId");

  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new ApiError(404, "Cart not found");

  cart.items = cart.items.filter(i => i.product.toString() !== productId);
  await cart.save();

  res.json({ success: true, message: "Item removed", data: cart });
});

exports.clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new ApiError(404, "Cart not found");

  cart.items = [];
  await cart.save();

  res.json({ success: true, message: "Cart cleared", data: cart });
});

exports.getCartTotal = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart) throw new ApiError(404, "Cart not found");

  const total = cart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  res.json({ success: true, data: total });
});
