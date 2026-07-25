const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const StockHistory = require('../models/StockHistory');
const Category = require('../models/Category');
const { logActivity } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { isValidEan13, generateEan13 } = require('../utils/barcodeHelper');

// @desc    Get all products (with pagination, search, filters)
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '', brand = '', minStockAlert = 'false', batch = '', supplier = '', expiry = '', sortBy = '' } = req.query;

    const query = {};

    // Apply filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (brand) {
      query.brand = brand;
    }

    if (minStockAlert === 'true') {
      // Find products where currentStock <= minimumStock
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }

    if (batch) {
      query.batchNumber = { $regex: batch, $options: 'i' };
    }

    if (supplier) {
      const Supplier = require('../models/Supplier');
      const matchedSuppliers = await Supplier.find({ name: { $regex: supplier, $options: 'i' } });
      const supplierIds = matchedSuppliers.map(s => s._id);
      query.supplier = { $in: supplierIds };
    }

    if (expiry) {
      const expDateStart = new Date(expiry);
      expDateStart.setHours(0, 0, 0, 0);
      const expDateEnd = new Date(expiry);
      expDateEnd.setHours(23, 59, 59, 999);
      query.expiryDate = { $gte: expDateStart, $lte: expDateEnd };
    }

    let sortQuery = { createdAt: -1 };
    if (sortBy === 'expiryDate') {
      sortQuery = { expiryDate: 1 };
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('supplier', 'name')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort(sortQuery);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: Number(page),
      data: products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product by barcode (essential for scanner)
// @route   GET /api/products/barcode/:barcode
// @access  Private
exports.getProductByBarcode = async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode }).populate('supplier', 'name');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found with this barcode' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Private
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('supplier', 'name');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Owner Only)
exports.createProduct = async (req, res) => {
  try {
    const productData = { ...req.body };

    // Auto-generate barcode if not provided or empty
    if (!productData.barcode || String(productData.barcode).trim() === '') {
      let generatedBarcode = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 100) {
        generatedBarcode = generateEan13();
        const barcodeExists = await Product.findOne({ barcode: generatedBarcode });
        if (!barcodeExists) {
          isUnique = true;
        }
        attempts++;
      }
      if (!isUnique) {
        return res.status(500).json({ success: false, message: 'Failed to generate a unique EAN-13 barcode' });
      }
      productData.barcode = generatedBarcode;
    } else {
      // Validate EAN-13 format
      productData.barcode = String(productData.barcode).trim();
      if (!isValidEan13(productData.barcode)) {
        return res.status(400).json({ success: false, message: 'Invalid EAN-13 barcode format or checksum. EAN-13 must be exactly 13 digits.' });
      }
    }

    // Check if barcode already exists
    const barcodeExists = await Product.findOne({ barcode: productData.barcode });
    if (barcodeExists) {
      return res.status(400).json({ success: false, message: 'A product with this barcode already exists' });
    }

    // Handle uploaded file if present
    if (req.file) {
      productData.productImage = `/uploads/${req.file.filename}`;
    }

    const product = await Product.create(productData);

    // Sync Category
    if (product.category) {
      await Category.findOneAndUpdate(
        { name: product.category },
        { name: product.category },
        { upsert: true, new: true }
      );
    }

    // Sync Inventory
    const invStatus = product.currentStock === 0 ? 'Out of Stock' : (product.currentStock <= product.minimumStock ? 'Low Stock' : 'In Stock');
    await Inventory.create({
      product: product._id,
      quantity: product.currentStock,
      status: invStatus
    });

    // Log StockHistory
    await StockHistory.create({
      product: product._id,
      changeType: 'Increase',
      quantity: product.currentStock,
      previousStock: 0,
      newStock: product.currentStock,
      reference: 'Product Creation',
      recordedBy: req.user ? req.user._id : null
    });

    await logActivity(req, 'Create Product', `Product '${product.name}' (Barcode: ${product.barcode}) created`);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Owner Only)
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const updateData = { ...req.body };
    const previousStock = product.currentStock;

    // Verify barcode uniqueness and validity if changing
    if (updateData.barcode) {
      updateData.barcode = String(updateData.barcode).trim();
      if (updateData.barcode !== product.barcode) {
        if (!isValidEan13(updateData.barcode)) {
          return res.status(400).json({ success: false, message: 'Invalid EAN-13 barcode format or checksum. EAN-13 must be exactly 13 digits.' });
        }
        const barcodeExists = await Product.findOne({ barcode: updateData.barcode });
        if (barcodeExists) {
          return res.status(400).json({ success: false, message: 'A product with this barcode already exists' });
        }
      } else {
        // Remove barcode from update payload if it is unchanged
        delete updateData.barcode;
      }
    }

    // Handle image upload
    if (req.file) {
      // Delete old image if it exists and is not default
      if (product.productImage && product.productImage.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', 'public', product.productImage);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      updateData.productImage = `/uploads/${req.file.filename}`;
    }

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    // Sync Category
    if (product.category) {
      await Category.findOneAndUpdate(
        { name: product.category },
        { name: product.category },
        { upsert: true, new: true }
      );
    }

    // Sync Inventory and StockHistory if quantity changed
    const newStock = product.currentStock;
    if (previousStock !== newStock) {
      const diff = newStock - previousStock;
      const changeType = diff > 0 ? 'Increase' : 'Decrease';
      
      const invStatus = newStock === 0 ? 'Out of Stock' : (newStock <= product.minimumStock ? 'Low Stock' : 'In Stock');
      await Inventory.findOneAndUpdate(
        { product: product._id },
        { quantity: newStock, status: invStatus, lastUpdated: new Date() },
        { upsert: true, new: true }
      );

      await StockHistory.create({
        product: product._id,
        changeType,
        quantity: Math.abs(diff),
        previousStock,
        newStock,
        reference: 'Manual Adjustment',
        recordedBy: req.user ? req.user._id : null
      });
    } else {
      const invStatus = newStock === 0 ? 'Out of Stock' : (newStock <= product.minimumStock ? 'Low Stock' : 'In Stock');
      await Inventory.findOneAndUpdate(
        { product: product._id },
        { status: invStatus, lastUpdated: new Date() },
        { upsert: true }
      );
    }

    await logActivity(req, 'Update Product', `Product '${product.name}' (Barcode: ${product.barcode}) updated`);

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Owner Only)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const previousStock = product.currentStock;

    // Delete image file
    if (product.productImage && product.productImage.startsWith('/uploads/')) {
      const imgPath = path.join(__dirname, '..', 'public', product.productImage);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    await Product.findByIdAndDelete(req.params.id);

    // Delete Inventory
    await Inventory.findOneAndDelete({ product: product._id });

    // Log StockHistory
    await StockHistory.create({
      product: product._id,
      changeType: 'Decrease',
      quantity: previousStock,
      previousStock,
      newStock: 0,
      reference: 'Product Deletion',
      recordedBy: req.user ? req.user._id : null
    });

    await logActivity(req, 'Delete Product', `Product '${product.name}' (Barcode: ${product.barcode}) deleted`);

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk CSV Import
// @route   POST /api/products/import-csv
// @access  Private (Owner Only)
exports.importProductsCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Parse CSV simple parser
    const lines = fileContent.split(/\r?\n/);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV file is empty or missing data' });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const importedProducts = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle commas inside quotes
      const values = [];
      let currentVal = '';
      let insideQuote = false;
      for (let char of line) {
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          values.push(currentVal.trim().replace(/^"|"$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^"|"$/g, ''));

      if (values.length < headers.length) {
        errors.push(`Line ${i + 1}: Column count mismatch`);
        continue;
      }

      // Map values to row object
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      // Map row to Product schema
      try {
        const rawBarcode = row.barcode || row.Barcode;
        const name = row.name || row.Name;
        const category = row.category || row.Category || 'General';
        const purchasePrice = Number(row.purchasePrice || row.PurchasePrice || 0);
        const sellingPrice = Number(row.sellingPrice || row.SellingPrice || 0);
        const mrp = Number(row.mrp || row.MRP || sellingPrice);
        const gst = Number(row.gst || row.GST || 0);
        const currentStock = Number(row.currentStock || row.CurrentStock || 0);
        const minimumStock = Number(row.minimumStock || row.MinimumStock || 5);
        const brand = row.brand || row.Brand || '';
        const subcategory = row.subcategory || row.Subcategory || '';
        const rackNumber = row.rackNumber || row.RackNumber || '';
        const batchNumber = row.batchNumber || row.BatchNumber || '';
        const description = row.description || row.Description || '';

        if (!name || !rawBarcode) {
          errors.push(`Line ${i + 1}: Name and Barcode are required`);
          continue;
        }

        const barcode = String(rawBarcode).trim();
        if (!isValidEan13(barcode)) {
          errors.push(`Line ${i + 1}: Invalid EAN-13 barcode '${barcode}' format or checksum`);
          continue;
        }

        // Upsert product (update if barcode exists, otherwise insert)
        const existingProduct = await Product.findOne({ barcode });
        const prevStock = existingProduct ? existingProduct.currentStock : 0;

        const updatedProduct = await Product.findOneAndUpdate(
          { barcode },
          {
            name,
            category,
            subcategory,
            brand,
            purchasePrice,
            sellingPrice,
            mrp,
            gst,
            currentStock,
            minimumStock,
            rackNumber,
            batchNumber,
            description
          },
          { upsert: true, new: true }
        );

        // Sync Category
        if (category) {
          await Category.findOneAndUpdate(
            { name: category },
            { name: category },
            { upsert: true }
          );
        }

        // Sync Inventory
        const invStatus = currentStock === 0 ? 'Out of Stock' : (currentStock <= minimumStock ? 'Low Stock' : 'In Stock');
        await Inventory.findOneAndUpdate(
          { product: updatedProduct._id },
          { quantity: currentStock, status: invStatus, lastUpdated: new Date() },
          { upsert: true }
        );

        // Log StockHistory if stock changed
        if (prevStock !== currentStock) {
          const diff = currentStock - prevStock;
          await StockHistory.create({
            product: updatedProduct._id,
            changeType: diff > 0 ? 'Increase' : 'Decrease',
            quantity: Math.abs(diff),
            previousStock: prevStock,
            newStock: currentStock,
            reference: 'CSV Bulk Import',
            recordedBy: req.user ? req.user._id : null
          });
        }

        importedProducts.push(updatedProduct);
      } catch (err) {
        errors.push(`Line ${i + 1}: ${err.message}`);
      }
    }

    // Clean up temporary file
    fs.unlinkSync(filePath);

    await logActivity(req, 'CSV Import Products', `Imported ${importedProducts.length} products via CSV with ${errors.length} errors`);

    res.status(200).json({
      success: true,
      message: `Import completed. Successful: ${importedProducts.length}, Failed: ${errors.length}`,
      errors,
      importedCount: importedProducts.length
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Regenerate all non-EAN-13 barcodes into valid EAN-13 format
// @route   POST /api/products/regenerate-barcodes
// @access  Private (Owner Only)
exports.regenerateBarcodes = async (req, res) => {
  try {
    const products = await Product.find();
    let regeneratedCount = 0;

    for (let product of products) {
      if (!isValidEan13(product.barcode)) {
        // Generate a new unique EAN-13 barcode
        let generatedBarcode = '';
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 100) {
          generatedBarcode = generateEan13();
          const barcodeExists = await Product.findOne({ barcode: generatedBarcode });
          if (!barcodeExists) {
            isUnique = true;
          }
          attempts++;
        }
        if (!isUnique) {
          return res.status(500).json({ success: false, message: 'Failed to generate a unique barcode for product: ' + product.name });
        }
        
        product.barcode = generatedBarcode;
        await product.save();
        regeneratedCount++;
      }
    }

    await logActivity(req, 'Regenerate Barcodes', `Regenerated ${regeneratedCount} product barcodes to EAN-13 format`);

    res.status(200).json({
      success: true,
      message: `Successfully regenerated ${regeneratedCount} barcodes.`,
      count: regeneratedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
