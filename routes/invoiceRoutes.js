const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  deleteInvoice
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getInvoices);

router.route('/:id')
  .get(getInvoice)
  .delete(deleteInvoice);

module.exports = router;
