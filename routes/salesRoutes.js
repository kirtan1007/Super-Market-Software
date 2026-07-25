const express = require('express');
const router = express.Router();
const { createSale, getSales, getSaleById, getNextInvoiceNumber } = require('../controllers/salesController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/next-invoice', getNextInvoiceNumber);

router.route('/')
  .get(getSales)
  .post(createSale);

router.get('/:id', getSaleById);

module.exports = router;
