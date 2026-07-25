const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');

// Rate limiter: max 300 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth rate limiter: max 30 requests per 15 minutes for login/forgot password
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Custom sanitization and XSS protection middleware
const sanitizeData = (req, res, next) => {
  // Fields that must NOT be sanitized (passwords, OTPs, etc. go directly to bcrypt/comparison)
  const SKIP_FIELDS = new Set(['password', 'confirmPassword', 'newPassword', 'currentPassword', 'otp', 'answer', 'answers']);

  // Sanitize req.body, req.query, req.params for HTML tags (basic XSS prevention)
  const clean = (obj, parentKey = null) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (typeof obj === 'object' && obj !== null) {
      for (let key in obj) {
        if (SKIP_FIELDS.has(key)) continue; // Skip sensitive fields
        obj[key] = clean(obj[key], key);
      }
    }
    return obj;
  };

  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  if (req.params) req.params = clean(req.params);

  next();
};


module.exports = {
  apiLimiter,
  authLimiter,
  mongoSanitizeMiddleware: mongoSanitize(),
  helmetMiddleware: helmet({
    contentSecurityPolicy: false // Disabled for loading resources in development
  }),
  sanitizeData
};
