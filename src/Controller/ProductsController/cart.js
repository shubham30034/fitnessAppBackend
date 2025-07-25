const Cart = require('../../Model/ProductsModel/cart');
const Product = require('../../Model/ProductsModel/product');
const mongoose = require("mongoose")

exports.addToCart = async (req, res) => {
    const userId = req.user.id

 
    const { productId, quantity } = req.body;
  

    if(!userId){
        return res.status(400).json({
            success:false,
            message:"unable to get userId"
        })
    }

    console.log("userID",userId)
    if(!productId){
         return res.status(400).json({
            success:false,
            message:"please provide productId"
        })
    }

    try {
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({ message: 'Product not found or inactive' });
        }

        if (product.quantity < quantity) {
            return res.status(400).json({ message: 'Not enough product in stock' });
        }

        let cart = await Cart.findOne({ user: userId });

        if (cart) {
            const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

            if (itemIndex > -1) {
                // Update quantity
                cart.items[itemIndex].quantity += quantity;
            } else {
                // Add new item
                cart.items.push({ product: productId, quantity });
            }
        } else {
            // Create new cart
            cart = new Cart({
                user: userId,
                items: [{ product: productId, quantity }]
            });
        }

        await cart.save();
        res.status(200).json({ 
            success:true,
            message: 'Added to cart', 
            data: cart
         });
    } catch (error) {
        res.status(500).json({ 
            success:false,
            message: 'Server error', 
            error: error.message 
        });
    }
};




exports.getCart = async (req, res) => {
    const userId = req.user.id;

    try {
        const cart = await Cart.findOne({ user: userId }).populate('items.product');

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        res.status(200).json({ success: true, data: cart });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};



exports.removeFromCart = async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;
  const { quantity } = req.body; // optional: amount to reduce

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Please provide product id"
    });
  }

  try {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    if (quantity && quantity > 0) {
      const currentQty = cart.items[itemIndex].quantity;

      if (quantity > currentQty) {
        return res.status(400).json({
          success: false,
          message: `Cannot remove more than current quantity (${currentQty}) in cart`
        });
      }

      cart.items[itemIndex].quantity -= quantity;

      if (cart.items[itemIndex].quantity === 0) {
        cart.items.splice(itemIndex, 1); // remove item completely
      }
    } else {
      // Remove item entirely if no quantity is specified
      cart.items.splice(itemIndex, 1);
    }

    await cart.save();

    res.status(200).json({ success: true, message: 'Item updated/removed from cart', data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};


exports.updateCartItemQuantity = async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;
  const { quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId) || typeof quantity !== "number") {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }

  try {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    res.status(200).json({ success: true, message: 'Cart updated', data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};





exports.clearCart = async (req, res) => {
    const userId = req.user.id;

    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        cart.items = [];
        await cart.save();

        res.status(200).json({ success: true, message: 'Cart cleared', data: cart });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};


exports.getCartTotal = async (req, res) => {
    const userId = req.user.id;

    try {
        const cart = await Cart.findOne({ user: userId }).populate('items.product');

        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const total = cart.items.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);

        res.status(200).json({ success: true, data: total });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
