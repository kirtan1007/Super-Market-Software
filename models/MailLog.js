const mongoose = require('mongoose');

const MailLogSchema = new mongoose.Schema({
  to: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MailLog', MailLogSchema, 'mail_logs');
