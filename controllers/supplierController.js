const Supplier = require('../models/Supplier');
const { logActivity } = require('../middleware/auth');

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a supplier
// @route   POST /api/suppliers
// @access  Private (Owner Only)
exports.createSupplier = async (req, res) => {
  try {
    const { name, contactPerson, mobile, email, address, gstNumber } = req.body;

    const supplierExists = await Supplier.findOne({ mobile });
    if (supplierExists) {
      return res.status(400).json({ success: false, message: 'Supplier with this mobile number already exists' });
    }

    const supplier = await Supplier.create({
      name,
      contactPerson,
      mobile,
      email,
      address,
      gstNumber
    });

    await logActivity(req, 'Create Supplier', `Supplier '${name}' added`);

    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a supplier
// @route   PUT /api/suppliers/:id
// @access  Private (Owner Only)
exports.updateSupplier = async (req, res) => {
  try {
    let supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    await logActivity(req, 'Update Supplier', `Supplier '${supplier.name}' details updated`);

    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a supplier
// @route   DELETE /api/suppliers/:id
// @access  Private (Owner Only)
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    await Supplier.findByIdAndDelete(req.params.id);

    await logActivity(req, 'Delete Supplier', `Supplier '${supplier.name}' deleted`);

    res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
