const Employee = require('../models/Employee');
const User = require('../models/User');
const { logActivity } = require('../middleware/auth');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().populate('user', 'name username email mobile role active').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create/Link employee details to a user
// @route   POST /api/employees
// @access  Private
exports.createEmployee = async (req, res) => {
  try {
    const { userId, salary, department, status, joiningDate } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const employeeExists = await Employee.findOne({ user: userId });
    if (employeeExists) {
      return res.status(400).json({ success: false, message: 'Employee profile already exists for this user' });
    }

    const employee = await Employee.create({
      user: userId,
      salary,
      department,
      status,
      joiningDate
    });

    await logActivity(req, 'Create Employee', `Employee profile created for user '${user.username}'`);
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update employee details
// @route   PUT /api/employees/:id
// @access  Private
exports.updateEmployee = async (req, res) => {
  try {
    const { salary, department, status, joiningDate } = req.body;
    let employee = await Employee.findById(req.params.id).populate('user', 'username');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    employee = await Employee.findByIdAndUpdate(req.params.id, {
      salary,
      department,
      status,
      joiningDate
    }, { new: true, runValidators: true }).populate('user', 'name username');

    await logActivity(req, 'Update Employee', `Employee profile for '${employee.user.username}' updated`);
    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete employee details
// @route   DELETE /api/employees/:id
// @access  Private
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('user', 'username');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    await employee.deleteOne();
    await logActivity(req, 'Delete Employee', `Employee profile for '${employee.user.username}' deleted`);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
