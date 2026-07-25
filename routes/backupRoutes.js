const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exportBackup, restoreBackup } = require('../controllers/backupController');
const { protect, authorize } = require('../middleware/auth');

const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Multer Storage Configuration for Backup file restoration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, backupsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `restore-${Date.now()}.json`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.json') {
      return cb(new Error('Only JSON files are allowed'), false);
    }
    cb(null, true);
  }
});

// Protect all routes - Owner only
router.use(protect);
router.use(authorize('owner'));

router.get('/export', exportBackup);
router.post('/restore', upload.single('backupFile'), restoreBackup);

module.exports = router;
