const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const { logActivity } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const LoginHistory = require('../models/LoginHistory');
const OtpVerification = require('../models/OtpVerification');
const crypto = require('crypto');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    const query = { owner: ownerId };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: searchRegex },
        { mobile: searchRegex }
      ];
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get customer by mobile number
// @route   GET /api/customers/mobile/:mobile
// @access  Private
exports.getCustomerByMobile = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    const customer = await Customer.findOne({ owner: ownerId, mobile: req.params.mobile });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found with this mobile number' });
    }
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res) => {
  try {
    const { name, mobile, email, address } = req.body;
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;

    const customerExists = await Customer.findOne({ owner: ownerId, mobile });
    if (customerExists) {
      return res.status(400).json({ success: false, message: 'Customer already exists with this mobile number' });
    }

    const customer = await Customer.create({
      owner: ownerId,
      name,
      mobile,
      email,
      address
    });

    await logActivity(req, 'Create Customer', `Customer '${name}' (Mobile: ${mobile}) registered`);

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get customer purchase history
// @route   GET /api/customers/:id/history
// @access  Private
exports.getCustomerHistory = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    
    // Verify customer owner
    const customer = await Customer.findOne({ _id: req.params.id, owner: ownerId });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found or unauthorized' });
    }

    const sales = await Sale.find({ customer: req.params.id, owner: ownerId })
      .populate('cashier', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send OTP for Customer Login
// @route   POST /api/customers/send-otp
// @access  Public
exports.sendCustomerOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const customer = await Customer.findOne({ mobile });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'No customer registered with this mobile number' });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Save to OtpVerification collection
    await OtpVerification.create({
      email: mobile,
      otp: otp,
      purpose: 'Customer Login',
      status: 'Pending',
      expiresAt
    });

    res.status(200).json({
      success: true,
      message: 'Customer OTP generated and stored securely.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Customer OTP and Login
// @route   POST /api/customers/login-verify
// @access  Public
exports.verifyCustomerOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile number and OTP are required' });
    }

    const customer = await Customer.findOne({ mobile });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Find latest pending OtpVerification
    const otpRec = await OtpVerification.findOne({ email: mobile, purpose: 'Customer Login', status: 'Pending' }).sort({ createdAt: -1 });

    if (!otpRec) {
      return res.status(400).json({ success: false, message: 'No OTP requested for this customer' });
    }

    // Check expiry
    if (otpRec.expiresAt < Date.now()) {
      otpRec.status = 'Expired';
      await otpRec.save();
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Check attempts limit
    if (otpRec.attempts >= 5) {
      otpRec.status = 'MaxAttemptsExceeded';
      await otpRec.save();
      return res.status(400).json({ success: false, message: 'Maximum attempts exceeded. Please request a new OTP.' });
    }

    // Increment attempts
    otpRec.attempts += 1;

    // Verify OTP code
    if (otpRec.otp !== otp) {
      await otpRec.save();
      const remaining = 5 - otpRec.attempts;
      if (remaining <= 0) {
        otpRec.status = 'MaxAttemptsExceeded';
        await otpRec.save();
        return res.status(400).json({ success: false, message: 'Attempts exceeded. Please request a new OTP.' });
      }
      return res.status(400).json({ success: false, message: `Invalid OTP code. ${remaining} attempts remaining.` });
    }

    // Success
    otpRec.status = 'Verified';
    await otpRec.save();

    // Log successful login
    await LoginHistory.create({
      customer: customer._id,
      username: customer.name,
      role: 'customer',
      status: 'Success',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Generate JWT token
    const token = jwt.sign({ id: customer._id }, process.env.JWT_SECRET || 'super_secret_super_market_software_jwt_token_key_12345', {
      expiresIn: '7d'
    });

    res.status(200).json({
      success: true,
      token,
      customer
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
