const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase } = require('../controllers/purchaseController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getPurchases)
  .post(authorize('owner', 'manager', 'staff'), createPurchase);

module.exports = router;
