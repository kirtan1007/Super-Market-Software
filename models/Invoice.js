const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  pdfUrl: {
    type: String,
    default: ''
  },
  printed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Invoice', InvoiceSchema);
