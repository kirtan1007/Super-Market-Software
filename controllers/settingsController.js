const mongoose = require('mongoose');
const User = require('../models/User');
const Setting = require('../models/Setting');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// @desc    Get current system settings
// @route   GET /api/settings
// @access  Private
exports.getSettings = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    let settings = await Setting.findOne({ owner: ownerId });
    if (!settings) {
      settings = await Setting.create({ 
        owner: ownerId,
        ownerId: req.ownerId || ownerId,
        shopId: req.shopId || ownerId.toString(),
        tenantId: req.tenantId || ownerId.toString(),
        shopName: req.user.role === 'owner' && req.user.shopName ? req.user.shopName : 'Super Market'
      });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private (Owner Only)
exports.updateSettings = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    let settings = await Setting.findOne({ owner: ownerId });
    if (!settings) {
      req.body.owner = ownerId;
      req.body.ownerId = req.ownerId || ownerId;
      req.body.shopId = req.shopId || ownerId.toString();
      req.body.tenantId = req.tenantId || ownerId.toString();
      settings = await Setting.create(req.body);
    } else {
      settings = await Setting.findOneAndUpdate({ owner: ownerId }, req.body, {
        new: true,
        runValidators: true
      });
    }

    await logActivity(req, 'Update Settings', 'Shop settings configurations updated');

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload shop logo
// @route   POST /api/settings/logo
// @access  Private (Owner Only)
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    let settings = await Setting.findOne({ owner: ownerId });
    if (!settings) {
      settings = await Setting.create({ 
        owner: ownerId,
        ownerId: req.ownerId || ownerId,
        shopId: req.shopId || ownerId.toString(),
        tenantId: req.tenantId || ownerId.toString()
      });
    }

    // Delete old logo
    if (settings.shopLogo && settings.shopLogo.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'public', settings.shopLogo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const ownerIdStr = ownerId.toString();
    settings.shopLogo = `/uploads/owners/${ownerIdStr}/logo/${req.file.filename}`;
    if (!settings.ownerId) settings.ownerId = req.ownerId || ownerId;
    if (!settings.shopId) settings.shopId = req.shopId || ownerId.toString();
    if (!settings.tenantId) settings.tenantId = req.tenantId || ownerId.toString();
    await settings.save();

    await logActivity(req, 'Upload Shop Logo', 'Brand logo image updated');

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload Owner UPI QR Code image
// @route   POST /api/settings/upi-qr
// @access  Private (Owner Only)
exports.uploadUpiQrImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    let settings = await Setting.findOne({ owner: ownerId });
    if (!settings) {
      settings = await Setting.create({ 
        owner: ownerId,
        ownerId: req.ownerId || ownerId,
        shopId: req.shopId || ownerId.toString(),
        tenantId: req.tenantId || ownerId.toString()
      });
    }

    // Delete old UPI QR image
    if (settings.upiQrImage && settings.upiQrImage.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'public', settings.upiQrImage);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const ownerIdStr = ownerId.toString();
    settings.upiQrImage = `/uploads/owners/${ownerIdStr}/qr/${req.file.filename}`;
    if (!settings.ownerId) settings.ownerId = req.ownerId || ownerId;
    if (!settings.shopId) settings.shopId = req.shopId || ownerId.toString();
    if (!settings.tenantId) settings.tenantId = req.tenantId || ownerId.toString();
    await settings.save();

    await logActivity(req, 'Upload UPI QR Image', 'Owner UPI QR code image updated');

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get activity logs (Audit Trail)
// @route   GET /api/settings/logs
// @access  Private (Owner Only)
exports.getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset all store/owner data
// @route   POST /api/settings/reset
// @access  Private (Owner Only)
exports.resetStoreData = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to confirm data reset' });
    }

    // Verify owner's password
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Data reset cancelled.' });
    }

    const ownerId = req.user._id;

    // 1. Delete uploaded files (logo & UPI QR)
    const settings = await Setting.findOne({ owner: ownerId });
    if (settings) {
      if (settings.shopLogo && settings.shopLogo.startsWith('/uploads/')) {
        const logoPath = path.join(__dirname, '..', 'public', settings.shopLogo);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }
      if (settings.upiQrImage && settings.upiQrImage.startsWith('/uploads/')) {
        const qrPath = path.join(__dirname, '..', 'public', settings.upiQrImage);
        if (fs.existsSync(qrPath)) {
          fs.unlinkSync(qrPath);
        }
      }
    }

    // 2. Drop the tenant-scoped database
    if (req.databaseName) {
      await mongoose.connection.useDb(req.databaseName).dropDatabase();
    }

    // 3. Find all workers under this owner
    const workers = await User.find({ ownerId });
    const workerIds = workers.map(w => w._id);
    const allUserIds = [ownerId, ...workerIds];

    // 4. Delete login history for owner and workers
    const LoginHistory = require('../models/LoginHistory');
    await LoginHistory.deleteMany({ user: { $in: allUserIds } });

    // 5. Delete OTP verifications for owner and workers
    const OtpVerification = require('../models/OtpVerification');
    const emails = [req.user.email, ...workers.map(w => w.email).filter(Boolean)];
    await OtpVerification.deleteMany({ email: { $in: emails } });

    // 6. Delete workers themselves (excluding the owner)
    await User.deleteMany({ ownerId, role: { $ne: 'owner' } });

    // 7. Delete activity logs for owner and workers
    await ActivityLog.deleteMany({ user: { $in: allUserIds } });

    // 8. Log the reset action as a clean single entry
    await logActivity(req, 'Reset Store Data', 'All store transactional and master data has been reset by the owner');

    res.status(200).json({
      success: true,
      message: 'All store data has been reset successfully. Please log in again.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Permanently delete owner account and all associated tenant data
// @route   POST /api/settings/delete-account
// @access  Private (Owner Only)
exports.deleteOwnerAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to confirm account deletion' });
    }

    // Verify owner's password
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Account deletion cancelled.' });
    }

    const ownerId = req.user._id;

    // 1. Delete uploaded files recursively
    const settings = await Setting.findOne({ owner: ownerId });
    if (settings) {
      if (settings.shopLogo && settings.shopLogo.startsWith('/uploads/')) {
        const logoPath = path.join(__dirname, '..', 'public', settings.shopLogo);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }
      if (settings.upiQrImage && settings.upiQrImage.startsWith('/uploads/')) {
        const qrPath = path.join(__dirname, '..', 'public', settings.upiQrImage);
        if (fs.existsSync(qrPath)) {
          fs.unlinkSync(qrPath);
        }
      }
    }

    // Delete the entire owner uploads directory if it exists
    const ownerIdStr = ownerId.toString();
    const ownerUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerIdStr);
    if (fs.existsSync(ownerUploadsDir)) {
      fs.rmSync(ownerUploadsDir, { recursive: true, force: true });
    }

    // 2. Drop the tenant-scoped database
    if (req.databaseName) {
      await mongoose.connection.useDb(req.databaseName).dropDatabase();
    }

    // 3. Find all workers under this owner
    const workers = await User.find({ ownerId });
    const workerIds = workers.map(w => w._id);
    const allUserIds = [ownerId, ...workerIds];

    // 4. Delete login history for owner and workers
    const LoginHistory = require('../models/LoginHistory');
    await LoginHistory.deleteMany({ user: { $in: allUserIds } });

    // 5. Delete OTP verifications for owner and workers
    const OtpVerification = require('../models/OtpVerification');
    const emails = [req.user.email, ...workers.map(w => w.email).filter(Boolean)];
    await OtpVerification.deleteMany({ email: { $in: emails } });

    // 6. Delete all payment requests for this owner
    const PaymentRequest = require('../models/PaymentRequest');
    await PaymentRequest.deleteMany({ ownerId });

    // 7. Delete settings associated with the owner (globally if any, and tenant proxy cache)
    await Setting.deleteMany({ owner: ownerId });

    // 8. Delete workers themselves (excluding the owner)
    await User.deleteMany({ ownerId, role: { $ne: 'owner' } });

    // 9. Delete activity logs for owner and workers
    await ActivityLog.deleteMany({ user: { $in: allUserIds } });

    // 10. Delete the Owner User account itself from database
    await User.deleteOne({ _id: ownerId });

    res.status(200).json({
      success: true,
      message: 'Your account and all associated store data have been permanently deleted.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

