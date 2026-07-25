// Customers View Controller
async function initCustomers() {
  await loadCustomersDirectory();
  setupCustomerFormListener();
}

async function loadCustomersDirectory() {
  try {
    const res = await API.customers.list();
    renderCustomersTable(res.data);
  } catch (err) {
    showToast('Failed to load customers: ' + err.message, 'error');
  }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customers-table-body');
  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No customers registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => {
    const lastVisit = c.lastPurchaseDate 
      ? new Date(c.lastPurchaseDate).toLocaleDateString()
      : 'Never';
    return `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td><code>${c.mobile}</code></td>
        <td>${c.email || 'N/A'}</td>
        <td>${c.address || 'N/A'}</td>
        <td>${c.totalVisits}</td>
        <td>₹${c.totalPurchase.toFixed(2)}</td>
        <td><strong class="text-neon-green"><i class="fa-solid fa-award"></i> ${c.rewardPoints}</strong></td>
        <td>${lastVisit}</td>
        <td>
          <button class="btn-text" onclick="viewCustomerPurchaseHistory('${c._id}', '${c.name}')" title="Purchase History">
            <i class="fa-solid fa-clock-rotate-left"></i> History
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupCustomerFormListener() {
  const form = document.getElementById('customer-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById('cust-name').value.trim();
    const mobile = document.getElementById('cust-mobile').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const address = document.getElementById('cust-address').value.trim();

    try {
      await API.customers.create({ name, mobile, email, address });
      showToast(`Customer '${name}' registered successfully`, 'success');
      closeCustomerModal();
      loadCustomersDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

async function viewCustomerPurchaseHistory(id, name) {
  try {
    const res = await API.customers.getHistory(id);
    
    // Redirect to Reports view and load filtered results, or simply display them in a neat alert.
    // Let's print customer history in audit log modal since it has a large table space!
    const logModal = document.getElementById('audit-log-modal');
    const logTitle = logModal.querySelector('.modal-header h3');
    const logTbody = document.getElementById('audit-logs-tbody');

    logTitle.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Purchase History: ${name}`;
    
    // Change column headers
    logModal.querySelector('.data-table thead tr').innerHTML = `
      <th>Invoice No</th>
      <th>Date</th>
      <th>Products</th>
      <th>Payment Mode</th>
      <th>GST Tax</th>
      <th>Invoice Amount</th>
    `;

    if (res.data.length === 0) {
      logTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No purchase history logged.</td></tr>`;
    } else {
      logTbody.innerHTML = res.data.map(sale => {
        const d = new Date(sale.createdAt);
        const productsList = (sale.items || []).map(item => `${item.name} (x${item.quantity})`).join('<br>');
        return `
          <tr>
            <td><strong>${sale.invoiceNo}</strong></td>
            <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="font-size: 0.85rem; max-width: 250px; white-space: normal; line-height: 1.2; text-align: left;">${productsList || 'N/A'}</td>
            <td><span class="badge-status active">${sale.paymentMode}</span></td>
            <td>₹${sale.totalGst.toFixed(2)}</td>
            <td><strong>₹${sale.finalAmount.toFixed(2)}</strong></td>
          </tr>
        `;
      }).join('');
    }

    logModal.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCustomerModal() {
  const form = document.getElementById('customer-form');
  if (form) form.reset();
  const modal = document.getElementById('customer-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeCustomerModal() {
  const modal = document.getElementById('customer-modal');
  if (modal) modal.classList.add('hidden');
}
