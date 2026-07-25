const User = require('../models/User');
const { logActivity } = require('../middleware/auth');

// @desc    Get all workers
exports.getWorkers = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.ownerId;
    const workers = await User.find({ 
      ownerId,
      role: { $nin: ['owner', 'superadmin'] } 
    }).select('-password');
    res.status(200).json({ success: true, data: workers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a worker
exports.createWorker = async (req, res) => {
  try {
    const { name, username, email, mobile, password, role } = req.body;

    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Username or Email already registered' });
    }

    const allowedRoles = ['worker', 'manager', 'cashier', 'staff', 'employee'];
    const finalRole = allowedRoles.includes(role) ? role : 'worker';

    const worker = await User.create({
      name,
      username,
      email,
      mobile,
      password,
      role: finalRole,
      createdBy: req.user._id,
      ownerId: req.user.ownerId || req.user._id,
      shopId: req.user.shopId || req.user._id.toString(),
      tenantId: req.user.tenantId || req.user._id.toString()
    });

    worker.password = undefined;

    await logActivity(req, 'Create Worker', `Worker account '${username}' with role '${finalRole}' created by owner`);

    res.status(201).json({ success: true, data: worker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update worker profile
exports.updateWorker = async (req, res) => {
  try {
    const { name, email, mobile, active, role } = req.body;
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.ownerId;

    let worker = await User.findOne({ _id: req.params.id, ownerId });
    if (!worker || worker.role === 'owner') {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const allowedRoles = ['worker', 'manager', 'cashier', 'staff', 'employee'];
    if (role && allowedRoles.includes(role)) {
      worker.role = role;
    }

    worker.name = name || worker.name;
    worker.email = email || worker.email;
    worker.mobile = mobile || worker.mobile;
    if (active !== undefined) worker.active = active;

    await worker.save();
    worker.password = undefined;

    await logActivity(req, 'Update Worker', `Worker account '${worker.username}' updated by owner`);

    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a worker
exports.deleteWorker = async (req, res) => {
  try {
    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.ownerId;
    const worker = await User.findOne({ _id: req.params.id, ownerId });
    if (!worker || worker.role === 'owner') {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    await logActivity(req, 'Delete Worker', `Worker account '${worker.username}' deleted by owner`);

    res.status(200).json({ success: true, message: 'Worker account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset worker password by owner
exports.resetWorkerPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const ownerId = req.user.role === 'owner' ? req.user._id : req.user.ownerId;
    let worker = await User.findOne({ _id: req.params.id, ownerId });
    if (!worker || worker.role === 'owner') {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    worker.password = newPassword;
    await worker.save();

    await logActivity(req, 'Reset Worker Password', `Password for worker '${worker.username}' reset by owner`);

    res.status(200).json({ success: true, message: `Password for worker '${worker.username}' reset successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
