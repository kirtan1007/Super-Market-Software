// Stock Replenishment View Controller
let purchaseDraftItems = [];
let selectedPurchaseProduct = null;
let purchaseSearchResults = [];

async function initPurchases() {
  purchaseDraftItems = [];
  selectedPurchaseProduct = null;
  
  // Clear inputs (null-safe)
  const form  = document.getElementById('purchase-form');
  const tbody = document.getElementById('pur-draft-tbody');
  const total = document.getElementById('pur-draft-total');
  if (form)  form.reset();
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No items added to draft list.</td></tr>`;
  if (total) total.textContent = '₹0.00';

  await loadSuppliersDropdown();
  await loadPurchaseHistory();
  setupPurchaseListeners();
}

async function loadSuppliersDropdown() {
  try {
    const res = await API.suppliers.list();
    const select = document.getElementById('pur-supplier');
    select.innerHTML = '<option value="">Select Supplier</option>' + 
      res.data.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
  } catch (err) {
    console.error(err);
  }
}

async function loadPurchaseHistory() {
  try {
    const res = await API.purchases.list();
    const tbody = document.getElementById('purchase-history-tbody');
    
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No purchases recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(p => {
      const date = new Date(p.purchaseDate).toLocaleDateString();
      return `
        <tr>
          <td><strong>${p.invoiceNo}</strong></td>
          <td>${p.supplier?.name || 'Unknown Supplier'}</td>
          <td>${date}</td>
          <td>₹${p.totalAmount.toFixed(2)}</td>
          <td>${p.items.length} Items</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

function setupPurchaseListeners() {
  const prodSearch = document.getElementById('pur-product-search');
  const resultsDiv = document.getElementById('pur-search-results');

  // Search product name/barcode autocomplete
  let searchTimeout;
  prodSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = prodSearch.value.trim();
    if (query.length < 2) {
      resultsDiv.classList.add('hidden');
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const res = await API.products.list({ search: query, limit: 5 });
        renderPurchaseSearchResults(res.data);
      } catch (err) {
        console.error(err);
      }
    }, 250);
  });

  // Main Form Submit checkout
  const form = document.getElementById('purchase-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const supplier = document.getElementById('pur-supplier').value;
    const invoiceNo = document.getElementById('pur-invoice-no').value.trim();
    const purchaseDate = document.getElementById('pur-date').value;

    if (!supplier || !invoiceNo || !purchaseDate) {
      showToast('Supplier, Invoice No, and Date are required', 'error');
      return;
    }

    if (purchaseDraftItems.length === 0) {
      showToast('Please add items to draft list first', 'error');
      return;
    }

    const payload = {
      supplier,
      invoiceNo,
      purchaseDate,
      items: purchaseDraftItems.map(i => ({
        product: i.product,
        quantity: i.quantity,
        purchasePrice: i.purchasePrice,
        gstPercent: i.gstPercent,
        gstAmount: i.gstAmount,
        total: i.total
      })),
      totalAmount: calculateDraftTotalAmount()
    };

    try {
      await API.purchases.create(payload);
      showToast('Purchase invoice logged. Inventory stock automatically added.', 'success');
      initPurchases(); // Reset
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

function renderPurchaseSearchResults(products) {
  purchaseSearchResults = products;
  const dropdown = document.getElementById('pur-search-results');
  dropdown.innerHTML = products.map((p, index) => `
    <div class="search-result-item" onclick="selectProductForPurchaseByIndex(${index})">
      <span><strong>${p.name}</strong> <small class="text-muted">(${p.barcode})</small></span>
      <span>Cost: ₹${p.purchasePrice.toFixed(2)}</span>
    </div>
  `).join('');
  dropdown.classList.remove('hidden');
}

function selectProductForPurchaseByIndex(index) {
  const product = purchaseSearchResults[index];
  if (product) {
    selectProductForPurchase(product);
  }
}

function selectProductForPurchase(product) {
  selectedPurchaseProduct = product;
  const searchEl = document.getElementById('pur-product-search');
  const costEl   = document.getElementById('pur-item-cost');
  const resEl    = document.getElementById('pur-search-results');
  if (searchEl) searchEl.value = product.name;
  if (costEl)   costEl.value   = product.purchasePrice;
  if (resEl)    resEl.classList.add('hidden');
}

// Add Item Draft row
function addPurchaseItemToDraft() {
  if (!selectedPurchaseProduct) {
    showToast('Please search and select a product first', 'warning');
    return;
  }

  const qty = Number(document.getElementById('pur-item-qty').value || 1);
  const cost = Number(document.getElementById('pur-item-cost').value || 0);

  if (qty < 1 || cost <= 0) {
    showToast('Quantity and cost must be greater than zero', 'error');
    return;
  }

  const subtotal = cost * qty;
  const gstPercent = selectedPurchaseProduct.gst;
  const gstAmount = subtotal - (subtotal / (1 + gstPercent / 100));

  // Check if already in draft list
  const existing = purchaseDraftItems.find(i => i.product === selectedPurchaseProduct._id);
  if (existing) {
    existing.quantity += qty;
    existing.total = existing.purchasePrice * existing.quantity;
    existing.gstAmount = existing.total - (existing.total / (1 + existing.gstPercent / 100));
  } else {
    purchaseDraftItems.push({
      product: selectedPurchaseProduct._id,
      name: selectedPurchaseProduct.name,
      barcode: selectedPurchaseProduct.barcode,
      quantity: qty,
      purchasePrice: cost,
      gstPercent,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      total: parseFloat(subtotal.toFixed(2))
    });
  }

  renderPurchaseDraftTable();
  
  // Reset draft search inputs
  selectedPurchaseProduct = null;
  const pSearch = document.getElementById('pur-product-search');
  const pQty    = document.getElementById('pur-item-qty');
  const pCost   = document.getElementById('pur-item-cost');
  if (pSearch) pSearch.value = '';
  if (pQty)    pQty.value    = '1';
  if (pCost)   pCost.value   = '';
}

function renderPurchaseDraftTable() {
  const tbody = document.getElementById('pur-draft-tbody');
  const totalEl = document.getElementById('pur-draft-total');
  if (!tbody) return;

  if (purchaseDraftItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No items added to draft list.</td></tr>`;
    if (totalEl) totalEl.textContent = '₹0.00';
    return;
  }

  tbody.innerHTML = purchaseDraftItems.map((item, index) => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td><code>${item.barcode}</code></td>
      <td>${item.quantity}</td>
      <td>₹${item.purchasePrice.toFixed(2)}</td>
      <td><strong>₹${item.total.toFixed(2)}</strong></td>
      <td>
        <button class="btn-text" onclick="removePurchaseDraftItem(${index})" style="color: var(--neon-pink);">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');

  const total = calculateDraftTotalAmount();
  if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
}

function calculateDraftTotalAmount() {
  return purchaseDraftItems.reduce((sum, item) => sum + item.total, 0);
}

function removePurchaseDraftItem(index) {
  purchaseDraftItems.splice(index, 1);
  renderPurchaseDraftTable();
}

// Scan barcode to instantly select product in purchase entry
async function handleBarcodeScanPurchase(barcode) {
  try {
    const res = await API.products.getByBarcode(barcode);
    if (res && res.data) {
      selectProductForPurchase(res.data);
      showToast(`Scanned and selected: ${res.data.name}`, 'success');
    } else {
      showToast('Product not found with this barcode', 'warning');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
