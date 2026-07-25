const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      }
    }
  ],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Cart', CartSchema);
