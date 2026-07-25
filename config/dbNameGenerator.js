const mongoose = require('mongoose');

/**
 * Generates a unique MongoDB database name from a shop name
 * @param {string} shopName - The name of the shop
 * @param {mongoose.Model} User - The User model to check for uniqueness
 * @returns {Promise<string>} The unique database name
 */
const generateUniqueDbName = async (shopName, User) => {
  if (!shopName) shopName = 'shop';
  let baseName = shopName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
  
  // Truncate to 34 characters to allow suffix like _001 (4 chars) to fit in 38-character Atlas limit
  baseName = baseName.substring(0, 34).replace(/^_+|_+$/g, '');
  if (!baseName) baseName = 'shop';

  let dbName = baseName;
  let exists = await User.findOne({ databaseName: dbName });
  let counter = 1;
  while (exists) {
    const suffix = counter.toString().padStart(3, '0');
    dbName = `${baseName}_${suffix}`;
    exists = await User.findOne({ databaseName: dbName });
    counter++;
  }
  return dbName;
};

module.exports = generateUniqueDbName;
