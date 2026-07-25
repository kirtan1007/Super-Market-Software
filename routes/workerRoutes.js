const express = require('express');
const router = express.Router();
const {
  getWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  resetWorkerPassword
} = require('../controllers/workerController');
const { protect, authorize } = require('../middleware/auth');

// All worker routes require authentication and Owner role
router.use(protect);
router.use(authorize('owner'));

router.route('/')
  .get(getWorkers)
  .post(createWorker);

router.route('/:id')
  .put(updateWorker)
  .delete(deleteWorker);

router.put('/:id/reset-password', resetWorkerPassword);

module.exports = router;
