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

// @desc    Send OTP to owner's email for account deletion verification
// @route   POST /api/settings/delete-account/send-otp
// @access  Private (Owner Only)
exports.sendDeleteAccountOtp = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const user = await User.findById(ownerId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      return res.status(500).json({
        success: false,
        message: 'Email service configuration error: EMAIL_USER and EMAIL_PASS environment variables must be set in .env.'
      });
    }

    const cleanedPass = emailPass.replace(/\s+/g, '');
    if (cleanedPass.length !== 16) {
      return res.status(500).json({
        success: false,
        message: 'Email service configuration error: EMAIL_PASS must be a valid 16-character Google App Password.'
      });
    }

    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    const OtpVerification = require('../models/OtpVerification');

    // Generate secure 6-digit random OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save/update OtpVerification record
    await OtpVerification.create({
      email: user.email,
      otp: hashedOtp,
      purpose: 'Account Deletion',
      status: 'Pending',
      expiresAt: otpExpires
    });

    // Save to MailLog as a fallback so user can check it in MongoDB Atlas if email fails
    const MailLog = require('../models/MailLog');
    await MailLog.create({
      to: user.email,
      subject: 'Super Market - Permanent Account Deletion OTP',
      body: `Hello ${user.name},\n\nYour account deletion OTP code is: ${otp}`
    });

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: cleanedPass
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000
    });

    const mailOptions = {
      from: `"Super Market" <${emailUser}>`,
      to: user.email,
      subject: 'Super Market - Permanent Account Deletion OTP',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e7eb; border-radius: 12px; background-color: #ffffff; color: #1f1e29;">
          <div style="text-align: center; border-bottom: 2px solid #ff3366; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #ff3366; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Super Market</h1>
            <p style="color: #8c899c; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Security Deletion System</p>
          </div>
          <div style="padding: 10px 0;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${user.name}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">We received a request to PERMANENTLY DELETE your account. Please use the following 6-digit One-Time Password (OTP) to verify your identity. This OTP is valid for <strong>5 minutes</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 6px; padding: 12px 30px; background-color: #fce8e6; border: 1px solid #f5c2c2; border-radius: 8px; color: #cc0000; text-shadow: 1px 1px 0px #fff;">${otp}</span>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #d80064; font-weight: 600; margin: 0 0 24px 0;">Security warning: For your protection, do NOT share this OTP with anyone. Support will never ask you for this code. If you did not request this code, please ignore this email.</p>
          </div>
          <div style="border-top: 1px dashed #e4e7eb; padding-top: 20px; text-align: center; font-size: 12px; color: #8c899c;">
            <p style="margin: 0 0 5px 0;">This is an automated security transmission. Please do not reply to this email.</p>
            <p style="margin: 0;">&copy; 2026 Super Market Management System</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: 'OTP sent to your registered email address successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Permanently delete owner account and all associated tenant data
// @route   POST /api/settings/delete-account
// @access  Private (Owner Only)
exports.deleteOwnerAccount = async (req, res) => {
  try {
    const { password, otp } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to confirm account deletion' });
    }
    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP is required to confirm account deletion' });
    }

    // Verify owner's password
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Account deletion cancelled.' });
    }

    // Verify OTP
    const OtpVerification = require('../models/OtpVerification');
    const otpRec = await OtpVerification.findOne({ email: user.email, purpose: 'Account Deletion', status: 'Pending' }).sort({ createdAt: -1 });
    if (!otpRec) {
      return res.status(400).json({ success: false, message: 'No OTP requested for account deletion or OTP already used.' });
    }

    if (otpRec.expiresAt < Date.now()) {
      otpRec.status = 'Expired';
      await otpRec.save();
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const bcrypt = require('bcryptjs');
    const isOtpMatch = await bcrypt.compare(otp, otpRec.otp);
    if (!isOtpMatch) {
      otpRec.attempts += 1;
      if (otpRec.attempts >= 5) {
        otpRec.status = 'MaxAttemptsExceeded';
      }
      await otpRec.save();
      return res.status(400).json({ success: false, message: 'Invalid OTP. Verification failed.' });
    }

    // Mark OTP as used
    otpRec.status = 'Used';
    await otpRec.save();

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
    await OtpVerification.deleteMany({ email: { $in: [user.email, ...workers.map(w => w.email).filter(Boolean)] } });

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

