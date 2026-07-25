const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getSalesReport,
  getProductPerformanceReport,
  getGstReport,
  getExpiryReport
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', getDashboardStats);

// Owner and Manager reports
router.get('/sales', authorize('owner', 'manager'), getSalesReport);
router.get('/products-performance', authorize('owner', 'manager'), getProductPerformanceReport);
router.get('/gst', authorize('owner', 'manager'), getGstReport);
router.get('/expiry', authorize('owner', 'manager'), getExpiryReport);

module.exports = router;
