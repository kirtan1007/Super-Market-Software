const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['owner', 'worker', 'manager', 'cashier', 'staff', 'employee', 'superadmin'],
    default: 'worker'
  },
  shopName: {
    type: String,
    trim: true
  },
  databaseName: {
    type: String,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true
  },
  shopAddress: {
    type: String,
    trim: true
  },
  securityQuestions: [
    {
      question: { type: String, required: true },
      answer: { type: String, required: true }
    }
  ],
  resetOtp: {
    type: String
  },
  resetOtpExpires: {
    type: Date
  },
  resetOtpAttempts: {
    type: Number,
    default: 0
  },
  isOtpVerified: {
    type: Boolean,
    default: false
  },
  otpVerifiedExpires: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  active: {
    type: Boolean,
    default: true
  },
  trialStartDate: {
    type: Date
  },
  trialEndDate: {
    type: Date
  },
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'expired', 'suspended'],
    default: 'trial'
  },
  subscriptionStartDate: {
    type: Date
  },
  subscriptionEndDate: {
    type: Date
  },
  planName: {
    type: String,
    default: 'Trial'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema, 'owners');
