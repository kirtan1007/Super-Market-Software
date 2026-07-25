const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Info', 'Warning', 'Alert'],
    default: 'Info'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const createTenantProxy = require('../config/tenantModelResolver');
module.exports = createTenantProxy('Notification', NotificationSchema);
