const Cart = require('../models/Cart');
const { logActivity } = require('../middleware/auth');

// @desc    Get active cart for cashier
// @route   GET /api/carts
// @access  Private
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ cashier: req.user._id }).populate('items.product');
    if (!cart) {
      cart = await Cart.create({ cashier: req.user._id, items: [] });
    }
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save/Update cart items
// @route   POST /api/carts
// @access  Private
exports.saveCart = async (req, res) => {
  try {
    const { items } = req.body;
    let cart = await Cart.findOne({ cashier: req.user._id });
    if (!cart) {
      cart = new Cart({ cashier: req.user._id });
    }

    cart.items = items;
    cart.updatedAt = new Date();
    await cart.save();

    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear cart
// @route   DELETE /api/carts
// @access  Private
exports.clearCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ cashier: req.user._id });
    if (cart) {
      cart.items = [];
      cart.updatedAt = new Date();
      await cart.save();
    }
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
