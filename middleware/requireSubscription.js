const User = require('../models/User');
const { sendEmail } = require('../utils/mailService');

/**
 * Middleware that checks if the request's tenant owner has an active,
 * non-expired subscription. Super Admins bypass this block automatically.
 */
const requireSubscription = async (req, res, next) => {
  try {
    // 1. Super Admins bypass subscription checks
    if (req.user && req.user.role === 'superadmin') {
      return next();
    }

    // 2. Identify the owner of the tenant
    let owner = null;
    if (req.user.role === 'owner') {
      owner = req.user;
    } else if (req.user.createdBy) {
      owner = await User.findById(req.user.createdBy);
    }

    if (!owner) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access Denied: Owner account not found.' 
      });
    }

    // 3. Check if suspended
    if (owner.subscriptionStatus === 'suspended' || !owner.active || owner.isDeleted) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your shop account has been suspended or deleted by Super Admin.', 
        code: 'SUBSCRIPTION_EXPIRED' 
      });
    }

    // 4. Check if expired
    const now = new Date();
    const expiry = owner.subscriptionEndDate || owner.trialEndDate;

    if (!expiry || now > new Date(expiry)) {
      if (owner.subscriptionStatus !== 'expired') {
        // Transition to expired state
        owner.subscriptionStatus = 'expired';
        await User.updateOne({ _id: owner._id }, { $set: { subscriptionStatus: 'expired' } });

        // Trigger notification email
        await sendEmail({
          to: owner.email,
          subject: 'Your Subscription has Expired!',
          body: `Hi ${owner.name},\n\nYour trial/subscription for '${owner.shopName}' has expired. Please log in and choose a subscription plan to reactivate billing and operations.\n\nBest regards,\nSaaS Admin`
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Your subscription or free trial has expired.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    next();
  } catch (err) {
    console.error('Subscription verification error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify subscription status.' 
    });
  }
};

module.exports = requireSubscription;
