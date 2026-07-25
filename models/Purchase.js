const mongoose = require('mongoose');

const PurchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
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
  total: {
    type: Number,
    required: true
  }
});

const PurchaseSchema = new mongoose.Schema({
  invoiceNo: {
    type: String,
    required: true,
    trim: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  items: [PurchaseItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial'],
    default: 'Paid'
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Purchase', PurchaseSchema);
