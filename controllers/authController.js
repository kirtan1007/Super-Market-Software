const User = require('../models/User');
const Setting = require('../models/Setting');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const LoginHistory = require('../models/LoginHistory');
const OtpVerification = require('../models/OtpVerification');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

// Generate JWT Token
const generateToken = (id, rememberMe = false) => {
  // If Remember Me is on: 7 days. If off: 8 hours (expires with typical work day)
  const expiresIn = rememberMe
    ? (process.env.JWT_EXPIRES_IN || '7d')
    : (process.env.JWT_SESSION_EXPIRES_IN || '8h');
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'super_secret_super_market_software_jwt_token_key_12345',
    { expiresIn }
  );
};

// Set token cookie
// rememberMe=true  → persistent cookie (7 days)
// rememberMe=false → session cookie (no expires = cleared when browser closes)
const sendTokenResponse = (user, statusCode, res, rememberMe = false) => {
  const token = generateToken(user._id, rememberMe);

  const options = {
    httpOnly: true, // Prevent JS access (XSS protection)
    sameSite: 'Lax'
  };

  if (rememberMe) {
    // Persistent cookie — survives browser restart
    options.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  // If !rememberMe: no 'expires' → browser treats it as a SESSION cookie
  // (automatically deleted when the browser is closed)

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  // Remove password from response
  user.password = undefined;

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      rememberMe,
      user
    });
};

// @desc    Register Owner (Initial Account Creation)
// @route   POST /api/auth/register-owner
// @access  Public
exports.registerOwner = async (req, res) => {
  try {
    const { name, shopName, gstNumber, email, mobile, username, password, shopAddress, securityQuestions } = req.body;

    // Check if username already exists (excluding soft-deleted users)
    const usernameExists = await User.findOne({ username, isDeleted: { $ne: true } });
    if (usernameExists) {
      return res.status(400).json({ success: false, message: 'Username is already registered.' });
    }

    // Check if duplicate email, mobile, shopName, or gstNumber (excluding soft-deleted users)
    const orConditions = [
      { email },
      { mobile }
    ];
    if (shopName) {
      orConditions.push({ shopName: { $regex: new RegExp(`^${shopName.trim()}$`, 'i') } });
    }
    if (gstNumber) {
      orConditions.push({ gstNumber: { $regex: new RegExp(`^${gstNumber.trim()}$`, 'i') } });
    }

    const duplicateExists = await User.findOne({ $or: orConditions, isDeleted: { $ne: true } });
    if (duplicateExists) {
      let msg = 'Email or Mobile is already registered.';
      if (shopName && duplicateExists.shopName && duplicateExists.shopName.toLowerCase() === shopName.trim().toLowerCase()) {
        msg = `Shop Name "${shopName}" is already registered.`;
      } else if (gstNumber && duplicateExists.gstNumber && duplicateExists.gstNumber.toLowerCase() === gstNumber.trim().toLowerCase()) {
        msg = `GST Number "${gstNumber}" is already registered.`;
      } else if (duplicateExists.email === email) {
        msg = 'Email is already registered.';
      } else if (duplicateExists.mobile === mobile) {
        msg = 'Mobile number is already registered.';
      }
      return res.status(400).json({ success: false, message: msg });
    }

    if (!securityQuestions || securityQuestions.length < 2) {
      return res.status(400).json({ success: false, message: 'At least two security questions are required for account recovery.' });
    }

    const mongoose = require('mongoose');
    const ownerObjId = new mongoose.Types.ObjectId();
    const tenantId = 'TENANT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const shopId = 'SHOP-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const generateUniqueDbName = require('../config/dbNameGenerator');
    const databaseName = await generateUniqueDbName(shopName, User);

    const trialStartDate = new Date();
    const trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    // Create owner
    const user = await User.create({
      _id: ownerObjId,
      name,
      username,
      email,
      mobile,
      password,
      role: 'owner',
      shopName,
      databaseName,
      gstNumber,
      shopAddress,
      securityQuestions,
      ownerId: ownerObjId,
      tenantId,
      shopId,
      trialStartDate,
      trialEndDate,
      subscriptionStatus: 'trial',
      subscriptionEndDate: trialEndDate
    });

    // Create uploads folders for the new owner
    const fs = require('fs');
    const path = require('path');
    const ownerIdStr = ownerObjId.toString();
    const directories = [
      path.join(__dirname, '..', 'public', 'uploads'),
      path.join(__dirname, '..', 'public', 'uploads', 'owners'),
      path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerIdStr),
      path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerIdStr, 'logo'),
      path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerIdStr, 'qr')
    ];
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create isolated settings with the newly registered shop details
    const tenantContext = require('../config/tenantContext');
    await tenantContext.run({ ownerId: ownerObjId, shopId, tenantId, databaseName }, async () => {
      await Setting.create({
        owner: ownerObjId,
        ownerId: ownerObjId,
        tenantId,
        shopId,
        shopName,
        shopAddress,
        shopMobile: mobile,
        shopEmail: email,
        gstNumber
      });
    });

    // Send Welcome & Trial Started email
    const { sendEmail } = require('../utils/mailService');
    await sendEmail({
      to: email,
      subject: 'Welcome to Super Market - Trial Started',
      body: `Hi ${name},\n\nWelcome to ${shopName || 'Super Market'}! Your 3-Day Free Trial has started. It will expire on ${trialEndDate.toLocaleDateString()}.\n\nBest regards,\nSaaS Admin`
    });

    await logActivity(req, 'Register Owner', `Owner account '${username}' created for '${shopName}'`);

    sendTokenResponse(user, 201, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login Owner/Worker
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { username, password, rememberMe = false } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username and password' });
    }

    // Check for user
    const user = await User.findOne({ username }).select('+password');
    if (!user || !user.active) {
      // Log failed login
      await LoginHistory.create({
        username,
        role: 'unknown',
        status: 'Failed',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      // Log failed login
      await LoginHistory.create({
        user: user._id,
        username,
        role: user.role,
        status: 'Failed',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Log success login
    await LoginHistory.create({
      user: user._id,
      username,
      role: user.role,
      status: 'Success',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Auto check-in and employee record verification for cashiers/workers
    if (user.role === 'owner') {
      const ownerId = user._id;
      const shopId = user.shopId || ownerId.toString();
      const tenantId = user.tenantId || ownerId.toString();
      let databaseName = user.databaseName;
      if (!databaseName) {
        const shopSlug = (user.shopName || 'shop')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .substring(0, 6);
        databaseName = `tenant_${shopSlug}_${ownerId}`;
      }
      
      // Auto-recreate missing directories
      const fs = require('fs');
      const path = require('path');
      const ownerIdStr = ownerId.toString();
      const directories = [
        path.join(__dirname, '..', 'public', 'uploads'),
        path.join(__dirname, '..', 'public', 'uploads', 'owners'),
        path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerIdStr),
        path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerIdStr, 'logo'),
        path.join(__dirname, '..', 'public', 'uploads', 'owners', ownerIdStr, 'qr')
      ];
      directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Auto-recreate missing settings
      const tenantContext = require('../config/tenantContext');
      await tenantContext.run({ ownerId, shopId, tenantId, databaseName }, async () => {
        let settings = await Setting.findOne({ owner: ownerId });
        if (!settings) {
          await Setting.create({
            owner: ownerId,
            ownerId,
            shopId,
            tenantId,
            shopName: user.shopName || 'Super Market',
            shopAddress: user.shopAddress || '123 Galaxy Way, Sector 5, Super Market City',
            shopMobile: user.mobile || '9876543210',
            shopEmail: user.email || 'contact@supermarketsoftware.com',
            gstNumber: user.gstNumber || '22AAAAA0000A1Z5'
          });
        }
      });
    }

    if (user.role === 'worker') {
      const todayStr = new Date().toISOString().split('T')[0];
      const recordExists = await Attendance.findOne({ employee: user._id, date: todayStr });
      if (!recordExists) {
        await Attendance.create({
          employee: user._id,
          date: todayStr,
          checkIn: new Date(),
          status: 'Present'
        });
      }

      const employeeExists = await Employee.findOne({ user: user._id });
      if (!employeeExists) {
        await Employee.create({
          user: user._id,
          salary: 15000,
          department: 'Sales',
          status: 'Active'
        });
      }
    }

    req.user = user; // For logActivity reference
    await logActivity(req, 'Login', `User '${username}' logged in successfully (rememberMe=${rememberMe})`);

    // Trigger background Expiry Check on login
    const runExpiryCheck = require('../utils/expiryCheckJob');
    runExpiryCheck();

    sendTokenResponse(user, 200, res, rememberMe === true || rememberMe === 'true');
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Step 1: Check user & return security questions
// @route   POST /api/auth/forgot-password-verify-user
// @access  Public
exports.forgotPasswordVerifyUser = async (req, res) => {
  try {
    const { username } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Username not found' });
    }

    // Only owner can recover this way (or workers if questions present, but workers are reset by Owner. Still, let's keep it safe)
    if (user.role === 'worker') {
      return res.status(403).json({ success: false, message: 'Workers must contact Owner to reset their passwords.' });
    }

    const questions = user.securityQuestions.map(q => q.question);
    res.status(200).json({
      success: true,
      questions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Step 2: Verify security questions & generate OTP
// @route   POST /api/auth/forgot-password-verify-answers
// @access  Public
exports.forgotPasswordVerifyAnswers = async (req, res) => {
  try {
    const { username, answers } = req.body; // answers: [{ question: '...', answer: '...' }]

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Username not found' });
    }

    // Check answers
    let correctCount = 0;
    user.securityQuestions.forEach(sq => {
      const matchedAnswer = answers.find(a => a.question.trim().toLowerCase() === sq.question.trim().toLowerCase());
      if (matchedAnswer && matchedAnswer.answer.trim().toLowerCase() === sq.answer.trim().toLowerCase()) {
        correctCount++;
      }
    });

    if (correctCount < user.securityQuestions.length) {
      return res.status(400).json({ success: false, message: 'Incorrect security answers.' });
    }

    // Generate 6 digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Security answers verified successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Step 3: Reset password using OTP
// @route   POST /api/auth/forgot-password-reset
// @access  Public
exports.forgotPasswordReset = async (req, res) => {
  try {
    const { username, otp, newPassword } = req.body;

    const user = await User.findOne({
      username,
      resetOtp: otp,
      resetOtpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Update password
    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    // req.user is set by protect middleware
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout user & clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    await logActivity(req, 'Logout', `User '${req.user.username}' logged out`);

    // Expire the cookie immediately — covers both session and persistent cookies
    res.cookie('token', 'none', {
      expires:  new Date(0), // Past date = immediate expiry
      maxAge:   0,
      httpOnly: true,
      sameSite: 'Lax'
    });

    res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if Owner setup is complete
// @route   GET /api/auth/setup-status
// @access  Public
exports.getSetupStatus = async (req, res) => {
  try {
    const owner = await User.findOne({ role: 'owner', isDeleted: { $ne: true } });
    let shopLogo = '';
    let shopName = 'Super Market';
    if (owner) {
      const Setting = require('../models/Setting');
      const settings = await Setting.findOne({ owner: owner._id });
      if (settings) {
        shopLogo = settings.shopLogo || '';
        shopName = settings.shopName || owner.shopName || 'Super Market';
      } else {
        shopName = owner.shopName || 'Super Market';
      }
    }
    res.status(200).json({
      success: true,
      setupRequired: !owner,
      shopName,
      shopLogo
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Send OTP to registered email
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOtp = async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    // Format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    let user;
    if (username && username.trim()) {
      user = await User.findOne({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase()
      });
      if (!user) {
        return res.status(404).json({ success: false, message: 'No account found matching this username and email address' });
      }
    } else {
      user = await User.findOne({ email: email.trim().toLowerCase() });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found with this email address' });
      }
    }

    // 1. Verify Gmail SMTP Credentials in Environment Variables
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      return res.status(500).json({
        success: false,
        message: 'Email service configuration error: EMAIL_USER and EMAIL_PASS environment variables must be set in .env.'
      });
    }

    // Strip spaces if any from 16-character Google App Password (e.g., "abcd efgh ijkl mnop")
    const cleanedPass = emailPass.replace(/\s+/g, '');
    if (cleanedPass.length !== 16) {
      return res.status(500).json({
        success: false,
        message: 'Email service configuration error: EMAIL_PASS must be a valid 16-character Google App Password.'
      });
    }

    // 2. Generate secure 6-digit random OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    // 3. Hash the OTP before saving in DB
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save to user model
    user.resetOtp = hashedOtp;
    user.resetOtpExpires = otpExpires;
    user.resetOtpAttempts = 0; // reset attempts
    user.isOtpVerified = false; // reset verification status
    await user.save();

    // Log to OtpVerification collection
    await OtpVerification.create({
      email: user.email,
      otp: hashedOtp,
      purpose: 'Password Reset',
      status: 'Pending',
      expiresAt: otpExpires
    });

    // 4. Configure Nodemailer Gmail SMTP Transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: cleanedPass
      }
    });

    const mailOptions = {
      from: `"Super Market" <${emailUser}>`,
      to: user.email,
      subject: 'Super Market - Password Reset OTP',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e7eb; border-radius: 12px; background-color: #ffffff; color: #1f1e29;">
          <div style="text-align: center; border-bottom: 2px solid #00d2ff; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #0072ff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Super Market</h1>
            <p style="color: #8c899c; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Security Recovery System</p>
          </div>
          <div style="padding: 10px 0;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${user.name}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">We received a request to reset your account password. Please use the following 6-digit One-Time Password (OTP) to verify your identity. This OTP is valid for <strong>5 minutes</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 6px; padding: 12px 30px; background-color: #f0f2f5; border: 1px solid #dcdbe2; border-radius: 8px; color: #000000; text-shadow: 1px 1px 0px #fff;">${otp}</span>
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
    
    res.status(200).json({ success: true, message: 'OTP code sent successfully to your registered email address.' });
  } catch (error) {
    res.status(500).json({ success: false, message: `Failed to send OTP email: ${error.message}. Please verify your Gmail SMTP credentials in .env.` });
  }
};

// @desc    Verify OTP code
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ success: false, message: 'No OTP requested for this user' });
    }

    // Find latest pending OtpVerification record
    const otpRec = await OtpVerification.findOne({ email, purpose: 'Password Reset', status: 'Pending' }).sort({ createdAt: -1 });

    // Check expiry
    if (user.resetOtpExpires < Date.now()) {
      user.resetOtp = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = 0;
      await user.save();

      if (otpRec) {
        otpRec.status = 'Expired';
        await otpRec.save();
      }

      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Check attempts limit
    if (user.resetOtpAttempts >= 5) {
      if (otpRec) {
        otpRec.status = 'MaxAttemptsExceeded';
        await otpRec.save();
      }
      return res.status(400).json({ success: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' });
    }

    // Increment attempts
    user.resetOtpAttempts += 1;
    if (otpRec) {
      otpRec.attempts += 1;
      await otpRec.save();
    }

    // Verify OTP using bcrypt
    const isMatch = await bcrypt.compare(otp, user.resetOtp);
    if (!isMatch) {
      await user.save();
      const remaining = 5 - user.resetOtpAttempts;
      if (remaining <= 0) {
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        user.resetOtpAttempts = 0;
        await user.save();

        if (otpRec) {
          otpRec.status = 'MaxAttemptsExceeded';
          await otpRec.save();
        }

        return res.status(400).json({ success: false, message: 'Attempts exceeded. This OTP has been deactivated. Please request a new one.' });
      }
      return res.status(400).json({ success: false, message: `Invalid OTP code. ${remaining} attempts remaining.` });
    }

    // Success: mark as verified and clear OTP
    user.isOtpVerified = true;
    user.otpVerifiedExpires = Date.now() + 5 * 60 * 1000; // valid for 5 mins
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpAttempts = 0;
    await user.save();

    if (otpRec) {
      otpRec.status = 'Verified';
      await otpRec.save();
    }

    res.status(200).json({ success: true, message: 'OTP verified successfully. Proceed to reset password.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password after OTP verification
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Email, Password and Confirm Password are required' });
    }

    // Format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be minimum 6 characters long' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if verification flag is set and not expired
    if (!user.isOtpVerified || !user.otpVerifiedExpires || user.otpVerifiedExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Session expired or not verified. Please verify OTP first.' });
    }

    // Save new password (pre-save hook in model will automatically encrypt it)
    user.password = newPassword;
    user.isOtpVerified = false;
    user.otpVerifiedExpires = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password has been reset successfully. Please log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Owner password (for cashier override warnings)
// @route   POST /api/auth/verify-owner
// @access  Private
exports.verifyOwner = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Please provide password' });
    }

    const owners = await User.find({ role: 'owner', active: true }).select('+password');
    if (owners.length === 0) {
      return res.status(404).json({ success: false, message: 'No owner account registered' });
    }

    let isMatch = false;
    for (let owner of owners) {
      if (await owner.matchPassword(password)) {
        isMatch = true;
        break;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid owner password' });
    }

    res.status(200).json({ success: true, message: 'Owner override authorized' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


