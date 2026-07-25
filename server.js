const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const mongoose = require('mongoose');
const saasPlugin = require('./config/saasPlugin');
mongoose.plugin(saasPlugin);

const connectDB = require('./config/db');
const {
  mongoSanitizeMiddleware,
  helmetMiddleware,
  sanitizeData,
  apiLimiter
} = require('./middleware/security');

const compression = require('compression');

// Initialize database connection
connectDB().then(async () => {
  const runExpiryCheck = require('./utils/expiryCheckJob');
  runExpiryCheck();
  
  const runSubscriptionCheck = require('./utils/subscriptionCheckJob');
  runSubscriptionCheck();

  // Auto-seed/verify Super Admin on startup
  const ensureSuperAdmin = require('./utils/ensureSuperAdmin');
  await ensureSuperAdmin();
});

const app = express();

// Performance: Compression Middleware
app.use(compression());

// Security Middlewares
app.use(helmetMiddleware);
app.use(mongoSanitizeMiddleware);
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing and cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Custom XSS Sanitizer middleware
app.use(sanitizeData);

// API Rate Limiting
app.use('/api', apiLimiter);

// Serve static frontend files with optimized caching headers
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.svg') || filePath.endsWith('.woff2')) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
  }
}));

// Mount API Routes
const { protect } = require('./middleware/auth');
const requireSubscription = require('./middleware/requireSubscription');

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/superadmin', require('./routes/superAdminRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));

// Subscription-guarded routes
app.use('/api/workers', protect, requireSubscription, require('./routes/workerRoutes'));
app.use('/api/products', protect, requireSubscription, require('./routes/productRoutes'));
app.use('/api/customers', protect, requireSubscription, require('./routes/customerRoutes'));
app.use('/api/suppliers', protect, requireSubscription, require('./routes/supplierRoutes'));
app.use('/api/purchases', protect, requireSubscription, require('./routes/purchaseRoutes'));
app.use('/api/sales', protect, requireSubscription, require('./routes/salesRoutes'));
app.use('/api/reports', protect, requireSubscription, require('./routes/reportRoutes'));
app.use('/api/settings', protect, requireSubscription, require('./routes/settingsRoutes'));
app.use('/api/backup', protect, requireSubscription, require('./routes/backupRoutes'));
app.use('/api/categories', protect, requireSubscription, require('./routes/categoryRoutes'));
app.use('/api/expenses', protect, requireSubscription, require('./routes/expenseRoutes'));
app.use('/api/attendance', protect, requireSubscription, require('./routes/attendanceRoutes'));
app.use('/api/employees', protect, requireSubscription, require('./routes/employeeRoutes'));
app.use('/api/carts', protect, requireSubscription, require('./routes/cartRoutes'));
app.use('/api/invoices', protect, requireSubscription, require('./routes/invoiceRoutes'));
app.use('/api/payments', protect, requireSubscription, require('./routes/paymentRoutes'));
app.use('/api/notifications', protect, requireSubscription, require('./routes/notificationRoutes'));
app.use('/api/stock-history', protect, requireSubscription, require('./routes/stockHistoryRoutes'));
app.use('/api/login-history', protect, requireSubscription, require('./routes/loginHistoryRoutes'));
app.use('/api/otp-verification', require('./routes/otpVerificationRoutes'));

// Super Admin route shortcut
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback all non-API GET requests to SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`SUPER MARKET MANAGEMENT SYSTEM RUNNING`);
  console.log(`Port: ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`Local Network: http://0.0.0.0:${PORT} (Ready for network billing)`);
  console.log(`====================================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Nodemon auto-restart hook v9
