const mongoose = require('mongoose');

const PaymentRequestSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required']
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: [true, 'Plan ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'Card', 'Cash', 'NetBanking'],
    default: 'UPI'
  },
  transactionRef: {
    type: String,
    required: [true, 'Transaction reference is required'],
    trim: true,
    unique: true
  },
  paymentDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  paymentTime: {
    type: String,
    default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  },
  screenshotUrl: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  remarks: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  verifiedAt: {
    type: Date
  }
});

module.exports = mongoose.model('PaymentRequest', PaymentRequestSchema, 'payment_requests');
