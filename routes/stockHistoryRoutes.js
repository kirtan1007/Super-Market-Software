const express = require('express');
const router = express.Router();
const { getStockHistory, deleteStockHistory } = require('../controllers/systemHistoryController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getStockHistory);

router.route('/:id')
  .delete(deleteStockHistory);

module.exports = router;
