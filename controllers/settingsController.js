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
      settings = await Setting.create({ owner: ownerId });
    }

    // Delete old logo
    if (settings.shopLogo && settings.shopLogo.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'public', settings.shopLogo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    settings.shopLogo = `/uploads/${req.file.filename}`;
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
      settings = await Setting.create({ owner: ownerId });
    }

    // Delete old UPI QR image
    if (settings.upiQrImage && settings.upiQrImage.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'public', settings.upiQrImage);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    settings.upiQrImage = `/uploads/${req.file.filename}`;
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
