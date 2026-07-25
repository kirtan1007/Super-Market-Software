const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const SaleItem = require('../models/SaleItem');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Inventory = require('../models/Inventory');
const StockHistory = require('../models/StockHistory');
const Setting = require('../models/Setting');
const { logActivity } = require('../middleware/auth');

// Helper to generate Invoice Number: SALE-YYYYMMDD-XXXX
const generateInvoiceNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const count = await Sale.countDocuments({
    invoiceNo: new RegExp(`^SALE-${dateStr}-`)
  });

  const nextNum = String(count + 1).padStart(4, '0');
  return `SALE-${dateStr}-${nextNum}`;
};

// @desc    Create a new Sale (Checkout)
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res) => {
  try {
    const { customerMobile, customerName, customerEmail, customerAddress, items, couponCode, discountPercent, paymentMode, paymentDetails } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // 1. Get or Create Customer
    let customer;
    if (customerMobile) {
      customer = await Customer.findOne({ mobile: customerMobile });
      if (!customer) {
        // Auto-save customer if not found
        customer = await Customer.create({
          name: customerName || 'Walk-in Customer',
          mobile: customerMobile,
          email: customerEmail || '',
          address: customerAddress || ''
        });
      } else {
        // If details provided, update
        if (customerName) customer.name = customerName;
        if (customerEmail) customer.email = customerEmail;
        if (customerAddress) customer.address = customerAddress;
      }
    } else {
      return res.status(400).json({ success: false, message: 'Customer mobile number is required' });
    }

    let invoiceNo = req.body.invoiceNo;
    if (invoiceNo) {
      const existing = await Sale.findOne({ invoiceNo });
      if (existing) {
        return res.status(400).json({ success: false, message: `Invoice number ${invoiceNo} already exists` });
      }
    } else {
      invoiceNo = await generateInvoiceNumber();
    }

    // 2. Validate Items and Process Stock subtraction
    let subtotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;
    const saleItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.name} not found` });
      }

      // Check Expiry Date
      if (product.expiryDate && new Date(product.expiryDate) < new Date()) {
        return res.status(400).json({
          success: false,
          message: `Product '${product.name}' has expired and cannot be sold.`
        });
      }

      // Check stock limits
      if (product.currentStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product '${product.name}'. Current stock: ${product.currentStock}`
        });
      }

      // Calculate amounts
      const purchasePrice = product.purchasePrice;
      const mrp = product.mrp;
      const sellingPrice = product.sellingPrice;
      
      const itemQty = Number(item.quantity);
      const itemSubtotal = sellingPrice * itemQty;
      
      // Calculate GST component (GST is included in sellingPrice or added? In India, sellingPrice usually includes GST, let's treat it as included)
      const gstPercent = product.gst;
      // Formula for GST included: GST Amount = Value - (Value / (1 + GST%/100))
      const itemGst = itemSubtotal - (itemSubtotal / (1 + gstPercent / 100));

      // Calculate discount on this item
      const itemDiscount = Number(item.discountAmount || 0);

      const itemTotal = itemSubtotal - itemDiscount;

      // Subtract from product stock
      product.currentStock -= itemQty;
      await product.save();

      saleItems.push({
        product: product._id,
        name: product.name,
        barcode: product.barcode,
        quantity: itemQty,
        purchasePrice,
        sellingPrice,
        mrp,
        gstPercent,
        gstAmount: parseFloat(itemGst.toFixed(2)),
        discountAmount: itemDiscount,
        total: parseFloat(itemTotal.toFixed(2))
      });

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalGst += itemGst;
    }

    // Apply overall invoice discount percentage if any
    let finalAmount = subtotal - totalDiscount;
    if (discountPercent && Number(discountPercent) > 0) {
      const overallDiscount = (finalAmount * Number(discountPercent)) / 100;
      totalDiscount += overallDiscount;
      finalAmount -= overallDiscount;
    }

    // 3. Process Points (1 point for every 100 Rupees/Units spent)
    const pointsEarned = Math.floor(finalAmount / 100);

    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.createdBy;
    const settings = await Setting.findOne({ owner: ownerId });
    const shopId = settings ? settings.shopName : 'Super Market';
    const staffName = req.user.name;
    const paymentStatus = 'Paid';

    // Save Sale record
    const sale = await Sale.create({
      invoiceNo,
      customer: customer._id,
      cashier: req.user._id,
      items: saleItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      totalGst: parseFloat(totalGst.toFixed(2)),
      couponCode,
      finalAmount: parseFloat(finalAmount.toFixed(2)),
      paymentMode,
      paymentDetails: {
        cashAmount: Number(paymentDetails?.cashAmount || 0),
        upiAmount: Number(paymentDetails?.upiAmount || 0),
        cardAmount: Number(paymentDetails?.cardAmount || 0),
        walletAmount: Number(paymentDetails?.walletAmount || 0),
        transactionId: paymentDetails?.transactionId || ''
      },
      rewardPointsEarned: pointsEarned,
      owner: ownerId,
      shopId,
      staffName,
      paymentStatus
    });

    // Create separate SaleItem documents and log StockHistory / Sync Inventory
    for (const item of saleItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const previousStock = product.currentStock + item.quantity;
        const newStock = product.currentStock;

        // Save SaleItem
        await SaleItem.create({
          sale: sale._id,
          product: product._id,
          name: item.name,
          barcode: item.barcode,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          mrp: item.mrp,
          gstPercent: item.gstPercent,
          gstAmount: item.gstAmount,
          discountAmount: item.discountAmount,
          total: item.total
        });

        // Sync Inventory
        const invStatus = newStock === 0 ? 'Out of Stock' : (newStock <= product.minimumStock ? 'Low Stock' : 'In Stock');
        await Inventory.findOneAndUpdate(
          { product: product._id },
          { quantity: newStock, status: invStatus, lastUpdated: new Date() },
          { upsert: true }
        );

        // Log StockHistory (Decrease)
        await StockHistory.create({
          product: product._id,
          changeType: 'Decrease',
          quantity: item.quantity,
          previousStock,
          newStock,
          reference: `Sale Invoice #${invoiceNo}`,
          recordedBy: req.user ? req.user._id : null
        });
      }
    }

    // Save Invoice document
    await Invoice.create({
      invoiceNo,
      sale: sale._id,
      pdfUrl: '',
      printed: false
    });

    // Save Payment record
    const paymentNo = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await Payment.create({
      sale: sale._id,
      paymentNo,
      amount: parseFloat(finalAmount.toFixed(2)),
      method: paymentMode,
      status: 'Completed',
      transactionId: paymentDetails?.transactionId || ''
    });

    // 4. Update Customer stats
    customer.totalVisits += 1;
    customer.totalPurchase += parseFloat(finalAmount.toFixed(2));
    customer.lastPurchaseDate = Date.now();
    customer.rewardPoints += pointsEarned;
    await customer.save();

    await logActivity(req, 'Checkout Sale', `Sale Completed: Invoice ${invoiceNo}, Customer: ${customer.name}, Total: ${finalAmount}`);

    res.status(201).json({
      success: true,
      data: sale,
      customerDetails: {
        name: customer.name,
        mobile: customer.mobile,
        rewardPoints: customer.rewardPoints
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all sales transactions
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate('customer', 'name mobile')
      .populate('cashier', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: sales.length, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get sale invoice by ID
// @route   GET /api/sales/:id
// @access  Private
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer')
      .populate('cashier', 'name');
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get next available invoice number
// @route   GET /api/sales/next-invoice
// @access  Private
exports.getNextInvoiceNumber = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.status(200).json({ success: true, invoiceNo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
