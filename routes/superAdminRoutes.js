const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllShops,
  suspendShop,
  activateShop,
  extendTrial,
  deleteShop,
  restoreShop,
  createPlan,
  getPlans,
  updatePlan,
  deletePlan,
  getSystemMetrics,
  getLoginHistory,
  getPendingPayments,
  approvePayment,
  rejectPayment,
  changeSubscription,
  getGlobalConfig,
  updateGlobalConfig
} = require('../controllers/superAdminController');

// Secure all routes with authentication and superadmin authorization
router.use(protect);
router.use(authorize('superadmin'));

// Shop operations
router.get('/shops', getAllShops);
router.post('/shops/:id/suspend', suspendShop);
router.post('/shops/:id/activate', activateShop);
router.post('/shops/:id/extend-trial', extendTrial);
router.post('/shops/:id/change-subscription', changeSubscription);
router.delete('/shops/:id', deleteShop);
router.post('/shops/:id/restore', restoreShop);

// Plans CRUD
router.post('/plans', createPlan);
router.get('/plans', getPlans);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Stats and history logs
router.get('/metrics', getSystemMetrics);
router.get('/login-history', getLoginHistory);
router.get('/global-config', getGlobalConfig);
router.post('/global-config', updateGlobalConfig);

// Payment approvals
router.get('/payments/pending', getPendingPayments);
router.post('/payments/:id/approve', approvePayment);
router.post('/payments/:id/reject', rejectPayment);

module.exports = router;
