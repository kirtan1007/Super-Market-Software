const User = require('../models/User');
const Plan = require('../models/Plan');

const ensureSuperAdmin = async () => {
  try {
    const adminUsername = process.env.ADMIN_DEFAULT_USER || 'kirtan_panchal';
    const adminPassword = process.env.ADMIN_DEFAULT_PASS || 'kirtan_panchal';
    const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'kirtanpanchal2006@gmail.com';

    let superadmin = await User.findOne({ role: 'superadmin' });
    if (!superadmin) {
      console.log('No superadmin user found. Seeding default superadmin...');
      await User.create({
        name: 'SaaS Super Admin',
        username: adminUsername,
        email: adminEmail,
        mobile: '9574646343',
        password: adminPassword,
        role: 'superadmin',
        active: true
      });
      console.log('Default superadmin seeded successfully.');
    } else {
      // Ensure superadmin has correct credentials from environment
      superadmin.username = adminUsername;
      superadmin.email = adminEmail;
      superadmin.active = true;
      superadmin.password = adminPassword;
      await superadmin.save();
      console.log('Superadmin user verified and updated.');
    }

    // Seed Subscription Plans if missing
    const planCount = await Plan.countDocuments();
    if (planCount === 0) {
      console.log('No subscription plans found. Seeding default plans...');
      const plansData = [
        { name: '1 Month', price: 499, durationDays: 30, description: '30 Days Full Premium Access', active: true },
        { name: '3 Months', price: 1399, durationDays: 90, description: '90 Days Discounted Access', active: true },
        { name: '6 Months', price: 2499, durationDays: 180, description: '180 Days Value Access', active: true },
        { name: '12 Months', price: 4499, durationDays: 365, description: '365 Days Full Access', active: true }
      ];
      await Plan.insertMany(plansData);
      console.log('Subscription plans seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding/verifying superadmin:', err.message);
  }
};

module.exports = ensureSuperAdmin;
