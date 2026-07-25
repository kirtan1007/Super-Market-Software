const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true
  },
  shopName: {
    type: String,
    required: true,
    default: 'Super Market'
  },
  shopAddress: {
    type: String,
    default: '123 Galaxy Way, Sector 5, Super Market City'
  },
  shopMobile: {
    type: String,
    default: '9876543210'
  },
  shopEmail: {
    type: String,
    default: 'contact@supermarketsoftware.com'
  },
  gstNumber: {
    type: String,
    default: '22AAAAA0000A1Z5'
  },
  shopLogo: {
    type: String,
    default: ''
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  enableGst: {
    type: Boolean,
    default: true
  },
  qrCodeUpi: {
    type: String,
    default: 'market@upi'
  },
  upiMerchantName: {
    type: String,
    default: 'Super Market'
  },
  upiQrImage: {
    type: String,
    default: ''
  },
  enableQrPayment: {
    type: Boolean,
    default: true
  },
  printerType: {
    type: String,
    enum: ['A4', 'Thermal'],
    default: 'Thermal'
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'dark'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Setting', SettingSchema);
