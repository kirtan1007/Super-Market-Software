const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Protect routes
const protect = async (req, res, next) => {
  let token;

  // Check header or cookies
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_super_market_software_jwt_token_key_12345');
    
    // Find user
    const user = await User.findById(decoded.id);
    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: 'User account is inactive or deleted' });
    }

    req.user = user;
    
    // Resolve SaaS Multi-tenant parameters
    let ownerId = null;
    let shopId = null;
    let tenantId = null;
    let databaseName = null;

    if (user.role !== 'superadmin') {
      ownerId = user.ownerId || (user.role === 'owner' ? user._id : user.createdBy);
      shopId = user.shopId || (user.role === 'owner' ? user._id.toString() : user.createdBy.toString());
      tenantId = user.tenantId || (user.role === 'owner' ? user._id.toString() : user.createdBy.toString());

      // Verify explicit tenant parameter manipulation attacks
      const incomingOwnerId = req.query.ownerId || req.body.ownerId || req.params.ownerId;
      if (incomingOwnerId && incomingOwnerId.toString() !== ownerId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access Denied: Tenant ID mismatch. Manually modifying tenant URLs/payloads is prohibited.' 
        });
      }

      const incomingTenantId = req.query.tenantId || req.body.tenantId || req.params.tenantId;
      if (incomingTenantId && incomingTenantId.toString() !== tenantId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access Denied: Tenant ID mismatch.' 
        });
      }

      const incomingShopId = req.query.shopId || req.body.shopId || req.params.shopId;
      if (incomingShopId && incomingShopId.toString() !== shopId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access Denied: Shop ID mismatch.' 
        });
      }

      databaseName = user.databaseName;
      let shopName = user.shopName;
      let owner = null;
      if (user.role === 'owner') {
        owner = user;
      } else if (user.createdBy) {
        owner = await User.findById(user.createdBy);
      }

      if (owner) {
        // Real-time automatic subscription verification check
        const now = new Date();
        const expiry = owner.subscriptionEndDate || owner.trialEndDate;
        if (expiry && now > new Date(expiry) && ['active', 'trial'].includes(owner.subscriptionStatus)) {
          owner.subscriptionStatus = 'expired';
          await User.updateOne({ _id: owner._id }, { $set: { subscriptionStatus: 'expired' } });
          
          const { sendEmail } = require('../utils/mailService');
          try {
            await sendEmail({
              to: owner.email,
              subject: 'Your Subscription has Expired!',
              body: `Hi ${owner.name},\n\nYour trial/subscription for '${owner.shopName}' has expired. Please log in and choose a subscription plan to reactivate billing and operations.\n\nBest regards,\nSaaS Admin`
            });
          } catch (mailErr) {
            console.error('Failed to send real-time expiration email:', mailErr.message);
          }
        }

        // Synchronize context user properties
        user.subscriptionStatus = owner.subscriptionStatus;
        user.subscriptionEndDate = owner.subscriptionEndDate || owner.trialEndDate;
        user.planName = owner.planName;

        if (user.role !== 'owner') {
          databaseName = owner.databaseName;
          shopName = owner.shopName;
        }
      }

      if (!databaseName) {
        // Fallback for legacy users
        const shopSlug = (shopName || 'shop')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .substring(0, 6);
        databaseName = `tenant_${shopSlug}_${ownerId}`;
      }
    }

    req.ownerId = ownerId;
    req.shopId = shopId;
    req.tenantId = tenantId;
    req.databaseName = databaseName;

    const asyncLocalStorage = require('../config/tenantContext');
    asyncLocalStorage.run({ ownerId, shopId, tenantId, databaseName }, () => {
      next();
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired, please login again' });
  }
};

// Restore tenant context after middlewares that break AsyncLocalStorage (like multer)
const restoreTenantContext = (req, res, next) => {
  const asyncLocalStorage = require('../config/tenantContext');
  const ownerId = req.ownerId;
  const shopId = req.shopId;
  const tenantId = req.tenantId;
  const databaseName = req.databaseName;

  if (ownerId) {
    asyncLocalStorage.run({ ownerId, shopId, tenantId, databaseName }, () => {
      next();
    });
  } else {
    next();
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'none'}' is not authorized to access this resource`
      });
    }
    next();
  };
};

// Activity Logging utility
const logActivity = async (req, action, details) => {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await ActivityLog.create({
      user: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'system_guest',
      role: req.user ? req.user.role : 'guest',
      action,
      details,
      ipAddress
    });
  } catch (err) {
    console.error('Logging error:', err.message);
  }
};

module.exports = {
  protect,
  restoreTenantContext,
  authorize,
  logActivity
};
