const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Category name is unique per owner
CategorySchema.index({ ownerId: 1, name: 1 }, { unique: true });

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Category', CategorySchema);
