const express = require('express');
const router = express.Router();
const {
  getAttendance,
  checkIn,
  checkOut,
  deleteAttendance
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getAttendance);

router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.delete('/:id', deleteAttendance);

module.exports = router;
