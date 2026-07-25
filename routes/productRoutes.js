const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  importProductsCSV,
  regenerateBarcodes
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// File filter (images only or CSV depending on field)
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'productImage') {
      if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.webp') {
        return cb(new Error('Only PNG, JPG, JPEG, or WEBP images are allowed'), false);
      }
    } else if (file.fieldname === 'csvFile') {
      if (ext !== '.csv') {
        return cb(new Error('Only CSV files are allowed'), false);
      }
    }
    cb(null, true);
  }
});

// All routes require authentication
router.use(protect);

router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/barcode/:barcode', getProductByBarcode);

// Owner and Manager modifications
router.post('/', authorize('owner', 'manager'), upload.single('productImage'), createProduct);
router.put('/:id', authorize('owner', 'manager'), upload.single('productImage'), updateProduct);
router.delete('/:id', authorize('owner', 'manager'), deleteProduct);
router.post('/import-csv', authorize('owner', 'manager'), upload.single('csvFile'), importProductsCSV);
router.post('/regenerate-barcodes', authorize('owner', 'manager'), regenerateBarcodes);

module.exports = router;
