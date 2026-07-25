const express = require('express');
const router = express.Router();
const {
  registerOwner,
  login,
  forgotPasswordVerifyUser,
  forgotPasswordVerifyAnswers,
  forgotPasswordReset,
  getMe,
  logout,
  getSetupStatus,
  sendOtp,
  verifyOtp,
  resetPassword,
  verifyOwner
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

router.get('/setup-status', getSetupStatus);
router.post('/register-owner', registerOwner);
router.post('/login', authLimiter, login);
router.post('/forgot-password-verify-user', forgotPasswordVerifyUser);
router.post('/forgot-password-verify-answers', forgotPasswordVerifyAnswers);
router.post('/forgot-password-reset', forgotPasswordReset);

// Email OTP Forgot Password Endpoints
router.post('/send-otp', authLimiter, sendOtp);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/reset-password', authLimiter, resetPassword);

router.post('/verify-owner', protect, verifyOwner);

router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

module.exports = router;
