const Product = require('../models/Product');
const StockHistory = require('../models/StockHistory');
const Notification = require('../models/Notification');

/**
 * Scans all products for expired and expiring stock, updates inventory,
 * logs stock adjustments, and generates system notifications.
 */
const runExpiryCheck = async () => {
  try {
    console.log('Running automated Expiry and Warning scan...');
    const now = new Date();
    
    // 1. Process Expired Products (expiryDate < now) with active stock
    const expiredProducts = await Product.find({
      expiryDate: { $lt: now },
      currentStock: { $gt: 0 }
    });

    for (let product of expiredProducts) {
      const expiredQty = product.currentStock;
      const prevStock = product.currentStock;

      // Deduct active stock and move to expired stock
      product.expiredStock += expiredQty;
      product.currentStock = 0;
      await product.save();

      // Log stock history change
      await StockHistory.create({
        product: product._id,
        changeType: 'Decrease',
        quantity: -expiredQty,
        previousStock: prevStock,
        newStock: 0,
        reference: `System Auto-Adjustment: Expiry (Batch: ${product.batchNumber || 'N/A'})`
      });

      // Generate System Notification
      const title = 'Product Expired';
      const message = `${product.name} (Batch: ${product.batchNumber || 'N/A'}) has expired. ${expiredQty} unit(s) moved to Expired Stock section.`;
      
      const notifExists = await Notification.findOne({ title, message });
      if (!notifExists) {
        await Notification.create({
          title,
          message,
          type: 'Alert'
        });
      }
    }

    if (expiredProducts.length > 0) {
      console.log(`Auto-adjusted ${expiredProducts.length} expired product(s).`);
    }

    // 2. Generate Warnings for Expiring Soon products (within 30 days)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);
    in7Days.setHours(23, 59, 59, 999);

    const in15Days = new Date();
    in15Days.setDate(now.getDate() + 15);
    in15Days.setHours(23, 59, 59, 999);

    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);
    in30Days.setHours(23, 59, 59, 999);

    // Query active inventory expiring within 30 days
    const expiringSoonProducts = await Product.find({
      expiryDate: { $gte: now, $lte: in30Days },
      currentStock: { $gt: 0 }
    });

    for (let product of expiringSoonProducts) {
      const expDate = new Date(product.expiryDate);
      const timeDiff = expDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

      let warningType = 'Info';
      let title = 'Expiry Warning';
      let msgPrefix = '';

      if (daysRemaining <= 0) {
        // Expiring today
        warningType = 'Alert';
        title = 'Expiring Today';
        msgPrefix = `CRITICAL: ${product.name} (Batch: ${product.batchNumber || 'N/A'}) expires today!`;
      } else if (daysRemaining <= 7) {
        warningType = 'Alert';
        title = 'Critical Expiry Warning';
        msgPrefix = `CRITICAL: ${product.name} (Batch: ${product.batchNumber || 'N/A'}) expires in ${daysRemaining} days!`;
      } else if (daysRemaining <= 15) {
        warningType = 'Warning';
        title = 'Expiry Warning';
        msgPrefix = `WARNING: ${product.name} (Batch: ${product.batchNumber || 'N/A'}) expires in ${daysRemaining} days.`;
      } else {
        warningType = 'Info';
        title = 'Upcoming Expiry Warning';
        msgPrefix = `INFO: ${product.name} (Batch: ${product.batchNumber || 'N/A'}) expires in ${daysRemaining} days.`;
      }

      const message = `${msgPrefix} Current active stock: ${product.currentStock}. Please review shelf placement.`;
      
      const notifExists = await Notification.findOne({ title, message });
      if (!notifExists) {
        await Notification.create({
          title,
          message,
          type: warningType
        });
      }
    }
    
    console.log('Expiry and warning check run complete.');
  } catch (error) {
    console.error('Error running automated Expiry scan:', error.message);
  }
};

module.exports = runExpiryCheck;
