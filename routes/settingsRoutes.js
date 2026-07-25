const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getSettings,
  updateSettings,
  uploadLogo,
  uploadUpiQrImage,
  getActivityLogs,
  resetStoreData
} = require('../controllers/settingsController');
const { protect, authorize, restoreTenantContext } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration for Logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ownerId = req.user ? (req.user.ownerId || req.user._id).toString() : 'default';
    const ownerLogoDir = path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerId, 'logo');
    if (!fs.existsSync(ownerLogoDir)) {
      fs.mkdirSync(ownerLogoDir, { recursive: true });
    }
    cb(null, ownerLogoDir);
  },
  filename: (req, file, cb) => {
    cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.webp') {
      return cb(new Error('Only PNG, JPG, JPEG, or WEBP images are allowed'), false);
    }
    cb(null, true);
  }
});

// Multer Storage Configuration for Owner UPI QR
const upiStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ownerId = req.user ? (req.user.ownerId || req.user._id).toString() : 'default';
    const ownerQrDir = path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerId, 'qr');
    if (!fs.existsSync(ownerQrDir)) {
      fs.mkdirSync(ownerQrDir, { recursive: true });
    }
    cb(null, ownerQrDir);
  },
  filename: (req, file, cb) => {
    cb(null, `upi-qr-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadUpiQr = multer({
  storage: upiStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.webp') {
      return cb(new Error('Only PNG, JPG, JPEG, or WEBP images are allowed'), false);
    }
    cb(null, true);
  }
});

router.use(protect);

router.get('/', getSettings);

// Owner-only settings manipulation
router.put('/', authorize('owner'), updateSettings);
router.post('/logo', authorize('owner'), upload.single('shopLogo'), restoreTenantContext, uploadLogo);
router.post('/upi-qr', authorize('owner'), uploadUpiQr.single('upiQrImage'), restoreTenantContext, uploadUpiQrImage);
router.get('/logs', authorize('owner'), getActivityLogs);
router.post('/reset', authorize('owner'), resetStoreData);

module.exports = router;
