const User = require('../models/User');
const { sendEmail } = require('./mailService');

/**
 * Periodically scans for subscription expirations and dispatches automated reminder emails:
 * - 5 days before expiry
 * - 3 days before expiry
 * - 1 day before expiry
 * - On expiry day
 * - After expiry (Locks account and requests renewal)
 */
const runSubscriptionCheck = async () => {
  try {
    console.log('Running Orbit Super Market ERP Subscription Expiration Scan...');
    const now = new Date();

    // 1. Process active/trial owners for reminders & expiry transitions
    const activeOwners = await User.find({
      role: 'owner',
      subscriptionStatus: { $in: ['trial', 'active'] }
    });

    for (const owner of activeOwners) {
      const expiryDateVal = owner.subscriptionEndDate || owner.trialEndDate;
      if (!expiryDateVal) continue;

      const expiry = new Date(expiryDateVal);
      const remainingMs = expiry.getTime() - now.getTime();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      // Initialize array if missing
      if (!Array.isArray(owner.reminderSentDays)) {
        owner.reminderSentDays = [];
      }

      // A. Check Expiry
      if (remainingMs <= 0) {
        owner.subscriptionStatus = 'expired';
        await owner.save();

        await sendEmail({
          to: owner.email,
          subject: 'Subscription Expired',
          body: `Dear ${owner.name},\n\nYour ERP subscription has expired.\n\nPlease renew your subscription.\n\nUntil approval is completed,\nyour ERP account will remain locked.\n\nThank you.\n\nOrbit Super Market ERP Support`
        });
        console.log(`[Subscription Scan] Auto-expired subscription for owner: ${owner.username} (${owner.shopName})`);
        continue;
      }

      // B. Reminders: 5 days, 3 days, 1 day, 0 days
      const reminderThresholds = [5, 3, 1, 0];
      if (reminderThresholds.includes(remainingDays) && !owner.reminderSentDays.includes(remainingDays)) {
        const daysText = remainingDays === 0 ? 'today' : `in ${remainingDays} day(s)`;
        
        await sendEmail({
          to: owner.email,
          subject: 'Your Orbit Super Market ERP Subscription is Expiring',
          body: `Dear ${owner.name},\n\nYour ERP subscription will expire ${daysText}.\n\nPlease renew your subscription before the expiry date to avoid interruption of service.\n\nThank you.\n\nOrbit Super Market ERP Team`
        });

        owner.reminderSentDays.push(remainingDays);
        await owner.save();
        console.log(`[Subscription Scan] Sent ${remainingDays}-day expiry reminder to ${owner.username}`);
      }
    }
  } catch (err) {
    console.error('Subscription expiration check job error:', err);
  }
};

module.exports = runSubscriptionCheck;
