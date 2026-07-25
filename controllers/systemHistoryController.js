const StockHistory = require('../models/StockHistory');
const LoginHistory = require('../models/LoginHistory');
const OtpVerification = require('../models/OtpVerification');
const { logActivity } = require('../middleware/auth');

// --- Stock History ---
exports.getStockHistory = async (req, res) => {
  try {
    const history = await StockHistory.find().populate('product', 'name barcode').populate('recordedBy', 'name').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteStockHistory = async (req, res) => {
  try {
    const history = await StockHistory.findById(req.params.id);
    if (!history) {
      return res.status(404).json({ success: false, message: 'Stock history record not found' });
    }
    await history.deleteOne();
    await logActivity(req, 'Delete Stock History', `Stock history record deleted for product ID ${history.product}`);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Login History ---
exports.getLoginHistory = async (req, res) => {
  try {
    const history = await LoginHistory.find().populate('user', 'name role').populate('customer', 'name').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLoginHistory = async (req, res) => {
  try {
    const history = await LoginHistory.findById(req.params.id);
    if (!history) {
      return res.status(404).json({ success: false, message: 'Login history record not found' });
    }
    await history.deleteOne();
    await logActivity(req, 'Delete Login History', `Login history record for username ${history.username} deleted`);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- OTP Verification ---
exports.getOtpVerifications = async (req, res) => {
  try {
    const verifications = await OtpVerification.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: verifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOtpVerification = async (req, res) => {
  try {
    const verification = await OtpVerification.findById(req.params.id);
    if (!verification) {
      return res.status(404).json({ success: false, message: 'OTP verification record not found' });
    }
    await verification.deleteOne();
    await logActivity(req, 'Delete OTP Verification Record', `OTP record for email ${verification.email} deleted`);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
