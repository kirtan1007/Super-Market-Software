const Payment = require('../models/Payment');
const { logActivity } = require('../middleware/auth');

// @desc    Get all payment records
// @route   GET /api/payments
// @access  Private
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate({
      path: 'sale',
      populate: { path: 'customer cashier' }
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create manual payment log
// @route   POST /api/payments
// @access  Private
exports.createPayment = async (req, res) => {
  try {
    const { sale, paymentNo, amount, method, status, transactionId } = req.body;
    const payment = await Payment.create({
      sale,
      paymentNo,
      amount,
      method,
      status,
      transactionId
    });

    await logActivity(req, 'Record Payment', `Payment of ₹${amount} recorded via ${method} for sale ID ${sale}`);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete payment record
// @route   DELETE /api/payments/:id
// @access  Private
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    await payment.deleteOne();
    await logActivity(req, 'Delete Payment', `Payment record '${payment.paymentNo}' deleted`);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
