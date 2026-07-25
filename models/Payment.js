const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  paymentNo: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Wallet', 'Split'],
    required: true
  },
  status: {
    type: String,
    enum: ['Completed', 'Failed', 'Refunded'],
    default: 'Completed'
  },
  transactionId: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Payment', PaymentSchema);
