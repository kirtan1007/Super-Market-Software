// Product Directory View Controller
let productCurrentPage = 1;
const productPageLimit = 10;
let selectedBarcodeProduct = null;
let productSortBy = '';

async function initProducts() {
  productCurrentPage = 1;
  productSortBy = '';
  await loadSuppliersSelectOptions();
  await loadProductDirectory();
  setupProductFormListener();
}

// Fetch suppliers to populate Product creation select box
async function loadSuppliersSelectOptions() {
  try {
    const res = await API.suppliers.list();
    const select = document.getElementById('prod-supplier');
    if (select) {
      select.innerHTML = '<option value="">Select Supplier</option>' + 
        res.data.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load suppliers list', err);
  }
}

// Toggle Expiry Date sort
function toggleExpirySort() {
  productSortBy = productSortBy === 'expiryDate' ? '' : 'expiryDate';
  loadProductDirectory();
}

// Fetch and render inventory directory
async function loadProductDirectory() {
  const search = document.getElementById('prod-filter-search').value.trim();
  const category = document.getElementById('prod-filter-category').value;
  const lowStock = document.getElementById('prod-filter-low-stock').checked;
  const batch = document.getElementById('prod-filter-batch').value.trim();
  const supplier = document.getElementById('prod-filter-supplier').value.trim();
  const expiry = document.getElementById('prod-filter-expiry').value;

  const params = {
    page: productCurrentPage,
    limit: productPageLimit,
    search,
    category,
    minStockAlert: lowStock ? 'true' : 'false',
    batch,
    supplier,
    expiry,
    sortBy: productSortBy
  };

  try {
    const res = await API.products.list(params);
    renderProductsTable(res.data);
    
    // Pagination updates
    document.getElementById('products-pagination-info').textContent = `Showing page ${res.currentPage} of ${res.pages || 1}`;
    document.getElementById('btn-prod-prev').disabled = res.currentPage === 1;
    document.getElementById('btn-prod-next').disabled = res.currentPage >= res.pages;
  } catch (err) {
    showToast('Failed to load products: ' + err.message, 'error');
  }
}

// Render inventory items to DOM
function renderProductsTable(products) {
  const tbody = document.getElementById('products-table-body');
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="text-center text-muted">No products found.</td></tr>`;
    return;
  }

  // Make the Expiry Date header clickable to toggle sort
  const tableHeaderRow = document.querySelector('#view-products .data-table thead tr');
  if (tableHeaderRow) {
    const expiryHeader = tableHeaderRow.cells[9];
    if (expiryHeader) {
      expiryHeader.style.cursor = 'pointer';
      expiryHeader.title = 'Click to sort by Expiry Date';
      expiryHeader.onclick = toggleExpirySort;
      expiryHeader.innerHTML = `Expiry Date <i class="fa-solid ${productSortBy === 'expiryDate' ? 'fa-arrow-down-short-wide text-neon-blue' : 'fa-sort'}"></i>`;
    }
  }

  tbody.innerHTML = products.map(p => {
    const imageTag = p.productImage 
      ? `<img src="${p.productImage}" class="table-prod-img" alt="Prod">`
      : `<div class="table-prod-img flex-row align-center justify-center bg-neon-blue-light text-neon-blue"><i class="fa-solid fa-box"></i></div>`;

    const isLowStock = p.currentStock <= p.minimumStock;
    const stockClass = p.currentStock === 0 ? 'text-neon-pink' : (isLowStock ? 'text-neon-yellow' : 'text-neon-green');

    // Expiry status calculations
    let daysLeftText = 'N/A';
    let badgeText = 'No Expiry';
    let badgeStyle = 'background: rgba(255, 255, 255, 0.05); color: var(--text-muted);';

    if (p.expiryDate) {
      const expDate = new Date(p.expiryDate);
      const now = new Date();
      const timeDiff = expDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      daysLeftText = daysRemaining;

      if (daysRemaining < 0) {
        badgeStyle = 'background: rgba(139, 0, 0, 0.15); color: #ff5555;';
        badgeText = 'Expired';
      } else if (daysRemaining === 0) {
        badgeStyle = 'background: rgba(255, 51, 51, 0.15); color: #ff3333;';
        badgeText = 'Expires Today';
      } else if (daysRemaining <= 7) {
        badgeStyle = 'background: rgba(255, 51, 51, 0.15); color: #ff3333;';
        badgeText = 'Red Warning (<=7d)';
      } else if (daysRemaining <= 15) {
        badgeStyle = 'background: rgba(255, 140, 0, 0.15); color: #ff8c00;';
        badgeText = 'Orange Alert (<=15d)';
      } else if (daysRemaining <= 30) {
        badgeStyle = 'background: rgba(255, 215, 0, 0.15); color: #ffd700;';
        badgeText = 'Yellow Alert (<=30d)';
      } else {
        badgeStyle = 'background: rgba(0, 204, 102, 0.15); color: #00cc66;';
        badgeText = 'Green (Fresh)';
      }
    }

    // Owner controls
    const actionsHtml = currentUser && currentUser.role === 'owner'
      ? `
        <td class="owner-only">
          <button class="btn-text" onclick="openProductModal('${p._id}')" title="Edit Product"><i class="fa-solid fa-pen-to-square text-neon-blue"></i></button>
          <button class="btn-text" onclick="deleteProduct('${p._id}')" title="Delete Product" style="margin-left: 8px;"><i class="fa-solid fa-trash-can text-neon-pink"></i></button>
        </td>
      `
      : '';

    return `
      <tr>
        <td>${imageTag}</td>
        <td>
          <strong>${p.name}</strong><br>
          <small class="text-muted">Brand: ${p.brand || 'Local'} | Supplier: ${p.supplier?.name || 'N/A'}</small>
        </td>
        <td>
          <code>${p.barcode}</code>
          <button class="btn-text" style="font-size: 0.8rem; margin-left: 4px;" onclick="generateBarcodeLabel('${p._id}')" title="Generate Barcode"><i class="fa-solid fa-qrcode"></i></button>
        </td>
        <td><span class="badge-status active">${p.category}</span></td>
        <td>₹${p.purchasePrice.toFixed(2)}</td>
        <td>₹${p.sellingPrice.toFixed(2)}</td>
        <td>${p.gst}%</td>
        <td><strong class="${stockClass}">${p.currentStock}</strong> / ${p.minimumStock}</td>
        <td>
          <small>Rack: ${p.rackNumber || 'N/A'}</small><br>
          <small class="text-muted">Batch: ${p.batchNumber || 'N/A'}</small>
        </td>
        <td>${p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : 'N/A'}</td>
        <td><strong>${daysLeftText}</strong></td>
        <td><span class="badge-status" style="${badgeStyle}">${badgeText}</span></td>
        ${actionsHtml}
      </tr>
    `;
  }).join('');
}

// Pagination logic
function changeProductPage(direction) {
  productCurrentPage += direction;
  loadProductDirectory();
}

// Set up Mongoose forms logic
function setupProductFormListener() {
  const form = document.getElementById('product-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const barcode = document.getElementById('prod-barcode').value.trim();
    const originalBarcode = document.getElementById('prod-barcode').getAttribute('data-original');

    // Validate EAN-13 if new or changed
    if (barcode !== originalBarcode) {
      if (!barcode) {
        showToast('Barcode is required', 'error');
        return;
      }
      if (!/^\d{13}$/.test(barcode)) {
        showToast('Invalid barcode. EAN-13 barcode must be exactly 13 digits.', 'error');
        return;
      }
      // Calculate and verify EAN-13 checksum
      const prefix = barcode.slice(0, 12);
      const checksum = parseInt(barcode[12], 10);
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(prefix[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
      }
      const calculated = (10 - (sum % 10)) % 10;
      if (checksum !== calculated) {
        showToast('Invalid EAN-13 checksum. Please check the barcode digits or click Gen to generate a valid one.', 'error');
        return;
      }
    }
    const category = document.getElementById('prod-category').value;
    const subcategory = document.getElementById('prod-subcategory').value;
    const brand = document.getElementById('prod-brand').value;
    const supplier = document.getElementById('prod-supplier').value;
    const purchasePrice = document.getElementById('prod-purchase-price').value;
    const sellingPrice = document.getElementById('prod-selling-price').value;
    const mrp = document.getElementById('prod-mrp').value;
    const gst = document.getElementById('prod-gst').value;
    const currentStock = document.getElementById('prod-current-stock').value;
    const minimumStock = document.getElementById('prod-minimum-stock').value;
    const mfgDate = document.getElementById('prod-mfg-date').value;
    const expiryDate = document.getElementById('prod-expiry-date').value;
    const shelfLife = document.getElementById('prod-shelf-life').value;
    const batchNumber = document.getElementById('prod-batch').value;
    const rackNumber = document.getElementById('prod-rack').value;
    const description = document.getElementById('prod-desc').value;
    
    const fileInput = document.getElementById('prod-image-file');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('barcode', barcode);
    formData.append('category', category);
    formData.append('subcategory', subcategory);
    formData.append('brand', brand);
    if (supplier) formData.append('supplier', supplier);
    formData.append('purchasePrice', purchasePrice);
    formData.append('sellingPrice', sellingPrice);
    formData.append('mrp', mrp);
    formData.append('gst', gst);
    formData.append('currentStock', currentStock);
    formData.append('minimumStock', minimumStock);
    if (mfgDate) formData.append('mfgDate', mfgDate);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    if (shelfLife) formData.append('shelfLife', shelfLife);
    formData.append('batchNumber', batchNumber);
    formData.append('rackNumber', rackNumber);
    formData.append('description', description);
    
    if (fileInput.files.length > 0) {
      formData.append('productImage', fileInput.files[0]);
    }

    try {
      if (id) {
        await API.products.update(id, formData);
        showToast('Product updated successfully', 'success');
      } else {
        await API.products.create(formData);
        showToast('Product created successfully', 'success');
      }
      closeProductModal();
      loadProductDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // CSV Import Submit
  const csvForm = document.getElementById('csv-import-form');
  if (csvForm) {
    csvForm.onsubmit = async (e) => {
      e.preventDefault();
      const csvInput = document.getElementById('csv-file-input');
      if (csvInput.files.length === 0) return;

      const formData = new FormData();
      formData.append('csvFile', csvInput.files[0]);

      try {
        const res = await API.products.importCsv(formData);
        showToast(res.message, 'success');
        closeCsvModal();
        loadProductDirectory();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
}

// Generate Barcode Labels Dialog triggers
async function generateBarcodeLabel(id) {
  try {
    const res = await API.products.getById(id);
    selectedBarcodeProduct = res.data;

    // Reset copies to 1
    const copiesInput = document.getElementById('barcode-copies');
    if (copiesInput) {
      copiesInput.value = '1';
    }

    updateBarcodePreview();

    document.getElementById('barcode-label-modal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateBarcodePreview() {
  if (!selectedBarcodeProduct) return;

  const copies = Math.max(1, Number(document.getElementById('barcode-copies')?.value || 1));
  const container = document.getElementById('barcode-printable-area');
  container.innerHTML = '';

  const barcodeValue = String(selectedBarcodeProduct.barcode || '').trim();

  // Generate copies number of sticker cards
  for (let i = 0; i < copies; i++) {
    container.innerHTML += `
      <div class="barcode-sticker">
        <div class="barcode-lbl-shop">${currentSettings?.shopName || 'Super Market'}</div>
        <div class="barcode-lbl-name">${selectedBarcodeProduct.name}</div>
        <div class="barcode-lines-render" style="height: 20mm; width: 100%; display: flex; justify-content: center; align-items: center;">
          <svg class="barcode-svg" data-value="${barcodeValue}"></svg>
        </div>
        <div class="barcode-lbl-price">MRP: ₹${selectedBarcodeProduct.mrp.toFixed(2)}</div>
      </div>
    `;
  }

  // Draw EAN-13 barcodes using JsBarcode
  document.querySelectorAll('.barcode-svg').forEach(el => {
    try {
      const val = el.getAttribute('data-value');
      JsBarcode(el, val, {
        format: 'EAN13',
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 0
      });
    } catch (err) {
      console.error('JsBarcode rendering error:', err);
      el.innerHTML = '<span style="font-size: 0.7rem; color: #d80064; font-weight: 600;">Render Error (Not EAN-13)</span>';
    }
  });
}

function printBarcodeLabel() {
  // Focus elements on new browser printable window
  window.print();
}

function closeBarcodeModal() {
  document.getElementById('barcode-label-modal').classList.add('hidden');
}

// Product modal CRUD
async function openProductModal(id = null) {
  // Reset Form
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('product-modal-title').textContent = 'Add Inventory Product';

  if (id) {
    try {
      const res = await API.products.getById(id);
      const prod = res.data;

      document.getElementById('prod-id').value = prod._id;
      document.getElementById('prod-name').value = prod.name;
      document.getElementById('prod-barcode').value = prod.barcode;
      document.getElementById('prod-barcode').setAttribute('data-original', prod.barcode || '');
      document.getElementById('prod-category').value = prod.category;
      document.getElementById('prod-subcategory').value = prod.subcategory || '';
      document.getElementById('prod-brand').value = prod.brand || '';
      document.getElementById('prod-supplier').value = prod.supplier?._id || '';
      document.getElementById('prod-purchase-price').value = prod.purchasePrice;
      document.getElementById('prod-selling-price').value = prod.sellingPrice;
      document.getElementById('prod-mrp').value = prod.mrp;
      document.getElementById('prod-gst').value = prod.gst;
      document.getElementById('prod-current-stock').value = prod.currentStock;
      document.getElementById('prod-minimum-stock').value = prod.minimumStock;
      document.getElementById('prod-batch').value = prod.batchNumber || '';
      document.getElementById('prod-rack').value = prod.rackNumber || '';
      document.getElementById('prod-desc').value = prod.description || '';
      
      if (prod.mfgDate) {
        document.getElementById('prod-mfg-date').value = new Date(prod.mfgDate).toISOString().split('T')[0];
      }
      if (prod.expiryDate) {
        document.getElementById('prod-expiry-date').value = new Date(prod.expiryDate).toISOString().split('T')[0];
      }
      document.getElementById('prod-shelf-life').value = prod.shelfLife || '';

      document.getElementById('product-modal-title').textContent = 'Modify Inventory Product';
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else {
    document.getElementById('prod-barcode').removeAttribute('data-original');
    // Auto-generate barcode on creation
    generateRandomBarcode();
  }

  document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

async function deleteProduct(id) {
  if (confirm('Are you sure you want to delete this product? This action is irreversible.')) {
    try {
      await API.products.delete(id);
      showToast('Product deleted', 'success');
      loadProductDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

function calculateClientEan13Checksum(prefix) {
  if (prefix.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(prefix[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function generateRandomBarcode() {
  const prefix = '890' + Math.floor(100000000 + Math.random() * 900000000).toString();
  const checksum = calculateClientEan13Checksum(prefix);
  const rand = prefix + checksum;
  document.getElementById('prod-barcode').value = rand;
}

async function triggerRegenerateBarcodes() {
  if (confirm('Are you sure you want to regenerate all non-EAN-13 barcodes into valid EAN-13 format? This will update older barcodes to valid 13-digit EAN-13 barcodes and is irreversible.')) {
    try {
      const res = await API.products.regenerateBarcodes();
      showToast(res.message || `Successfully regenerated ${res.count} barcodes!`, 'success');
      loadProductDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

// CSV import dialog triggers
function openCsvModal() {
  document.getElementById('csv-import-form').reset();
  document.getElementById('csv-modal').classList.remove('hidden');
}

function closeCsvModal() {
  document.getElementById('csv-modal').classList.add('hidden');
}
