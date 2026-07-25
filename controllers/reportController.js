const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Purchase = require('../models/Purchase');

// Helper to get date ranges
const getDateRange = (filter) => {
  const now = new Date();
  let start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (filter) {
    case 'today':
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'yearly':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      break;
  }

  return { start, end: now };
};

// @desc    Get Dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Today's Sales & Orders
    const salesToday = await Sale.find({ createdAt: { $gte: today } });
    const todaySalesAmount = salesToday.reduce((sum, s) => sum + s.finalAmount, 0);
    const todayOrdersCount = salesToday.length;

    // 2. Today's Profit
    let todayProfit = 0;
    salesToday.forEach(sale => {
      sale.items.forEach(item => {
        const itemCost = item.purchasePrice * item.quantity;
        const itemRevenue = item.sellingPrice * item.quantity - item.discountAmount;
        todayProfit += (itemRevenue - itemCost);
      });
    });

    // 3. Customers Registered Today
    const todayCustomersCount = await Customer.countDocuments({ createdAt: { $gte: today } });

    // 4. Inventory Expiry Counts
    const now = new Date();
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

    const expiredCount = await Product.countDocuments({
      expiryDate: { $lt: now }
    });

    const expiringTodayCount = await Product.countDocuments({
      expiryDate: { $gte: now, $lte: endOfToday }
    });

    const expiring7DaysCount = await Product.countDocuments({
      expiryDate: { $gt: endOfToday, $lte: in7Days }
    });

    const expiring15DaysCount = await Product.countDocuments({
      expiryDate: { $gt: in7Days, $lte: in15Days }
    });

    const expiring30DaysCount = await Product.countDocuments({
      expiryDate: { $gt: in15Days, $lte: in30Days }
    });

    // 5. Inventory Alert Counts
    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ['$currentStock', '$minimumStock'] },
      currentStock: { $gt: 0 }
    });
    const outOfStockCount = await Product.countDocuments({ currentStock: 0 });
    const totalProducts = await Product.countDocuments();

    // 5. Recent Sales and Purchases
    const recentSales = await Sale.find()
      .populate('customer', 'name')
      .limit(5)
      .sort({ createdAt: -1 });

    const recentPurchases = await Purchase.find()
      .populate('supplier', 'name')
      .limit(5)
      .sort({ createdAt: -1 });

    // 6. Additional Required Dashboard Metrics
    const totalCustomers = await Customer.countDocuments();
    const totalSales = await Sale.countDocuments();
    
    // Total Revenue (all sales)
    const allSales = await Sale.find();
    const totalRevenue = allSales.reduce((sum, s) => sum + s.finalAmount, 0);

    // Weekly Sales (7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklySalesDocs = await Sale.find({ createdAt: { $gte: sevenDaysAgo } });
    const weeklySales = weeklySalesDocs.reduce((sum, s) => sum + s.finalAmount, 0);

    // Monthly Sales (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlySalesDocs = await Sale.find({ createdAt: { $gte: thirtyDaysAgo } });
    const monthlySales = monthlySalesDocs.reduce((sum, s) => sum + s.finalAmount, 0);

    // Yearly Sales (365 days ago)
    const threeSixtyFiveDaysAgo = new Date();
    threeSixtyFiveDaysAgo.setDate(threeSixtyFiveDaysAgo.getDate() - 365);
    const yearlySalesDocs = await Sale.find({ createdAt: { $gte: threeSixtyFiveDaysAgo } });
    const yearlySales = yearlySalesDocs.reduce((sum, s) => sum + s.finalAmount, 0);

    // Recent Customers
    const recentCustomers = await Customer.find().limit(5).sort({ createdAt: -1 });

    // 7. Graph Data: Last 7 Days Sales
    const graphDays = [];
    const salesByDay = [];
    const profitByDay = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStart = new Date(d);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);

      const daySales = await Sale.find({ createdAt: { $gte: dStart, $lte: dEnd } });
      const daySalesTotal = daySales.reduce((sum, s) => sum + s.finalAmount, 0);
      
      let dayProfitTotal = 0;
      daySales.forEach(sale => {
        sale.items.forEach(item => {
          dayProfitTotal += ((item.sellingPrice - item.purchasePrice) * item.quantity) - item.discountAmount;
        });
      });

      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      graphDays.push(weekday);
      salesByDay.push(parseFloat(daySalesTotal.toFixed(2)));
      profitByDay.push(parseFloat(dayProfitTotal.toFixed(2)));
    }

    res.status(200).json({
      success: true,
      data: {
        todaySales: parseFloat(todaySalesAmount.toFixed(2)),
        todayOrders: todayOrdersCount,
        todayProfit: parseFloat(todayProfit.toFixed(2)),
        todayCustomers: todayCustomersCount,
        expiredCount,
        expiringTodayCount,
        expiring7DaysCount,
        expiring15DaysCount,
        expiring30DaysCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        totalProducts,
        totalCustomers,
        totalSales,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        weeklySales: parseFloat(weeklySales.toFixed(2)),
        monthlySales: parseFloat(monthlySales.toFixed(2)),
        yearlySales: parseFloat(yearlySales.toFixed(2)),
        recentCustomers,
        recentBills: recentSales,
        recentSales,
        recentPurchases,
        chart: {
          labels: graphDays,
          sales: salesByDay,
          profits: profitByDay
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get comprehensive sales and margin reports
// @route   GET /api/reports/sales
// @access  Private (Owner Only)
exports.getSalesReport = async (req, res) => {
  try {
    const { range = 'today', startDate, endDate } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const dates = getDateRange(range);
      start = dates.start;
      end = dates.end;
    }

    const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } })
      .populate('customer', 'name mobile')
      .populate('cashier', 'name')
      .sort({ createdAt: -1 });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalDiscount = 0;
    let totalGstCollected = 0;

    sales.forEach(sale => {
      totalRevenue += sale.finalAmount;
      totalDiscount += sale.totalDiscount;
      totalGstCollected += sale.totalGst;

      sale.items.forEach(item => {
        totalCost += (item.purchasePrice * item.quantity);
      });
    });

    const netProfit = totalRevenue - totalCost;

    res.status(200).json({
      success: true,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalDiscount: parseFloat(totalDiscount.toFixed(2)),
        totalGstCollected: parseFloat(totalGstCollected.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        orderCount: sales.length
      },
      data: sales
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Best & Worst Selling Products
// @route   GET /api/reports/products-performance
// @access  Private (Owner Only)
exports.getProductPerformanceReport = async (req, res) => {
  try {
    const performance = await Sale.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          barcode: { $first: '$items.barcode' },
          qtySold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
          profit: {
            $sum: {
              $subtract: [
                '$items.total',
                { $multiply: ['$items.purchasePrice', '$items.quantity'] }
              ]
            }
          }
        }
      },
      { $sort: { qtySold: -1 } }
    ]);

    const bestSellers = performance.slice(0, 10);
    const worstSellers = [...performance].reverse().slice(0, 10);

    res.status(200).json({
      success: true,
      bestSellers,
      worstSellers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get GST tax collection breakup
// @route   GET /api/reports/gst
// @access  Private (Owner Only)
exports.getGstReport = async (req, res) => {
  try {
    const { range = 'weekly', startDate, endDate } = req.query;

    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const dates = getDateRange(range);
      start = dates.start;
      end = dates.end;
    }

    const gstAggregate = await Sale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.gstPercent',
          taxableValue: {
            $sum: {
              $subtract: ['$items.total', '$items.gstAmount']
            }
          },
          gstCollected: { $sum: '$items.gstAmount' },
          totalSales: { $sum: '$items.total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: gstAggregate
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Product Expiry Report
// @route   GET /api/reports/expiry
// @access  Private (Owner Only)
exports.getExpiryReport = async (req, res) => {
  try {
    const { status = '' } = req.query;
    const now = new Date();
    
    const query = {};

    if (status === 'expired') {
      query.expiryDate = { $lt: now };
    } else if (status === '7days') {
      const in7Days = new Date();
      in7Days.setDate(now.getDate() + 7);
      in7Days.setHours(23, 59, 59, 999);
      query.expiryDate = { $gte: now, $lte: in7Days };
    } else if (status === '15days') {
      const in15Days = new Date();
      in15Days.setDate(now.getDate() + 15);
      in15Days.setHours(23, 59, 59, 999);
      query.expiryDate = { $gte: now, $lte: in15Days };
    } else if (status === '30days') {
      const in30Days = new Date();
      in30Days.setDate(now.getDate() + 30);
      in30Days.setHours(23, 59, 59, 999);
      query.expiryDate = { $gte: now, $lte: in30Days };
    } else {
      query.expiryDate = { $ne: null };
    }

    const products = await Product.find(query)
      .populate('supplier', 'name')
      .sort({ expiryDate: 1 });

    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
