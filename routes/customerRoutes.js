const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerByMobile,
  createCustomer,
  getCustomerHistory,
  sendCustomerOtp,
  verifyCustomerOtp
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');

// Public customer authentication routes
router.post('/send-otp', sendCustomerOtp);
router.post('/login-verify', verifyCustomerOtp);

// Protected routes
router.use(protect);

router.route('/')
  .get(getCustomers)
  .post(createCustomer);

router.get('/mobile/:mobile', getCustomerByMobile);
router.get('/:id/history', getCustomerHistory);

module.exports = router;
