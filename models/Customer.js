const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    index: true
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    trim: true
  },
  totalVisits: {
    type: Number,
    default: 0
  },
  totalPurchase: {
    type: Number,
    default: 0
  },
  lastPurchaseDate: {
    type: Date
  },
  rewardPoints: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index so mobile is unique per owner/tenant
CustomerSchema.index({ owner: 1, mobile: 1 }, { unique: true });
CustomerSchema.index({ owner: 1, name: 1 });

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Customer', CustomerSchema);
