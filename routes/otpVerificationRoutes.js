const express = require('express');
const router = express.Router();
const { getOtpVerifications, deleteOtpVerification } = require('../controllers/systemHistoryController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getOtpVerifications);

router.route('/:id')
  .delete(deleteOtpVerification);

module.exports = router;
