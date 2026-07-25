const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const {
  getActivePlans,
  getSubscriptionStatus,
  getPaymentStatus,
  uploadScreenshot,
  submitPaymentRequest
} = require('../controllers/subscriptionController');

// All subscription operations require an authenticated owner context
router.use(protect);

// Ensure uploads dir exists for screenshots
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer for payment screenshots
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `payment-ss-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadScreenshotMiddleware = multer({
  storage: screenshotStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Only JPG, PNG, WEBP images are allowed'), false);
    }
    cb(null, true);
  }
});

router.get('/plans', getActivePlans);
router.get('/status', getSubscriptionStatus);
router.get('/payment-status', getPaymentStatus);
router.post('/upload-screenshot', uploadScreenshotMiddleware.single('screenshot'), uploadScreenshot);
router.post('/pay', submitPaymentRequest);

module.exports = router;
