const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  barcode: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  purchasePrice: {
    type: Number,
    required: true
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  mrp: {
    type: Number,
    required: true
  },
  gstPercent: {
    type: Number,
    required: true,
    default: 0
  },
  gstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  discountAmount: {
    type: Number,
    required: true,
    default: 0
  },
  total: {
    type: Number,
    required: true
  }
});

const SaleSchema = new mongoose.Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [SaleItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  totalGst: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String,
    trim: true
  },
  finalAmount: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Wallet', 'Split'],
    required: true
  },
  paymentDetails: {
    cashAmount: { type: Number, default: 0 },
    upiAmount: { type: Number, default: 0 },
    cardAmount: { type: Number, default: 0 },
    walletAmount: { type: Number, default: 0 },
    transactionId: { type: String, trim: true }
  },
  rewardPointsEarned: {
    type: Number,
    default: 0
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  shopId: {
    type: String
  },
  staffName: {
    type: String
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Paid'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Performance & Tenant Indexes
SaleSchema.index({ owner: 1, createdAt: -1 });
SaleSchema.index({ owner: 1, paymentMode: 1 });
SaleSchema.index({ owner: 1, customer: 1 });

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Sale', SaleSchema);
