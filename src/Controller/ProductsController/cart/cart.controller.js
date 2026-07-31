const Cart = require("../../../Model/ProductsModel/cart");
const Product = require("../../../Model/ProductsModel/product");
const asyncHandler = require("../../../Utils/aysncHandler");
const ApiError = require("../../../Utils/ApiError");
const mongoose = require("mongoose");

/* ======================================================
   ADD TO CART
====================================================== */
exports.addToCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { productId, quantity = 1 } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new ApiError(400, "Quantity must be a positive integer");

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


/* ======================================================
   GET CART
====================================================== */
exports.getCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let cart = await Cart.findOne({ user: userId })
    .populate("items.product", "name price productImages isActive quantity");

  if (!cart) cart = await Cart.create({ user: userId, items: [] });

  res.json({ success: true, data: cart });
});


/* ======================================================
   UPDATE CART ITEM QUANTITY
====================================================== */
exports.updateCartItemQuantity = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;
  let { quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  if (!Number.isInteger(quantity))
    throw new ApiError(400, "Quantity must be an integer");

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


/* ======================================================
   REMOVE ITEM FROM CART
====================================================== */
exports.removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId))
    throw new ApiError(400, "Invalid productId");

  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new ApiError(404, "Cart not found");

  cart.items = cart.items.filter(i => i.product.toString() !== productId);
  await cart.save();

  res.json({ success: true, message: "Item removed", data: cart });
});


/* ======================================================
   CLEAR CART
====================================================== */
exports.clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new ApiError(404, "Cart not found");

  cart.items = [];
  await cart.save();

  res.json({ success: true, message: "Cart cleared", data: cart });
});


/* ======================================================
   GET CART TOTAL (SAFE)
====================================================== */
exports.getCartTotal = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId })
    .populate("items.product", "price isActive");

  if (!cart) throw new ApiError(404, "Cart not found");

  const total = cart.items.reduce((sum, item) => {
    if (!item.product || !item.product.isActive) return sum;
    return sum + item.product.price * item.quantity;
  }, 0);

  res.json({ success: true, data: total });
});
