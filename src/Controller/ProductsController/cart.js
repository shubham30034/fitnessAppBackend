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
            cart
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

        res.status(200).json({ success: true, cart });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};



exports.removeFromCart = async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;

if(!productId){
  return res.status(400).json({
    success:false,
    message:"please provide product id"
  })
}



  try {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const initialLength = cart.items.length;

    console.log("lenghth",initialLength)

    cart.items = cart.items.filter(item => {
      const itemProductId = item.product._id ? item.product._id.toString() : item.product.toString();
      return itemProductId !== productId;
    });

    if (cart.items.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    await cart.save();

    res.status(200).json({ success: true, message: 'Item removed from cart', cart });
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
    res.status(200).json({ success: true, message: 'Cart updated', cart });
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

        res.status(200).json({ success: true, message: 'Cart cleared', cart });
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

        res.status(200).json({ success: true, total });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
