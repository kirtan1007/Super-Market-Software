const express = require('express');
const router = express.Router();
const {
  getCart,
  saveCart,
  clearCart
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getCart)
  .post(saveCart)
  .delete(clearCart);

module.exports = router;
