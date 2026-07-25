const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Plan = require('../models/Plan');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function reset() {
  try {
    // 1. Read credentials from CLI arguments or secret .env variables
    const args = process.argv.slice(2);
    const customUsername = args[0] || process.env.ADMIN_DEFAULT_USER || 'kirtan_panchal';
    const customPassword = args[1] || process.env.ADMIN_DEFAULT_PASS || 'kirtan_panchal';
    const customEmail = args[2] || process.env.ADMIN_DEFAULT_EMAIL || 'kirtanpanchal2006@gmail.com';

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/super-market-software';
    await mongoose.connect(mongoUri);
    console.log('Connecting to database...');

    // 2. Create or Restore Super Admin User
    let superadmin = await User.findOne({ role: 'superadmin' });

    if (superadmin) {
      superadmin.username = customUsername;
      superadmin.password = customPassword; // User.js pre('save') hook will hash this once
      superadmin.email = customEmail;
      superadmin.mobile = '9574646343';
      superadmin.active = true;
      await superadmin.save();
    } else {
      superadmin = await User.create({
        name: 'SaaS Super Admin',
        username: customUsername,
        email: customEmail,
        mobile: '9574646343',
        password: customPassword, // User.js pre('save') hook will hash this once
        role: 'superadmin',
        active: true
      });
    }

    // 3. Auto-seed Subscription Plans if DB was deleted
    const planCount = await Plan.countDocuments();
    let seededPlansCount = 0;
    if (planCount === 0) {
      const plansData = [
        { name: '1 Month', price: 499, durationDays: 30, description: '30 Days Full Premium Access', active: true },
        { name: '3 Months', price: 1399, durationDays: 90, description: '90 Days Discounted Access', active: true },
        { name: '6 Months', price: 2499, durationDays: 180, description: '180 Days Value Access', active: true },
        { name: '12 Months', price: 4499, durationDays: 365, description: '365 Days Full Access', active: true }
      ];
      await Plan.insertMany(plansData);
      seededPlansCount = plansData.length;
    }

    console.log(`\n====================================================`);
    console.log(`✅ SUCCESS: Super Admin & SaaS Environment Ready!`);
    console.log(`  • Admin Username:    ${customUsername}`);
    console.log(`  • Admin Email:       ${customEmail}`);
    console.log(`  • Password:          ${customPassword}`);
    console.log(`  • Password Hashing:  Secured via Bcrypt (Single Hashed via User model)`);
    if (seededPlansCount > 0) {
      console.log(`  • Subscription Plans: Re-seeded ${seededPlansCount} default billing plans`);
    } else {
      console.log(`  • Subscription Plans: ${planCount} active plans verified`);
    }
    console.log(`====================================================\n`);

    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error during reset:', err.message);
    mongoose.connection.close();
  }
}

reset();
