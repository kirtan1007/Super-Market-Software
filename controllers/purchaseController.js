const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const PurchaseItem = require('../models/PurchaseItem');
const Inventory = require('../models/Inventory');
const StockHistory = require('../models/StockHistory');
const { logActivity } = require('../middleware/auth');

// @desc    Get all purchases
// @route   GET /api/purchases
// @access  Private
exports.getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate('supplier', 'name')
      .populate('items.product', 'name barcode')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new purchase entry (automatically updates inventory stock)
// @route   POST /api/purchases
// @access  Private (Owner Only)
exports.createPurchase = async (req, res) => {
  try {
    const { supplier, invoiceNo, items, totalAmount, paymentStatus, purchaseDate } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please add items to purchase invoice' });
    }

    // Create the purchase record
    const purchase = await Purchase.create({
      supplier,
      invoiceNo,
      items,
      totalAmount,
      paymentStatus,
      purchaseDate
    });

    // Update inventory stock and log for each product purchased
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (product) {
        const previousStock = product.currentStock;

        // Increment current stock
        product.currentStock += Number(item.quantity);
        // Update purchase price (cost price) to latest
        product.purchasePrice = Number(item.purchasePrice);
        // If product supplier is not set or changed, update it
        product.supplier = supplier;
        
        await product.save();

        const newStock = product.currentStock;

        // Save separate PurchaseItem document
        await PurchaseItem.create({
          purchase: purchase._id,
          product: product._id,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          gstPercent: item.gstPercent || 0,
          gstAmount: item.gstAmount || 0,
          total: item.total
        });

        // Sync Inventory
        const invStatus = newStock === 0 ? 'Out of Stock' : (newStock <= product.minimumStock ? 'Low Stock' : 'In Stock');
        await Inventory.findOneAndUpdate(
          { product: product._id },
          { quantity: newStock, status: invStatus, lastUpdated: new Date() },
          { upsert: true }
        );

        // Log StockHistory
        await StockHistory.create({
          product: product._id,
          changeType: 'Increase',
          quantity: item.quantity,
          previousStock,
          newStock,
          reference: `Purchase Invoice #${invoiceNo}`,
          recordedBy: req.user ? req.user._id : null
        });
      }
    }

    await logActivity(req, 'Create Purchase', `Purchase Invoice '${invoiceNo}' recorded. Inventory quantities automatically incremented.`);

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
