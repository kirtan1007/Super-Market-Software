const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Setting = require('../models/Setting');
const ActivityLog = require('../models/ActivityLog');

dotenv.config();

const clearUsers = async () => {
  try {
    const primaryURI = process.env.MONGODB_URI;
    const fallbackURI = 'mongodb://127.0.0.1:27017/super-market-software';
    
    let connected = false;
    if (primaryURI) {
      try {
        console.log('Attempting to connect to primary MongoDB Atlas...');
        await mongoose.connect(primaryURI);
        console.log('Connected to MongoDB Atlas successfully.');
        connected = true;
      } catch (err) {
        console.error(`Primary database connection failed: ${err.message}`);
        console.log('Attempting fallback to local MongoDB...');
      }
    }
    
    if (!connected) {
      await mongoose.connect(fallbackURI);
      console.log('Connected to local MongoDB (Fallback).');
    }
    
    // Clear users, settings, and logs to force first-time setup status
    await User.deleteMany({});
    await Setting.deleteMany({});
    await ActivityLog.deleteMany({});
    
    console.log('--------------------------------------------------');
    console.log('Database users cleared successfully!');
    console.log('First-time setup registration mode is now active.');
    console.log('Refresh your browser to view the Owner Setup Form.');
    console.log('--------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Clear failed:', error);
    process.exit(1);
  }
};

clearUsers();
