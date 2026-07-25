const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
} = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getSuppliers)
  .post(authorize('owner', 'manager'), createSupplier);

router.route('/:id')
  .put(authorize('owner', 'manager'), updateSupplier)
  .delete(authorize('owner', 'manager'), deleteSupplier);

module.exports = router;
