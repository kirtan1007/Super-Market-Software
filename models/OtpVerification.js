const mongoose = require('mongoose');

const OtpVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    required: true // e.g. "Password Reset" or "Customer Login"
  },
  attempts: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Verified', 'Expired', 'MaxAttemptsExceeded'],
    default: 'Pending'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('OtpVerification', OtpVerificationSchema);
