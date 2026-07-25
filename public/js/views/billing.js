// Invoicing, Cart Management, Scanner Integrations, and Payments
let cart = [];
let billCustomer = null;
let billingSearchResults = [];
let billingProductsCache = []; // Fast in-memory catalog cache for 0ms scan lookups
let lastScanTimestamp = 0;
let lastScannedCode = '';

let billingCustomerSearchResults = [];
let billingCustomerActiveIndex = -1;

function initBilling() {
  cart = [];
  billCustomer = null;
  renderCartTable();
  calculateCartTotals();
  
  // Clear inputs
  document.getElementById('bill-barcode-input').value = '';
  document.getElementById('bill-name-search').value = '';
  document.getElementById('bill-customer-mobile').value = '';
  document.getElementById('bill-customer-name').value = '';
  
  const searchInput = document.getElementById('bill-customer-search');
  if (searchInput) searchInput.value = '';
  
  const searchGroup = document.getElementById('bill-customer-search-group');
  if (searchGroup) searchGroup.classList.remove('hidden');
  
  const selectedDetails = document.getElementById('bill-customer-selected-details');
  if (selectedDetails) selectedDetails.classList.add('hidden');
  
  const searchResults = document.getElementById('bill-customer-search-results');
  if (searchResults) searchResults.classList.add('hidden');
  
  setupBillingListeners();
  preloadBillingProductsCache();
}

// Preload active products for instant local barcode scans
async function preloadBillingProductsCache() {
  try {
    const res = await API.products.list({ limit: 1000 });
    if (res && res.data) {
      billingProductsCache = res.data;
    }
  } catch (err) {
    console.error('Failed to preload billing catalog cache:', err);
  }
}

function setupBillingListeners() {
  const barcodeInput = document.getElementById('bill-barcode-input');
  const nameInput = document.getElementById('bill-name-search');
  const customerSearchInput = document.getElementById('bill-customer-search');

  // Manual Barcode entry handler
  barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.value.trim();
      if (code) {
        barcodeInput.value = '';
        await handleBarcodeScanCheckout(code);
      }
    }
  });

  // Name autocomplete handler (products) with Instant In-Memory Search
  let searchTimeout;
  nameInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = nameInput.value.trim().toLowerCase();
    if (query.length < 2) {
      document.getElementById('bill-search-results').classList.add('hidden');
      return;
    }

    // 1. Instant local search in preloaded catalog
    if (billingProductsCache.length > 0) {
      const matches = billingProductsCache.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query))
      ).slice(0, 8);

      if (matches.length > 0) {
        renderNameSearchResults(matches);
        return;
      }
    }

    // 2. Server fallback if not in local cache
    searchTimeout = setTimeout(async () => {
      try {
        const res = await API.products.list({ search: query, limit: 8 });
        renderNameSearchResults(res.data);
      } catch (err) {
        console.error(err);
      }
    }, 200);
  });

  // Customer Smart Autocomplete Search Handler
  let customerSearchTimeout;
  customerSearchInput.addEventListener('input', () => {
    clearTimeout(customerSearchTimeout);
    const query = customerSearchInput.value.trim();
    if (query.length < 2) {
      document.getElementById('bill-customer-search-results').classList.add('hidden');
      return;
    }

    customerSearchTimeout = setTimeout(async () => {
      try {
        const res = await API.customers.list({ search: query });
        renderCustomerSearchResults(res.data, query);
      } catch (err) {
        console.error(err);
      }
    }, 200);
  });

  // Keyboard Navigation on Customer Dropdown
  customerSearchInput.addEventListener('keydown', (e) => {
    const dropdown = document.getElementById('bill-customer-search-results');
    if (dropdown.classList.contains('hidden')) return;

    const items = dropdown.querySelectorAll('.search-result-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      billingCustomerActiveIndex = (billingCustomerActiveIndex + 1) % items.length;
      highlightActiveCustomerItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      billingCustomerActiveIndex = (billingCustomerActiveIndex - 1 + items.length) % items.length;
      highlightActiveCustomerItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (billingCustomerActiveIndex >= 0 && billingCustomerActiveIndex < items.length) {
        items[billingCustomerActiveIndex].click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dropdown.classList.add('hidden');
    }
  });

  // Click outside to close customer search dropdown
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('bill-customer-search-results');
    const searchInput = document.getElementById('bill-customer-search');
    if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
      dropdown.classList.add('hidden');
    }
  });
}

function highlightActiveCustomerItem(items) {
  items.forEach((item, idx) => {
    if (idx === billingCustomerActiveIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// Render smart search results
function renderCustomerSearchResults(customers, query) {
  billingCustomerSearchResults = customers;
  billingCustomerActiveIndex = -1;
  const dropdown = document.getElementById('bill-customer-search-results');
  
  let html = '';
  if (customers.length > 0) {
    html = customers.map((c, index) => `
      <div class="search-result-item flex-col align-start" data-type="customer" data-index="${index}" onclick="selectCustomerByIndex(${index})">
        <span style="font-weight:600; color:#fff;">${c.name}</span>
        <span style="font-size:0.8rem; color:var(--text-muted);">${c.mobile}</span>
      </div>
    `).join('');
  } else {
    html = `<div class="p-2 text-center text-muted" style="font-size:0.85rem;">No customer found for "${query}"</div>`;
  }

  // Always append "+ Add New Customer" option
  html += `
    <div class="search-result-item text-center justify-center align-center font-semibold" data-type="add-new" onclick="openBillingCustomerModalWithParams('${query}')" style="color: var(--neon-blue); border-top: 1px solid var(--glass-border); font-size:0.9rem; gap:6px;">
      <i class="fa-solid fa-plus-circle"></i> + Add New Customer
    </div>
  `;

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

// Open modal and pre-fill search query
function openBillingCustomerModalWithParams(query) {
  document.getElementById('bill-customer-search-results').classList.add('hidden');
  document.getElementById('billing-customer-form').reset();
  
  // If query is digits, treat it as mobile, else name
  if (/^\d{10}$/.test(query)) {
    document.getElementById('bill-cust-new-mobile').value = query;
  } else if (/^\d+$/.test(query)) {
    document.getElementById('bill-cust-new-mobile').value = query.slice(0, 10);
  } else {
    document.getElementById('bill-cust-new-name').value = query;
  }
  
  document.getElementById('billing-customer-modal').classList.remove('hidden');
  document.getElementById('bill-cust-new-name').focus();
}

function closeBillingCustomerModal() {
  document.getElementById('billing-customer-modal').classList.add('hidden');
}

// Save customer and auto-select
async function handleBillingCustomerSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('bill-cust-new-name').value.trim();
  const mobile = document.getElementById('bill-cust-new-mobile').value.trim();
  const email = document.getElementById('bill-cust-new-email').value.trim();
  const address = document.getElementById('bill-cust-new-address').value.trim();

  try {
    const res = await API.customers.create({ name, mobile, email, address });
    showToast(`Customer '${name}' registered & selected!`, 'success');
    closeBillingCustomerModal();
    selectCustomer(res.data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Select customer from index
function selectCustomerByIndex(index) {
  const customer = billingCustomerSearchResults[index];
  if (customer) {
    selectCustomer(customer);
  }
}

// Auto-fill selected customer profiles
function selectCustomer(customer) {
  billCustomer = customer;
  document.getElementById('bill-customer-mobile').value = customer.mobile;
  document.getElementById('bill-customer-name').value = customer.name;
  
  // Render details card
  document.getElementById('sel-cust-name-val').textContent = customer.name;
  document.getElementById('sel-cust-mobile-val').textContent = customer.mobile;
  document.getElementById('sel-cust-email-val').textContent = customer.email || 'N/A';
  document.getElementById('sel-cust-address-val').textContent = customer.address || 'N/A';
  document.getElementById('sel-cust-points-val').textContent = customer.rewardPoints || 0;
  document.getElementById('sel-cust-visits-val').textContent = customer.totalVisits || 0;
  
  const lastDate = customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : 'Never';
  document.getElementById('sel-cust-last-date-val').textContent = lastDate;

  // Toggle visibility
  document.getElementById('bill-customer-search-group').classList.add('hidden');
  document.getElementById('bill-customer-selected-details').classList.remove('hidden');
  document.getElementById('bill-customer-search-results').classList.add('hidden');
}

// Clear selected customer profile
function clearSelectedCustomer() {
  billCustomer = null;
  document.getElementById('bill-customer-mobile').value = '';
  document.getElementById('bill-customer-name').value = '';
  document.getElementById('bill-customer-search').value = '';
  
  document.getElementById('bill-customer-search-group').classList.remove('hidden');
  document.getElementById('bill-customer-selected-details').classList.add('hidden');
  document.getElementById('bill-customer-search').focus();
}

// Stub lookupCustomerForBill to prevent any global invocation error
function lookupCustomerForBill() {}

// Render product search suggestions dropdown
function renderNameSearchResults(products) {
  billingSearchResults = products;
  const dropdown = document.getElementById('bill-search-results');
  if (products.length === 0) {
    dropdown.innerHTML = '<div class="p-2 text-center text-muted">No items matched</div>';
  } else {
    dropdown.innerHTML = products.map((p, index) => `
      <div class="search-result-item" onclick="addScannedProductToCartByIndex(${index})">
        <span><strong>${p.name}</strong> <small class="text-muted">(${p.barcode})</small></span>
        <span>₹${p.sellingPrice.toFixed(2)} <small class="text-muted">(Stock: ${p.currentStock})</small></span>
      </div>
    `).join('');
  }
  dropdown.classList.remove('hidden');
}

async function addScannedProductToCartByIndex(index) {
  const product = billingSearchResults[index];
  if (product) {
    await addScannedProductToCart(product);
  }
}

// Barcode Scan Hook with Debounce Guard & Instant In-Memory Cache Lookup
async function handleBarcodeScanCheckout(barcode) {
  const now = Date.now();
  if (now - lastScanTimestamp < 250 && lastScannedCode === barcode) {
    return; // Block rapid duplicate scan triggers within 250ms
  }
  lastScanTimestamp = now;
  lastScannedCode = barcode;

  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return;

  // 1. Instant local cache lookup (0ms latency)
  if (billingProductsCache.length > 0) {
    const cachedProduct = billingProductsCache.find(p => 
      (p.barcode && p.barcode === cleanBarcode) ||
      (p.sku && p.sku === cleanBarcode) ||
      (p._id && p._id === cleanBarcode)
    );
    if (cachedProduct) {
      await addScannedProductToCart(cachedProduct);
      return;
    }
  }

  // 2. Server API lookup fallback
  try {
    const res = await API.products.getByBarcode(cleanBarcode);
    if (res && res.data) {
      billingProductsCache.push(res.data);
      await addScannedProductToCart(res.data);
    }
  } catch (err) {
    showToast(`Barcode SKU not found: ${cleanBarcode}`, 'error');
  }
}

// Add Item to Cart Array
async function addScannedProductToCart(product) {
  // Dismiss dropdowns
  document.getElementById('bill-search-results').classList.add('hidden');
  document.getElementById('bill-name-search').value = '';

  // Expiry check
  if (product.expiryDate) {
    const expDate = new Date(product.expiryDate);
    const now = new Date();
    
    if (expDate < now) {
      showToast(`This product has expired and cannot be sold.`, 'error');
      alert(`Blocked: Product '${product.name}' has expired and cannot be sold.\nExpiry Date: ${expDate.toLocaleDateString()}`);
      return;
    }

    const timeDiff = expDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysRemaining <= 7) {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser.role === 'owner') {
        const confirmAdd = confirm(`Warning: Product '${product.name}' expires in ${daysRemaining} days (Expiry: ${expDate.toLocaleDateString()}). Do you want to allow this sale?`);
        if (!confirmAdd) return;
      } else {
        const ownerPassword = prompt(`Authorization Needed:\nProduct '${product.name}' expires in ${daysRemaining} days.\nPlease enter Owner Password to authorize:`);
        if (!ownerPassword) {
          showToast('Sale blocked: Expiry override canceled.', 'error');
          return;
        }
        
        try {
          await API.auth.verifyOwner(ownerPassword);
          showToast('Owner override authorized.', 'success');
        } catch (err) {
          showToast('Authorization Failed: Invalid owner password.', 'error');
          alert('Blocked: Invalid owner password. Cannot add expiring product.');
          return;
        }
      }
    }
  }

  if (product.currentStock <= 0) {
    showToast(`Product '${product.name}' is Out Of Stock`, 'error');
    return;
  }

  let finalQty = 1;
  const existing = cart.find(item => item.product === product._id);
  if (existing) {
    if (existing.quantity >= product.currentStock) {
      showToast(`Cannot add more. Stock limit: ${product.currentStock}`, 'warning');
      return;
    }
    existing.quantity++;
    finalQty = existing.quantity;
  } else {
    cart.push({
      product: product._id,
      name: product.name,
      barcode: product.barcode,
      mrp: product.mrp,
      sellingPrice: product.sellingPrice,
      purchasePrice: product.purchasePrice,
      gst: product.gst,
      quantity: 1,
      discountAmount: 0,
      stockLimit: product.currentStock
    });
  }

  renderCartTable();
  calculateCartTotals();

  const toastMsg = finalQty > 1 ? `Updated ${product.name} (Qty: ${finalQty})` : `Added ${product.name} to cart`;
  showToast(toastMsg, 'success');
}

// Render Cart HTML table
function renderCartTable() {
  const tbody = document.getElementById('cart-tbody');
  if (cart.length === 0) {
    tbody.innerHTML = `
      <tr class="cart-empty-row">
        <td colspan="8" class="text-center p-5">
          <div class="empty-cart-state">
            <i class="fa-solid fa-basket-shopping text-muted"></i>
            <p>Scanner Active. Scan item or search to start billing.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cart.map((item, index) => {
    const total = (item.sellingPrice * item.quantity) - item.discountAmount;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <strong>${item.name}</strong><br>
          <small class="text-muted"><code>${item.barcode}</code></small>
        </td>
        <td>₹${item.mrp.toFixed(2)}</td>
        <td>₹${item.sellingPrice.toFixed(2)}</td>
        <td>
          <input type="number" value="${item.quantity}" min="1" max="${item.stockLimit}" 
            style="width: 70px; padding: 4px 8px;"
            onchange="updateCartQty('${item.product}', this.value)">
        </td>
        <td>
          <input type="number" value="${item.discountAmount}" min="0" 
            style="width: 80px; padding: 4px 8px;"
            onchange="updateCartDiscount('${item.product}', this.value)">
        </td>
        <td><strong>₹${total.toFixed(2)}</strong></td>
        <td>
          <button class="btn-text" onclick="removeFromCart('${item.product}')" style="color: var(--neon-pink);">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Update quantity
function updateCartQty(productId, qty) {
  const item = cart.find(i => i.product === productId);
  if (item) {
    const val = Number(qty);
    if (val > item.stockLimit) {
      showToast(`Only ${item.stockLimit} in stock`, 'warning');
      item.quantity = item.stockLimit;
    } else if (val < 1) {
      item.quantity = 1;
    } else {
      item.quantity = val;
    }
    renderCartTable();
    calculateCartTotals();
  }
}

// Update discount
function updateCartDiscount(productId, discountVal) {
  const item = cart.find(i => i.product === productId);
  if (item) {
    const val = Number(discountVal);
    const maxDiscount = item.sellingPrice * item.quantity;
    if (val > maxDiscount) {
      showToast(`Discount cannot exceed item selling price`, 'warning');
      item.discountAmount = 0;
    } else if (val < 0) {
      item.discountAmount = 0;
    } else {
      item.discountAmount = val;
    }
    renderCartTable();
    calculateCartTotals();
  }
}

// Delete item
function removeFromCart(productId) {
  cart = cart.filter(i => i.product !== productId);
  renderCartTable();
  calculateCartTotals();
}

// Calculate totals
let cartSubtotal = 0;
let cartDiscount = 0;
let cartGst = 0;
let cartFinal = 0;

function calculateCartTotals() {
  cartSubtotal = 0;
  cartDiscount = 0;
  cartGst = 0;
  cartFinal = 0;

  cart.forEach(item => {
    const itemSub = item.sellingPrice * item.quantity;
    const itemGst = itemSub - (itemSub / (1 + item.gst / 100));

    cartSubtotal += itemSub;
    cartDiscount += item.discountAmount;
    cartGst += itemGst;
  });

  const overallDiscountPct = Number(document.getElementById('bill-overall-discount').value || 0);
  let intermediateTotal = cartSubtotal - cartDiscount;

  if (overallDiscountPct > 0) {
    const overallDiscAmount = (intermediateTotal * overallDiscountPct) / 100;
    cartDiscount += overallDiscAmount;
  }

  cartFinal = cartSubtotal - cartDiscount;
  if (cartFinal < 0) cartFinal = 0;

  // Render to DOM
  document.getElementById('bill-subtotal').textContent = `₹${cartSubtotal.toFixed(2)}`;
  document.getElementById('bill-gst-amount').textContent = `₹${cartGst.toFixed(2)}`;
  document.getElementById('bill-discount-amount').textContent = `-₹${cartDiscount.toFixed(2)}`;
  document.getElementById('bill-final-amount').textContent = `₹${cartFinal.toFixed(2)}`;
}

// Payment Modal Show logic
function openPaymentModal() {
  if (cart.length === 0) {
    showToast('Add items to cart first', 'warning');
    return;
  }

  const mob = document.getElementById('bill-customer-mobile').value.trim();
  if (!mob) {
    showToast('Customer mobile number is required before billing', 'error');
    return;
  }

  document.getElementById('pay-total-val').textContent = `₹${cartFinal.toFixed(2)}`;
  document.getElementById('payment-modal').classList.remove('hidden');
  
  // Set default payment mode fields
  togglePaymentFields();
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.add('hidden');
}

// UPI QR dynamic renderer
let provisionalInvoiceNo = '';
let currentUpiQrDataUrl = '';

async function togglePaymentFields() {
  const mode = document.getElementById('pay-mode').value;
  const qrBox = document.getElementById('pay-upi-qr-box');
  const splitBox = document.getElementById('pay-split-fields');
  const txnBox = document.getElementById('pay-transaction-field');
  const mainCheckoutBtn = document.getElementById('checkout-complete-btn');

  qrBox.classList.add('hidden');
  splitBox.classList.add('hidden');
  txnBox.classList.add('hidden');
  if (mainCheckoutBtn) mainCheckoutBtn.classList.remove('hidden');

  if (mode === 'UPI') {
    if (currentSettings?.enableQrPayment === false) {
      showToast('UPI QR Payment option is currently disabled by the owner.', 'warning');
      document.getElementById('pay-mode').value = 'Cash';
      togglePaymentFields();
      return;
    }

    qrBox.classList.remove('hidden');
    txnBox.classList.remove('hidden');
    if (mainCheckoutBtn) mainCheckoutBtn.classList.add('hidden');
    
    const svgBox = document.getElementById('upi-qrcode-img-box');
    const upiId = currentSettings?.qrCodeUpi || 'kirtanpanchal2006-1@okaxis';
    const shopName = currentSettings?.upiMerchantName || currentSettings?.shopName || 'Super Market';

    try {
      // Fetch official next invoice number from server
      const res = await API.sales.getNextInvoice();
      provisionalInvoiceNo = res.invoiceNo;
    } catch (err) {
      console.error('Failed to get next invoice, using fallback', err);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      provisionalInvoiceNo = 'SALE-' + dateStr + '-' + Math.floor(1000 + Math.random() * 9000);
    }

    document.getElementById('upi-merchant-name').textContent = shopName;
    document.getElementById('upi-string-text').textContent = upiId;
    document.getElementById('upi-invoice-no').textContent = provisionalInvoiceNo;
    document.getElementById('upi-amount-val').textContent = `₹${cartFinal.toFixed(2)}`;

    // Clear QR box first and display loader
    svgBox.innerHTML = '<span class="text-muted" style="font-size:0.85rem;">Generating UPI QR...</span>';
    
    // UPI payment deep link parameters
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&tr=${provisionalInvoiceNo}&tn=Invoice_${provisionalInvoiceNo}&am=${cartFinal.toFixed(2)}&cu=INR`;
    
    // Generate real scan-readable QR Code using the canvas generator
    QRCode.toDataURL(upiLink, { width: 180, margin: 1 }, function (err, url) {
      if (err) {
        console.error(err);
        svgBox.innerHTML = '<span class="text-neon-pink">QR Generation Failed</span>';
        return;
      }
      currentUpiQrDataUrl = url;
      svgBox.innerHTML = `<img src="${url}" alt="UPI QR Code" style="width: 100%; height: 100%; object-fit: contain;">`;
    });

  } else if (mode === 'Card' || mode === 'Wallet') {
    txnBox.classList.remove('hidden');
  } else if (mode === 'Split') {
    splitBox.classList.remove('hidden');
    
    // Reset split fields
    document.getElementById('split-cash').value = cartFinal.toFixed(2);
    document.getElementById('split-upi').value = 0;
    document.getElementById('split-card').value = 0;
    document.getElementById('split-wallet').value = 0;
    
    calculateSplitBalance();
  }
}

function markUpiAsPaid() {
  submitBillCheckout();
}

function cancelUpiPayment() {
  document.getElementById('pay-mode').value = 'Cash';
  togglePaymentFields();
  showToast('UPI Payment cancelled, reverted to Cash.', 'info');
}

// Download generated UPI QR Code as Image
function downloadUpiQR() {
  if (!currentUpiQrDataUrl) {
    showToast('No QR Code available to download', 'warning');
    return;
  }
  const link = document.createElement('a');
  link.href = currentUpiQrDataUrl;
  link.download = `UPI_QR_${provisionalInvoiceNo || Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('UPI QR Code downloaded successfully', 'success');
}

// Calculate remaining balance for split payments
function calculateSplitBalance() {
  const cash = Number(document.getElementById('split-cash').value || 0);
  const upi = Number(document.getElementById('split-upi').value || 0);
  const card = Number(document.getElementById('split-card').value || 0);
  const wallet = Number(document.getElementById('split-wallet').value || 0);

  const sum = cash + upi + card + wallet;
  const remaining = cartFinal - sum;
  const textEl = document.getElementById('split-balance-text');

  if (remaining === 0) {
    textEl.className = 'balance-alert mt-2 text-neon-green';
    textEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Amount balanced!`;
  } else if (remaining > 0) {
    textEl.className = 'balance-alert mt-2 text-neon-yellow';
    textEl.innerHTML = `Remaining: ₹${remaining.toFixed(2)}`;
  } else {
    textEl.className = 'balance-alert mt-2 text-neon-pink';
    textEl.innerHTML = `Overpaid by: ₹${Math.abs(remaining).toFixed(2)}`;
  }
}

// Submit Checkout payload
async function submitBillCheckout() {
  const mode = document.getElementById('pay-mode').value;
  const mobile = document.getElementById('bill-customer-mobile').value.trim();
  const name = document.getElementById('bill-customer-name').value.trim() || 'Walk-in Customer';
  const overallDiscount = Number(document.getElementById('bill-overall-discount').value || 0);
  const coupon = document.getElementById('bill-coupon').value.trim();
  const txnId = document.getElementById('pay-transaction-id').value.trim();

  // Validate Split Payment balance
  let paymentDetails = { cashAmount: cartFinal };
  if (mode === 'Split') {
    const cash = Number(document.getElementById('split-cash').value || 0);
    const upi = Number(document.getElementById('split-upi').value || 0);
    const card = Number(document.getElementById('split-card').value || 0);
    const wallet = Number(document.getElementById('split-wallet').value || 0);
    
    const sum = cash + upi + card + wallet;
    if (Math.abs(cartFinal - sum) > 0.05) {
      showToast('Split payment amounts must sum up to net payable exactly!', 'error');
      return;
    }

    paymentDetails = {
      cashAmount: cash,
      upiAmount: upi,
      cardAmount: card,
      walletAmount: wallet,
      transactionId: txnId
    };
  } else {
    paymentDetails = {
      cashAmount: mode === 'Cash' ? cartFinal : 0,
      upiAmount: mode === 'UPI' ? cartFinal : 0,
      cardAmount: mode === 'Card' ? cartFinal : 0,
      walletAmount: mode === 'Wallet' ? cartFinal : 0,
      transactionId: txnId
    };
  }

  // Construct payload
  const checkoutPayload = {
    customerMobile: mobile,
    customerName: name,
    items: cart.map(i => ({
      product: i.product,
      name: i.name,
      barcode: i.barcode,
      quantity: i.quantity,
      discountAmount: i.discountAmount
    })),
    couponCode: coupon,
    discountPercent: overallDiscount,
    paymentMode: mode,
    paymentDetails
  };

  // Bind the provisional invoice number generated for UPI QR code to matching server invoice
  if (mode === 'UPI' && provisionalInvoiceNo) {
    checkoutPayload.invoiceNo = provisionalInvoiceNo;
  }

  try {
    const res = await API.sales.create(checkoutPayload);
    showToast('Bill checkouts completed successfully!', 'success');
    closePaymentModal();
    
    // Trigger Print Receipt Layout Preview
    renderPrintInvoice(res.data, res.customerDetails);
    
    // Clear cart and reset views
    initBilling();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Render Receipt modal values
function renderPrintInvoice(sale, customerDetails) {
  // Apply printer size layouts
  const printerWrapper = document.getElementById('invoice-printable-wrapper');
  if (currentSettings?.printerType === 'A4') {
    printerWrapper.className = 'invoice-container-print printer-a4';
  } else {
    printerWrapper.className = 'invoice-container-print printer-thermal';
  }

  // Header Details
  document.getElementById('inv-no').textContent = sale.invoiceNo;

  // Brand Logo printing
  const logoWrapper = document.getElementById('inv-logo-wrapper');
  const invLogo = document.getElementById('inv-logo');
  if (logoWrapper && invLogo) {
    if (currentSettings?.shopLogo) {
      invLogo.src = currentSettings.shopLogo;
      logoWrapper.classList.remove('hidden');
    } else {
      invLogo.src = '';
      logoWrapper.classList.add('hidden');
    }
  }
  const d = new Date(sale.createdAt);
  document.getElementById('inv-datetime').textContent = d.toLocaleString();
  document.getElementById('inv-cashier').textContent = currentUser?.name || 'Cashier';
  document.getElementById('inv-cust-name').textContent = customerDetails?.name || 'Walk-in Customer';
  document.getElementById('inv-cust-mobile').textContent = customerDetails?.mobile || 'N/A';
  document.getElementById('inv-cust-points').textContent = customerDetails?.rewardPoints || '0';

  // Items table rows
  const tbody = document.getElementById('inv-tbody');
  tbody.innerHTML = sale.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td class="text-right">₹${item.sellingPrice.toFixed(2)}</td>
      <td class="text-center">${item.quantity}</td>
      <td class="text-right">₹${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  // Calculations
  document.getElementById('inv-subtotal').textContent = `₹${sale.subtotal.toFixed(2)}`;
  document.getElementById('inv-gst').textContent = `₹${sale.totalGst.toFixed(2)}`;
  document.getElementById('inv-discount').textContent = `-₹${sale.totalDiscount.toFixed(2)}`;
  document.getElementById('inv-net').textContent = `₹${sale.finalAmount.toFixed(2)}`;
  document.getElementById('inv-pay-mode').textContent = sale.paymentMode.toUpperCase();

  const printQrBox = document.getElementById('inv-print-qr-box');
  const printQrSvg = document.getElementById('inv-print-qr-svg');

  if (sale.paymentMode === 'UPI' && currentSettings?.enableQrPayment !== false) {
    printQrBox.classList.remove('hidden');
    if (currentSettings?.upiQrImage) {
      printQrSvg.innerHTML = `<img src="${currentSettings.upiQrImage}" alt="Print UPI QR Code" style="width: 80px; height: 80px; object-fit: contain;">`;
    } else {
      printQrSvg.innerHTML = '<span style="font-size:0.75rem;">Generating QR...</span>';
      
      const upiId = currentSettings?.qrCodeUpi || 'market@upi';
      const shopName = currentSettings?.upiMerchantName || currentSettings?.shopName || 'Super Market';
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&tr=${sale.invoiceNo}&tn=Invoice_${sale.invoiceNo}&am=${sale.finalAmount.toFixed(2)}&cu=INR`;
      
      // Generate real scan-readable QR Code inside print receipt image tag
      QRCode.toDataURL(upiLink, { width: 100, margin: 1 }, function (err, url) {
        if (err) {
          printQrSvg.innerHTML = '';
          return;
        }
        printQrSvg.innerHTML = `<img src="${url}" alt="Print UPI QR Code" style="width: 80px; height: 80px; object-fit: contain;">`;
      });
    }
  } else {
    printQrBox.classList.add('hidden');
  }

  // Open Invoice Preview Modal
  document.getElementById('invoice-print-modal').classList.remove('hidden');
}

function closeInvoiceModal() {
  document.getElementById('invoice-print-modal').classList.add('hidden');
}

function resetBillingCart() {
  if (confirm('Are you sure you want to clear the active cart?')) {
    initBilling();
    showToast('Billing cart cleared', 'info');
  }
}
