const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Setting = require('../models/Setting');
const ActivityLog = require('../models/ActivityLog');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const tenantContext = require('../config/tenantContext');

// 14 New Models
const Category = require('../models/Category');
const Inventory = require('../models/Inventory');
const SaleItem = require('../models/SaleItem');
const PurchaseItem = require('../models/PurchaseItem');
const Cart = require('../models/Cart');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const StockHistory = require('../models/StockHistory');
const LoginHistory = require('../models/LoginHistory');
const OtpVerification = require('../models/OtpVerification');
const Notification = require('../models/Notification');

dotenv.config();

const sampleSuppliers = [
  {
    name: 'Galaxy Distributors',
    contactPerson: 'John Doe',
    mobile: '9898989898',
    email: 'john@galaxydist.com',
    address: '45 Trade Ring, Phase 1, Industrial Area',
    gstNumber: '22GALAXY0000Z1A'
  },
  {
    name: 'Cosmic Dairy Supplies',
    contactPerson: 'Sarah Connor',
    mobile: '8787878787',
    email: 'sarah@cosmicdairy.com',
    address: 'Dairy Lane, Sector 12, Farm City',
    gstNumber: '22COSMIC0000Z1B'
  },
  {
    name: 'Stellar Packaged Foods',
    contactPerson: 'David Miller',
    mobile: '7676767676',
    email: 'david@stellarfoods.com',
    address: 'Food Plaza, Block B, Processing Zone',
    gstNumber: '22STELLAR0000Z1C'
  }
];

const sampleCustomers = [
  {
    name: 'Alice Johnson',
    mobile: '9900990099',
    email: 'alice@gmail.com',
    address: 'Apartment 4B, Astro Towers, Super Market City',
    totalVisits: 12,
    totalPurchase: 4500,
    rewardPoints: 45,
    lastPurchaseDate: new Date()
  },
  {
    name: 'Bob Smith',
    mobile: '9800980098',
    email: 'bob@gmail.com',
    address: 'Flat 101, Comet Heights, Super Market City',
    totalVisits: 5,
    totalPurchase: 1800,
    rewardPoints: 18,
    lastPurchaseDate: new Date()
  }
];

const seedData = async () => {
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

    // Clear existing data in ALL 20 collections
    await User.deleteMany({});
    await Product.deleteMany({});

    // Drop stale productCode index if it exists in the database
    try {
      await Product.collection.dropIndex('productCode_1');
      console.log('Dropped stale productCode_1 index.');
    } catch (e) {
      // Ignore if index doesn't exist
    }

    await Customer.deleteMany({});
    await Supplier.deleteMany({});
    await Setting.deleteMany({});
    await ActivityLog.deleteMany({});
    await Sale.deleteMany({});
    await Purchase.deleteMany({});
    await Category.deleteMany({});
    await Inventory.deleteMany({});
    await SaleItem.deleteMany({});
    await PurchaseItem.deleteMany({});
    await Cart.deleteMany({});
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await Expense.deleteMany({});
    await Employee.deleteMany({});
    await Attendance.deleteMany({});
    await StockHistory.deleteMany({});
    await LoginHistory.deleteMany({});
    await OtpVerification.deleteMany({});
    await Notification.deleteMany({});

    console.log('Cleared existing collections.');

    // 1. Seed Owner and Worker (users collection)
    const ownerObjId = new mongoose.Types.ObjectId();
    const shopId = 'SHOP-SEED123';
    const tenantId = 'TENANT-SEED123';
    const databaseName = 'orbit_super_market';

    await tenantContext.run({ ownerId: ownerObjId, shopId, tenantId, databaseName }, async () => {
      const owner = await User.create({
        _id: ownerObjId,
        ownerId: ownerObjId,
        shopId,
        tenantId,
        name: 'Super Market Manager',
        username: 'owner',
        email: 'owner@supermarket.com',
        mobile: '9999988888',
        password: 'Password123',
        role: 'owner',
        shopName: 'Super Market',
        gstNumber: '22AAAAA0000A1Z5',
        shopAddress: '123 Galaxy Way, Sector 5, Super Market City',
        securityQuestions: [
          { question: 'What is your favorite color?', answer: 'blue' },
          { question: 'What is your birth city?', answer: 'delhi' }
        ]
      });

      const worker = await User.create({
        ownerId: ownerObjId,
        shopId,
        tenantId,
        name: 'Alex Cashier',
        username: 'worker',
        email: 'alex@supermarket.com',
        mobile: '7777766666',
        password: 'Password123',
        role: 'worker',
        createdBy: owner._id
      });

      console.log('Seed users created.');

      // 2. Seed Default Settings
      await Setting.create({
        owner: owner._id,
        ownerId: ownerObjId,
        shopId,
        tenantId,
        shopName: 'Super Market',
        shopAddress: '123 Galaxy Way, Sector 5, Super Market City',
        shopMobile: '9999988888',
        shopEmail: 'owner@supermarket.com',
        gstNumber: '22AAAAA0000A1Z5',
        lowStockThreshold: 10,
        enableGst: true,
        qrCodeUpi: 'market@upi',
        printerType: 'Thermal',
        theme: 'dark'
      });

      // 3. Seed Suppliers
      const suppliers = await Supplier.insertMany(
        sampleSuppliers.map(s => ({ ...s, ownerId: ownerObjId, shopId, tenantId }))
      );
      console.log('Suppliers seeded.');

      // 4. Seed Customers
      const customers = await Customer.insertMany(
        sampleCustomers.map(c => ({ ...c, owner: owner._id, ownerId: ownerObjId, shopId, tenantId }))
      );
      console.log('Customers seeded.');

      // 5. Seed categories collection
      const categoriesList = ['Bakery', 'Dairy', 'Snacks', 'Beverages', 'Grocery', 'Personal Care'];
      const categoriesDocs = [];
      for (const catName of categoriesList) {
        const catDoc = await Category.create({ name: catName, description: `${catName} Department` });
        categoriesDocs.push(catDoc);
      }
      console.log('Categories seeded.');

    // 6. Seed Products
    const sampleProducts = [
      {
        name: 'Whole Grain Wheat Bread 400g',
        barcode: '8901725181222',
        category: 'Bakery',
        subcategory: 'Bread',
        brand: 'Stellar Foods',
        purchasePrice: 32,
        sellingPrice: 40,
        mrp: 45,
        gst: 5,
        minimumStock: 10,
        currentStock: 25,
        supplier: suppliers[2]._id,
        rackNumber: 'Rack A-3',
        batchNumber: 'BR-2026-07',
        description: 'Fresh fiber-rich whole wheat bread.',
        mfgDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        shelfLife: '6 days'
      },
      {
        name: 'Cream Gold Butter 500g',
        barcode: '8901262010016',
        category: 'Dairy',
        subcategory: 'Butter',
        brand: 'Cosmic Dairy',
        purchasePrice: 210,
        sellingPrice: 245,
        mrp: 260,
        gst: 12,
        minimumStock: 8,
        currentStock: 15,
        supplier: suppliers[1]._id,
        rackNumber: 'Chiller-1',
        batchNumber: 'BT-348',
        description: 'Salted butter made from fresh cow milk.',
        mfgDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        shelfLife: '90 days'
      },
      {
        name: 'Organic Milk 1L Tetra',
        barcode: '8901262151238',
        category: 'Dairy',
        subcategory: 'Milk',
        brand: 'Cosmic Dairy',
        purchasePrice: 60,
        sellingPrice: 72,
        mrp: 75,
        gst: 0,
        minimumStock: 15,
        currentStock: 30,
        supplier: suppliers[1]._id,
        rackNumber: 'Chiller-2',
        batchNumber: 'MK-102',
        description: 'UHT treated long life organic milk.',
        mfgDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        shelfLife: '30 days'
      },
      {
        name: 'Instant Noodles Masala 70g',
        barcode: '8901058002317',
        category: 'Snacks',
        subcategory: 'Noodles',
        brand: 'Stellar Foods',
        purchasePrice: 11.5,
        sellingPrice: 14,
        mrp: 14,
        gst: 18,
        minimumStock: 20,
        currentStock: 8,
        supplier: suppliers[2]._id,
        rackNumber: 'Rack C-1',
        batchNumber: 'ND-992',
        description: 'Spicy Indian masala style instant noodles.',
        mfgDate: new Date(Date.now() - 155 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        shelfLife: '180 days'
      },
      {
        name: 'Sparkling Orange Cola 500ml',
        barcode: '8901764021237',
        category: 'Beverages',
        subcategory: 'Soft Drinks',
        brand: 'Galaxy Dist',
        purchasePrice: 24,
        sellingPrice: 35,
        mrp: 40,
        gst: 28,
        minimumStock: 12,
        currentStock: 4,
        supplier: suppliers[0]._id,
        rackNumber: 'Beverage Fridge 1',
        batchNumber: 'CO-543',
        description: 'Carbonated fizzy orange drink.',
        mfgDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        shelfLife: '360 days'
      },
      {
        name: 'Premium Basmati Rice 5kg',
        barcode: '8902532451027',
        category: 'Grocery',
        subcategory: 'Rice',
        brand: 'Galaxy Dist',
        purchasePrice: 480,
        sellingPrice: 580,
        mrp: 650,
        gst: 5,
        minimumStock: 5,
        currentStock: 12,
        supplier: suppliers[0]._id,
        rackNumber: 'Rack D-2',
        batchNumber: 'RC-Bas-22',
        description: 'Long grain aged aromatic basmati rice.',
        mfgDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        shelfLife: '2 years'
      },
      {
        name: 'Aloe Vera Hand Wash 250ml',
        barcode: '8901396324126',
        category: 'Personal Care',
        subcategory: 'Soap',
        brand: 'Galaxy Dist',
        purchasePrice: 65,
        sellingPrice: 85,
        mrp: 99,
        gst: 18,
        minimumStock: 8,
        currentStock: 0,
        supplier: suppliers[0]._id,
        rackNumber: 'Rack F-4',
        batchNumber: 'HW-773',
        description: 'Gentle moisturizing handwash liquid.'
      }
    ];

    const products = await Product.insertMany(
      sampleProducts.map(p => ({ ...p, ownerId: ownerObjId, shopId, tenantId }))
    );
    console.log('Sample products seeded.');

    // 7. Seed inventory & stockHistory collections for products
    for (const p of products) {
      const invStatus = p.currentStock === 0 ? 'Out of Stock' : (p.currentStock <= p.minimumStock ? 'Low Stock' : 'In Stock');
      await Inventory.create({
        product: p._id,
        quantity: p.currentStock,
        status: invStatus
      });

      await StockHistory.create({
        product: p._id,
        changeType: 'Increase',
        quantity: p.currentStock,
        previousStock: 0,
        newStock: p.currentStock,
        reference: 'Initial Stocking (Seeding)',
        recordedBy: owner._id
      });
    }
    console.log('Inventory & Stock History seeded.');

    // 8. Seed employee and attendance collections
    const employee = await Employee.create({
      user: worker._id,
      salary: 18000,
      department: 'Billing',
      status: 'Active'
    });

    const todayStr = new Date().toISOString().split('T')[0];
    await Attendance.create({
      employee: worker._id,
      date: todayStr,
      checkIn: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      checkOut: new Date(),
      status: 'Present'
    });
    console.log('Employee & Attendance seeded.');

    // 9. Seed loginHistory collection
    await LoginHistory.create({
      user: owner._id,
      username: owner.username,
      role: 'owner',
      status: 'Success',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });
    await LoginHistory.create({
      user: worker._id,
      username: worker.username,
      role: 'worker',
      status: 'Success',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });
    console.log('Login History seeded.');

    // 10. Seed otpVerification collection
    await OtpVerification.create({
      email: owner.email,
      otp: '$2a$10$xyz...', // Dummy hash
      purpose: 'Password Reset',
      status: 'Verified',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    console.log('OTP Verification seeded.');

    // 11. Seed notifications collection
    await Notification.create({
      title: 'Low Stock Warning',
      message: "Instant Noodles Masala 70g is below warning limit.",
      type: 'Warning'
    });
    await Notification.create({
      title: 'Out of Stock Alert',
      message: "Aloe Vera Hand Wash 250ml is completely out of stock.",
      type: 'Alert'
    });
    console.log('Notifications seeded.');

    // 12. Seed expenses collection
    await Expense.create({
      title: 'Store Lightbulbs Replacement',
      category: 'Maintenance',
      amount: 1200,
      notes: 'Purchased 10 LED bulbs for aisles.',
      recordedBy: owner._id
    });
    console.log('Expenses seeded.');

    // 13. Seed carts collection
    await Cart.create({
      cashier: worker._id,
      items: [
        { product: products[0]._id, quantity: 2 },
        { product: products[1]._id, quantity: 1 }
      ]
    });
    console.log('Cashier Cart seeded.');

    // 14. Seed sales, saleItems, invoices, and payments collections
    const invoiceNo = `SALE-${todayStr.replace(/-/g, '')}-0001`;
    const saleItemsList = [
      {
        product: products[0]._id,
        name: products[0].name,
        barcode: products[0].barcode,
        quantity: 2,
        purchasePrice: products[0].purchasePrice,
        sellingPrice: products[0].sellingPrice,
        mrp: products[0].mrp,
        gstPercent: products[0].gst,
        gstAmount: 4.00,
        discountAmount: 0,
        total: 80.00
      }
    ];

    const sale = await Sale.create({
      invoiceNo,
      customer: customers[0]._id,
      cashier: worker._id,
      items: saleItemsList,
      subtotal: 80.00,
      totalDiscount: 0,
      totalGst: 4.00,
      finalAmount: 80.00,
      paymentMode: 'Cash'
    });

    await SaleItem.create({
      sale: sale._id,
      product: products[0]._id,
      name: products[0].name,
      barcode: products[0].barcode,
      quantity: 2,
      purchasePrice: products[0].purchasePrice,
      sellingPrice: products[0].sellingPrice,
      mrp: products[0].mrp,
      gstPercent: products[0].gst,
      gstAmount: 4.00,
      discountAmount: 0,
      total: 80.00
    });

    await Invoice.create({
      invoiceNo,
      sale: sale._id,
      printed: true
    });

    await Payment.create({
      sale: sale._id,
      paymentNo: `PAY-${Date.now()}-1001`,
      amount: 80.00,
      method: 'Cash',
      status: 'Completed'
    });
    console.log('Sales, SaleItems, Invoices, and Payments seeded.');

    // 15. Seed purchases and purchaseItems collections
    const purchase = await Purchase.create({
      invoiceNo: 'PINV-98745',
      supplier: suppliers[0]._id,
      items: [
        {
          product: products[0]._id,
          quantity: 50,
          purchasePrice: 30.00,
          gstPercent: 5,
          gstAmount: 75.00,
          total: 1575.00
        }
      ],
      totalAmount: 1575.00,
      paymentStatus: 'Paid'
    });

    await PurchaseItem.create({
      purchase: purchase._id,
      product: products[0]._id,
      quantity: 50,
      purchasePrice: 30.00,
      gstPercent: 5,
      gstAmount: 75.00,
      total: 1575.00
    });
    console.log('Purchases and PurchaseItems seeded.');

    // Add activity log
    await ActivityLog.create({
      username: 'system',
      role: 'owner',
      action: 'Seeding',
      details: 'Supermarket database fully seeded. 20 collections populated.'
    });

    console.log('Seeding completed successfully!');
    });
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
