const express = require('express');
const router = express.Router();
const { getLoginHistory, deleteLoginHistory } = require('../controllers/systemHistoryController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getLoginHistory);

router.route('/:id')
  .delete(deleteLoginHistory);

module.exports = router;
