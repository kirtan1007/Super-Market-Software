const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required'],
    unique: true
  },
  quantity: {
    type: Number,
    required: [true, 'Inventory quantity is required'],
    default: 0
  },
  warehouseLocation: {
    type: String,
    default: 'Main Store'
  },
  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock'],
    default: 'In Stock'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Inventory', InventorySchema);
