const User = require('../models/User');
const Plan = require('../models/Plan');
const PaymentRequest = require('../models/PaymentRequest');
const LoginHistory = require('../models/LoginHistory');
const { sendEmail } = require('../utils/mailService');
const mongoose = require('mongoose');

// ==========================================
// 1. SHOP & OWNER MANAGEMENT
// ==========================================

// @desc    Get all shops/owners
// @route   GET /api/superadmin/shops
// @access  Private (Super Admin Only)
exports.getAllShops = async (req, res) => {
  try {
    const owners = await User.find({ role: 'owner' }).sort({ createdAt: -1 });
    res.json({ success: true, count: owners.length, data: owners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Suspend a shop
// @route   POST /api/superadmin/shops/:id/suspend
// @access  Private (Super Admin Only)
exports.suspendShop = async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') {
      return res.status(404).json({ success: false, message: 'Shop owner not found' });
    }

    owner.active = false;
    owner.subscriptionStatus = 'suspended';
    await owner.save();

    await sendEmail({
      to: owner.email,
      subject: 'Account Suspended - Action Required',
      body: `Hi ${owner.name},\n\nYour supermarket shop subscription for '${owner.shopName}' has been suspended by the Super Admin.\n\nPlease contact support for resolution.\n\nBest regards,\nSaaS Admin`
    });

    res.json({ success: true, message: 'Shop suspended successfully', data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Activate a suspended shop
// @route   POST /api/superadmin/shops/:id/activate
// @access  Private (Super Admin Only)
exports.activateShop = async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') {
      return res.status(404).json({ success: false, message: 'Shop owner not found' });
    }

    owner.active = true;
    owner.subscriptionStatus = owner.subscriptionEndDate > new Date() ? 'active' : 'expired';
    await owner.save();

    await sendEmail({
      to: owner.email,
      subject: 'Account Re-Activated',
      body: `Hi ${owner.name},\n\nGood news! Your supermarket shop subscription for '${owner.shopName}' has been re-activated by the Super Admin.\n\nYou can now log back in and continue billing.\n\nBest regards,\nSaaS Admin`
    });

    res.json({ success: true, message: 'Shop activated successfully', data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Extend Trial period
// @route   POST /api/superadmin/shops/:id/extend-trial
// @access  Private (Super Admin Only)
exports.extendTrial = async (req, res) => {
  try {
    const { days } = req.body;
    const parsedDays = parseInt(days, 10);
    if (isNaN(parsedDays) || parsedDays === 0) {
      return res.status(400).json({ success: false, message: 'Please provide valid number of days' });
    }

    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') {
      return res.status(404).json({ success: false, message: 'Shop owner not found' });
    }

    // Set trial end date
    const currentEnd = owner.subscriptionEndDate || owner.trialEndDate || new Date();
    const newEnd = new Date(new Date(currentEnd).getTime() + parsedDays * 24 * 60 * 60 * 1000);
    
    owner.subscriptionEndDate = newEnd;
    owner.subscriptionStatus = newEnd > new Date() ? 'active' : 'expired';
    owner.active = true;
    await owner.save();

    await sendEmail({
      to: owner.email,
      subject: 'Subscription / Trial Period Adjusted',
      body: `Hi ${owner.name},\n\nSuper Admin has adjusted your subscription/trial period for '${owner.shopName}' by ${parsedDays} days.\n\nYour new expiration date is ${newEnd.toLocaleDateString()}.\n\nBest regards,\nSaaS Admin`
    });

    res.json({ success: true, message: `Subscription adjusted by ${parsedDays} days`, data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Soft Delete Shop
// @route   DELETE /api/superadmin/shops/:id
// @access  Private (Super Admin Only)
exports.deleteShop = async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') {
      return res.status(404).json({ success: false, message: 'Shop owner not found' });
    }

    owner.isDeleted = true;
    owner.active = false;
    owner.deletedAt = new Date();
    await owner.save();

    res.json({ success: true, message: 'Shop soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Restore Soft Deleted Shop
// @route   POST /api/superadmin/shops/:id/restore
// @access  Private (Super Admin Only)
exports.restoreShop = async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') {
      return res.status(404).json({ success: false, message: 'Shop owner not found' });
    }

    owner.isDeleted = false;
    owner.active = true;
    owner.deletedAt = null;
    await owner.save();

    res.json({ success: true, message: 'Shop restored successfully', data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ==========================================
// 2. SUBSCRIPTION PLANS CRUD
// ==========================================

exports.createPlan = async (req, res) => {
  try {
    const { name, price, durationDays, description } = req.body;
    const plan = await Plan.create({ name, price, durationDays, description });
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({}).sort({ price: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { name, price, durationDays, description, active } = req.body;
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { name, price, durationDays, description, active },
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ==========================================
// 3. REVENUE & SYSTEM STATISTICS
// ==========================================

exports.getSystemMetrics = async (req, res) => {
  try {
    // 1. Revenue calculations
    const approvedPayments = await PaymentRequest.find({ status: 'Approved' });
    const totalRevenue = approvedPayments.reduce((acc, pay) => acc + pay.amount, 0);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    const monthlyRevenue = approvedPayments
      .filter(pay => new Date(pay.createdAt) >= firstDayOfMonth)
      .reduce((acc, pay) => acc + pay.amount, 0);

    const yearlyRevenue = approvedPayments
      .filter(pay => new Date(pay.createdAt) >= firstDayOfYear)
      .reduce((acc, pay) => acc + pay.amount, 0);

    // 2. User counts by roles
    const totalShops = await User.countDocuments({ role: 'owner' });
    const activeShops = await User.countDocuments({ role: 'owner', active: true });
    
    // Employee count (Workers and Managers)
    const employees = await User.find({ role: { $in: ['worker', 'manager', 'cashier'] } });
    const managerCount = employees.filter(e => e.role === 'manager').length;
    const workerCount = employees.filter(e => e.role !== 'manager').length;

    res.json({
      success: true,
      data: {
        totalRevenue,
        monthlyRevenue,
        yearlyRevenue,
        totalShops,
        activeShops,
        managerCount,
        workerCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLoginHistory = async (req, res) => {
  try {
    const history = await LoginHistory.find({}).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ==========================================
// 4. PAYMENT VERIFICATION & APPROVAL
// ==========================================

exports.getPendingPayments = async (req, res) => {
  try {
    const pending = await PaymentRequest.find({ status: 'Pending' })
      .populate('ownerId')
      .populate('planId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const { remarks } = req.body;
    const payment = await PaymentRequest.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment request not found' });
    }

    if (payment.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Payment already processed: ${payment.status}` });
    }

    const owner = await User.findById(payment.ownerId);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    const plan = await Plan.findById(payment.planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // 1. Mark payment as approved
    payment.status = 'Approved';
    payment.approvedBy = req.user._id;
    payment.verifiedAt = new Date();
    payment.remarks = remarks || '';
    await payment.save();

    // 2. Activate subscription and calculate start & expiry dates
    const startDate = new Date();
    const baseDate = owner.subscriptionEndDate > startDate ? owner.subscriptionEndDate : startDate;
    const newExpiry = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    
    owner.subscriptionStatus = 'active';
    owner.subscriptionStartDate = startDate;
    owner.subscriptionEndDate = newExpiry;
    owner.planName = plan.name;
    owner.active = true;
    owner.reminderSentDays = []; // reset email reminder history
    await owner.save();

    // 3. Send Confirmation Email to Owner
    await sendEmail({
      to: owner.email,
      subject: 'Orbit Super Market ERP - Premium Subscription Activated',
      body: `Dear ${owner.name},\n\nYour manual payment reference (UTR: ${payment.transactionRef}) has been verified and approved by the Super Admin.\n\nSubscription Details:\n• Shop Name: ${owner.shopName}\n• Plan Selected: ${plan.name} (${plan.durationDays} Days)\n• Amount Paid: ₹${payment.amount}\n• Activation Date: ${startDate.toLocaleDateString()}\n• Expiry Date: ${newExpiry.toLocaleDateString()}\n\nYour ERP modules have been unlocked. Thank you for choosing Orbit Super Market ERP!\n\nBest regards,\nOrbit Super Market ERP Admin`
    });

    res.json({ success: true, message: 'Payment approved successfully. Subscription activated and ERP unlocked.', data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const { remarks } = req.body;
    const payment = await PaymentRequest.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment request not found' });
    }

    payment.status = 'Rejected';
    payment.approvedBy = req.user._id;
    payment.verifiedAt = new Date();
    payment.remarks = remarks || '';
    await payment.save();

    const owner = await User.findById(payment.ownerId);
    if (owner) {
      // Keep subscription expired/locked
      if (owner.subscriptionEndDate < new Date()) {
        owner.subscriptionStatus = 'expired';
        await owner.save();
      }

      await sendEmail({
        to: owner.email,
        subject: 'Payment Verification Failed - Orbit Super Market ERP',
        body: `Dear ${owner.name},\n\nWe were unable to verify your manual payment reference (UTR: ${payment.transactionRef}).\n\nYour payment submission has been rejected and your ERP account remains locked.\n\nPlease verify your payment UTR / Transaction details and submit again, or contact Orbit ERP support.\n\nBest regards,\nOrbit Super Market ERP Admin`
      });
    }

    res.json({ success: true, message: 'Payment reference rejected.', data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changeSubscription = async (req, res) => {
  const { id } = req.params;
  const { planId } = req.body;

  try {
    const owner = await User.findById(id);
    if (!owner || owner.role !== 'owner') {
      return res.status(404).json({ success: false, message: 'Owner / Shop not found' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Billing Plan not found' });
    }

    const baseDate = owner.subscriptionEndDate > new Date() ? owner.subscriptionEndDate : new Date();
    const newExpiry = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    owner.subscriptionStatus = 'active';
    owner.subscriptionStartDate = new Date();
    owner.subscriptionEndDate = newExpiry;
    owner.planName = plan.name;
    await owner.save();

    const { sendEmail } = require('../utils/mailService');
    await sendEmail({
      to: owner.email,
      subject: 'Subscription Plan Changed',
      body: `Hi ${owner.name},\n\nYour supermarket subscription plan for '${owner.shopName}' has been changed to '${plan.name}' by the Super Admin.\n\nYour subscription is now valid until ${newExpiry.toLocaleDateString()}.\n\nBest regards,\nSaaS Admin`
    });

    res.json({ success: true, message: `Subscription changed to ${plan.name} successfully`, data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const GlobalConfig = require('../models/GlobalConfig');

exports.getGlobalConfig = async (req, res) => {
  try {
    const upiIdConfig = await GlobalConfig.findOne({ key: 'platform_upi_id' });
    const merchantConfig = await GlobalConfig.findOne({ key: 'platform_merchant_name' });

    res.json({
      success: true,
      data: {
        platformUpiId: upiIdConfig ? upiIdConfig.value : 'market@upi',
        platformMerchantName: merchantConfig ? merchantConfig.value : 'Super Market'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateGlobalConfig = async (req, res) => {
  try {
    const { platformUpiId, platformMerchantName } = req.body;
    if (!platformUpiId || !platformMerchantName) {
      return res.status(400).json({ success: false, message: 'UPI ID and Merchant Name are required' });
    }

    await GlobalConfig.findOneAndUpdate(
      { key: 'platform_upi_id' },
      { value: platformUpiId },
      { upsert: true, new: true }
    );

    await GlobalConfig.findOneAndUpdate(
      { key: 'platform_merchant_name' },
      { value: platformMerchantName },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Platform UPI configurations updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
