require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  const User = require(path.join(__dirname, '..', 'models', 'User'));

  // Set subscription to active + extend trial end date so owner can access dashboard
  const trialEnd = new Date();
  trialEnd.setFullYear(trialEnd.getFullYear() + 1); // 1 year from now

  const result = await User.updateOne(
    { username: 'tejas' },
    {
      $set: {
        active: true,
        subscriptionStatus: 'active',
        subscriptionEndDate: trialEnd,
        trialEndDate: trialEnd
      }
    }
  );
  console.log('Update result:', JSON.stringify(result));

  const owner = await User.findOne({ username: 'tejas' }).select('username active subscriptionStatus subscriptionEndDate');
  console.log('Owner now:', JSON.stringify(owner, null, 2));

  mongoose.disconnect();
}).catch(e => {
  console.error('DB Error:', e.message);
  process.exit(1);
});
