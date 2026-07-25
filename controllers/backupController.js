const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Setting = require('../models/Setting');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Ensure backups directory exists
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// @desc    Export database to JSON file
// @route   GET /api/backup/export
// @access  Private (Owner Only)
exports.exportBackup = async (req, res) => {
  try {
    // Retrieve all data from collections
    const users = await User.find();
    const products = await Product.find();
    const customers = await Customer.find();
    const suppliers = await Supplier.find();
    const sales = await Sale.find();
    const purchases = await Purchase.find();
    const settings = await Setting.find();
    const logs = await ActivityLog.find();

    const backupData = {
      exportTimestamp: new Date().toISOString(),
      exportedBy: req.user.username,
      collections: {
        users,
        products,
        customers,
        suppliers,
        sales,
        purchases,
        settings,
        activityLogs: logs
      }
    };

    const fileName = `backup_${Date.now()}.json`;
    const filePath = path.join(backupsDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    await logActivity(req, 'Create Backup', `Database backup file '${fileName}' generated`);

    // Send file to client
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Keep file in backups folder as local archive
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Restore database from uploaded JSON file
// @route   POST /api/backup/restore
// @access  Private (Owner Only)
exports.restoreBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a backup JSON file' });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let backupData;

    try {
      backupData = JSON.parse(fileContent);
    } catch (e) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'Invalid JSON file structure' });
    }

    const { collections } = backupData;
    if (!collections) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'Backup file missing collections data' });
    }

    // Restore Collections: clear current records and insert backup records
    if (collections.users && collections.users.length > 0) {
      await User.deleteMany({});
      await User.insertMany(collections.users);
    }
    if (collections.products && collections.products.length > 0) {
      await Product.deleteMany({});
      await Product.insertMany(collections.products);
    }
    if (collections.customers && collections.customers.length > 0) {
      await Customer.deleteMany({});
      await Customer.insertMany(collections.customers);
    }
    if (collections.suppliers && collections.suppliers.length > 0) {
      await Supplier.deleteMany({});
      await Supplier.insertMany(collections.suppliers);
    }
    if (collections.sales && collections.sales.length > 0) {
      await Sale.deleteMany({});
      await Sale.insertMany(collections.sales);
    }
    if (collections.purchases && collections.purchases.length > 0) {
      await Purchase.deleteMany({});
      await Purchase.insertMany(collections.purchases);
    }
    if (collections.settings && collections.settings.length > 0) {
      await Setting.deleteMany({});
      await Setting.insertMany(collections.settings);
    }
    if (collections.activityLogs && collections.activityLogs.length > 0) {
      await ActivityLog.deleteMany({});
      await ActivityLog.insertMany(collections.activityLogs);
    }

    // Clean up uploaded temp file
    fs.unlinkSync(filePath);

    // Relog restore event
    await logActivity(req, 'Restore Backup', 'System database successfully restored from JSON file');

    res.status(200).json({
      success: true,
      message: 'System database restored successfully'
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
