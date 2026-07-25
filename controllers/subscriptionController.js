const Plan = require('../models/Plan');
const PaymentRequest = require('../models/PaymentRequest');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// @desc    Get active plans
// @route   GET /api/subscriptions/plans
// @access  Private (Owner Only)
exports.getActivePlans = async (req, res) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ price: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get subscription status
// @route   GET /api/subscriptions/status
// @access  Private
exports.getSubscriptionStatus = async (req, res) => {
  try {
    let owner = null;
    if (req.user.role === 'owner') {
      owner = req.user;
    } else if (req.user.createdBy) {
      owner = await User.findById(req.user.createdBy);
    }

    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    const now = new Date();
    const expiry = owner.subscriptionEndDate || owner.trialEndDate;
    const remainingMs = expiry ? new Date(expiry).getTime() - now.getTime() : 0;
    const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24)); // Can be negative (days past)

    // Try to find current plan name from latest approved payment
    let currentPlan = owner.subscriptionStatus?.toUpperCase() || '—';
    const lastApproved = await PaymentRequest.findOne({ ownerId: owner._id, status: 'Approved' })
      .sort({ verifiedAt: -1 })
      .populate('planId', 'name');
    if (lastApproved && lastApproved.planId) {
      currentPlan = lastApproved.planId.name;
    }

    // Load global configs for platform UPI and merchant name
    const GlobalConfig = require('../models/GlobalConfig');
    const upiIdConfig = await GlobalConfig.findOne({ key: 'platform_upi_id' });
    const merchantConfig = await GlobalConfig.findOne({ key: 'platform_merchant_name' });
    
    const platformUpiId = upiIdConfig ? upiIdConfig.value : 'market@upi';
    const platformMerchantName = merchantConfig ? merchantConfig.value : 'Super Market';

    res.json({
      success: true,
      data: {
        status: owner.subscriptionStatus,
        expiryDate: expiry,
        daysRemaining,
        shopName: owner.shopName,
        currentPlan,
        active: owner.active,
        platformUpiId,
        platformMerchantName
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Check if owner has a pending payment request
// @route   GET /api/subscriptions/payment-status
// @access  Private (Owner Only)
exports.getPaymentStatus = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    if (!ownerId) return res.json({ success: true, hasPending: false });

    const pending = await PaymentRequest.findOne({ ownerId, status: 'Pending' })
      .sort({ createdAt: -1 })
      .populate('planId', 'name price');

    if (pending) {
      return res.json({
        success: true,
        hasPending: true,
        payment: {
          planName: pending.planId?.name || '—',
          amount: pending.amount,
          transactionRef: pending.transactionRef,
          createdAt: pending.createdAt,
          status: pending.status
        }
      });
    }

    res.json({ success: true, hasPending: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Upload payment screenshot
// @route   POST /api/subscriptions/upload-screenshot
// @access  Private (Owner Only)
exports.uploadScreenshot = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, url, message: 'Screenshot uploaded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Submit payment reference
// @route   POST /api/subscriptions/pay
// @access  Private (Owner Only)
exports.submitPaymentRequest = async (req, res) => {
  try {
    const { planId, transactionRef, paymentDate, paymentTime, screenshotUrl } = req.body;
    if (!planId || !transactionRef) {
      return res.status(400).json({ success: false, message: 'Plan ID and UTR transaction reference are required.' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }

    // Check if transactionRef already exists to prevent duplicate submissions
    const refExists = await PaymentRequest.findOne({ transactionRef: transactionRef.trim() });
    if (refExists) {
      return res.status(400).json({ success: false, message: 'This transaction reference (UTR) has already been submitted.' });
    }

    const request = await PaymentRequest.create({
      ownerId: req.user._id,
      planId,
      amount: plan.price,
      transactionRef: transactionRef.trim(),
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      paymentTime: paymentTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      screenshotUrl: screenshotUrl || '',
      status: 'Pending'
    });

    res.status(201).json({
      success: true,
      message: 'Payment reference submitted successfully. Super Admin verification is pending approval.',
      data: request
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


