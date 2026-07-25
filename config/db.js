const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryURI = process.env.MONGODB_URI;
  const fallbackURI = 'mongodb://127.0.0.1:27017/super-market-software';

  const connectionOptions = {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  };

  if (primaryURI) {
    try {
      console.log('Attempting to connect to primary MongoDB Atlas...');
      const conn = await mongoose.connect(primaryURI, connectionOptions);
      console.log(`MongoDB Connected (Primary): ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`Primary database connection failed: ${error.message}`);
      console.log('Attempting fallback to local MongoDB...');
    }
  }

  try {
    const conn = await mongoose.connect(fallbackURI, connectionOptions);
    console.log(`MongoDB Connected (Local Fallback): ${conn.connection.host}`);
  } catch (error) {
    console.error(`Fallback database connection error: ${error.message}`);
    console.log('\n====================================================');
    console.log('WARNING: Could not connect to any MongoDB instance.');
    console.log('Please ensure local MongoDB is running or your IP is whitelisted on Atlas.');
    console.log('The server will continue running, but DB operations will fail.');
    console.log('====================================================\n');
  }
};

module.exports = connectDB;
