const express = require('express');
const router = express.Router();
const {
  getNotifications,
  createNotification,
  markAsRead,
  deleteNotification
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getNotifications)
  .post(createNotification);

router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
