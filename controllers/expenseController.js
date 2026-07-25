const Expense = require('../models/Expense');
const { logActivity } = require('../middleware/auth');

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().populate('recordedBy', 'name').sort({ expenseDate: -1 });
    res.status(200).json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create an expense
// @route   POST /api/expenses
// @access  Private
exports.createExpense = async (req, res) => {
  try {
    const { title, category, amount, expenseDate, notes } = req.body;
    const expense = await Expense.create({
      title,
      category,
      amount,
      expenseDate,
      notes,
      recordedBy: req.user._id
    });

    await logActivity(req, 'Create Expense', `Expense '${title}' of ₹${amount} recorded`);
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
exports.updateExpense = async (req, res) => {
  try {
    const { title, category, amount, expenseDate, notes } = req.body;
    let expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    expense = await Expense.findByIdAndUpdate(req.params.id, {
      title,
      category,
      amount,
      expenseDate,
      notes
    }, { new: true, runValidators: true });

    await logActivity(req, 'Update Expense', `Expense '${expense.title}' updated`);
    res.status(200).json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    await expense.deleteOne();
    await logActivity(req, 'Delete Expense', `Expense '${expense.title}' deleted`);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
