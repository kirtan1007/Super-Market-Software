const mongoose = require('mongoose');
const { isValidEan13 } = require('../utils/barcodeHelper');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  barcode: {
    type: String,
    required: [true, 'Barcode is required'],
    trim: true,
    unique: true,
    index: true,
    minlength: [13, 'Barcode must be exactly 13 digits'],
    maxlength: [13, 'Barcode must be exactly 13 digits'],
    validate: {
      validator: function(v) {
        if (isValidEan13(v)) return true;
        // Skip validation for existing unmodified product barcodes
        if (this && typeof this.isModified === 'function') {
          if (!this.isModified('barcode') && !this.isNew) return true;
        }
        return false;
      },
      message: props => `${props.value} is not a valid EAN-13 barcode!`
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  purchasePrice: {
    type: Number,
    required: [true, 'Purchase price is required'],
    default: 0
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    default: 0
  },
  mrp: {
    type: Number,
    required: [true, 'MRP is required'],
    default: 0
  },
  gst: {
    type: Number,
    required: [true, 'GST percentage is required'],
    default: 0
  },
  productImage: {
    type: String,
    default: ''
  },
  minimumStock: {
    type: Number,
    required: [true, 'Minimum stock warning level is required'],
    default: 5
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock quantity is required'],
    default: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  mfgDate: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  shelfLife: {
    type: String,
    trim: true
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expiredStock: {
    type: Number,
    default: 0
  },
  rackNumber: {
    type: String,
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

// Performance & Tenant Indexes
ProductSchema.index({ ownerId: 1, barcode: 1 }, { unique: true });
ProductSchema.index({ ownerId: 1, name: 1 });
ProductSchema.index({ ownerId: 1, category: 1 });
ProductSchema.index({ ownerId: 1, currentStock: 1 });
ProductSchema.index({ ownerId: 1, expiryDate: 1 });

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Product', ProductSchema);
