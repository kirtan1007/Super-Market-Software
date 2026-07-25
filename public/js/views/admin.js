// Super Admin Portal Javascript View Controller
let plans = [];

document.addEventListener('DOMContentLoaded', () => {
  initAdminPortal();
});

async function initAdminPortal() {
  // Check auth session
  if (!authToken) {
    window.location.href = '/#login';
    return;
  }

  try {
    const res = await API.auth.getMe();
    if (res.user.role !== 'superadmin') {
      window.location.href = '/#login';
      return;
    }
    document.getElementById('admin-display-name').textContent = res.user.name;
    
    // Load initial dashboard metrics & pending counts
    await loadMetrics();
    await updatePendingBadgeCount();
    
    // Navigate to initial view
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateAdmin(hash);
  } catch (err) {
    localStorage.removeItem('token');
    authToken = '';
    window.location.href = '/#login';
  }
}

// Admin Navigation Router
function navigateAdmin(viewName) {
  // Hide all views
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.add('hidden'));

  // Show active view
  const activeSec = document.getElementById(`view-${viewName}`);
  if (activeSec) {
    activeSec.classList.remove('hidden');
    document.getElementById('breadcrumb-active').textContent = 
      viewName.charAt(0).toUpperCase() + viewName.slice(1) + ' Settings';
      
    // Update active nav link
    const links = document.querySelectorAll('.sidebar-nav .nav-link');
    links.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === `#${viewName}`) {
        l.classList.add('active');
      }
    });
    
    window.location.hash = viewName;
    
    // Load specific view data
    triggerAdminViewInit(viewName);
  }
}

function triggerAdminViewInit(viewName) {
  switch (viewName) {
    case 'dashboard':
      loadMetrics();
      break;
    case 'shops':
      loadShops();
      break;
    case 'payments':
      loadPendingPayments();
      break;
    case 'plans':
      loadPlans();
      loadGlobalUpiSettings();
      break;
    case 'logins':
      loadLogins();
      break;
  }
}

// Exit Portal
async function adminLogout() {
  await API.auth.logout();
  window.location.href = '/#login';
}


// ==========================================
// 1. FINANCIAL METRICS
// ==========================================
async function loadMetrics() {
  try {
    const res = await API.superadmin.getMetrics();
    const stats = res.data;
    document.getElementById('stat-total-revenue').textContent = `₹${stats.totalRevenue.toFixed(2)}`;
    document.getElementById('stat-monthly-revenue').textContent = `₹${stats.monthlyRevenue.toFixed(2)}`;
    document.getElementById('stat-total-shops').textContent = stats.totalShops;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updatePendingBadgeCount() {
  try {
    const res = await API.superadmin.getPendingPayments();
    const badge = document.getElementById('pending-badge');
    const count = res.data.length;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (err) {
    console.error('Failed to get pending badge count:', err.message);
  }
}


// ==========================================
// 2. SHOPS MANAGEMENT
// ==========================================
async function loadShops() {
  try {
    const res = await API.superadmin.getShops();
    const shopsTbody = document.getElementById('shops-tbody');
    shopsTbody.innerHTML = '';

    if (res.data.length === 0) {
      shopsTbody.innerHTML = `<tr><td colspan="6" class="text-center">No supermarket shops registered.</td></tr>`;
      return;
    }

    res.data.forEach(shop => {
      const tr = document.createElement('tr');
      
      // Status formatting
      let statusHtml = '';
      if (shop.isDeleted) {
        statusHtml = `<span class="badge badge-expired">Deleted</span>`;
      } else if (shop.subscriptionStatus === 'suspended') {
        statusHtml = `<span class="badge badge-expired">Suspended</span>`;
      } else if (shop.subscriptionStatus === 'active') {
        statusHtml = `<span class="badge badge-active">Active</span>`;
      } else if (shop.subscriptionStatus === 'trial') {
        statusHtml = `<span class="badge badge-active">Trial</span>`;
      } else {
        statusHtml = `<span class="badge badge-expired">Expired</span>`;
      }

      const expiryDate = shop.subscriptionEndDate || shop.trialEndDate;
      const expiryText = expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A';

      // Action Buttons
      let actionButtons = '';
      if (shop.isDeleted) {
        actionButtons = `
          <button class="btn-success btn-compact" onclick="restoreShop('${shop._id}')"><i class="fa-solid fa-trash-restore"></i> Restore</button>
        `;
      } else {
        const suspendBtn = shop.active 
          ? `<button class="btn-danger btn-compact" onclick="suspendShop('${shop._id}')"><i class="fa-solid fa-ban"></i> Suspend</button>`
          : `<button class="btn-success btn-compact" onclick="activateShop('${shop._id}')"><i class="fa-solid fa-circle-check"></i> Activate</button>`;
          
        actionButtons = `
          <div class="flex-row gap-1 justify-center">
            ${suspendBtn}
            <button class="btn-primary btn-compact" onclick="promptExtendTrial('${shop._id}')"><i class="fa-solid fa-calendar-plus"></i> Extend</button>
            <button class="btn-primary btn-compact" onclick="promptChangePlan('${shop._id}')" style="background: #e67e22; border-color: #d35400;"><i class="fa-solid fa-sync"></i> Plan</button>
            <button class="btn-secondary btn-compact" onclick="deleteShop('${shop._id}')" style="background: #e74c3c; border-color: #c0392b;"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        `;
      }

      tr.innerHTML = `
        <td>
          <div class="flex-col">
            <strong>${shop.shopName}</strong>
            <span class="text-tiny text-muted">ID: ${shop.shopId || 'N/A'}</span>
          </div>
        </td>
        <td>
          <div class="flex-col text-small">
            <span>Owner: ${shop.name} (${shop.username})</span>
            <span>Mobile: ${shop.mobile}</span>
          </div>
        </td>
        <td><code>${shop.databaseName || 'N/A'}</code></td>
        <td>${statusHtml}</td>
        <td>${expiryText}</td>
        <td class="text-center">${actionButtons}</td>
      `;
      shopsTbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function suspendShop(id) {
  if (!confirm('Are you sure you want to suspend this supermarket shop? The owner, manager, and cashiers will be blocked.')) return;
  try {
    await API.superadmin.suspendShop(id);
    showToast('Shop suspended successfully', 'success');
    loadShops();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function activateShop(id) {
  try {
    await API.superadmin.activateShop(id);
    showToast('Shop activated successfully', 'success');
    loadShops();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function promptExtendTrial(id) {
  const input = prompt('Enter number of days to adjust subscription (e.g. 20 to extend, -20 to shorten/pull back):');
  if (input === null || input.trim() === '') return;
  
  const days = parseInt(input.trim(), 10);
  if (isNaN(days) || days === 0) {
    alert('Invalid number of days. Action cancelled.');
    return;
  }
  
  API.superadmin.extendTrial(id, days)
    .then(res => {
      showToast(res.message, 'success');
      loadShops();
    })
    .catch(err => showToast(err.message, 'error'));
}

async function promptChangePlan(shopId) {
  try {
    const plansRes = await API.superadmin.getPlans();
    const activePlans = plansRes.data;
    if (activePlans.length === 0) {
      alert("No active subscription plans defined.");
      return;
    }
    
    let promptText = "Select a plan to assign manually:\n\n";
    activePlans.forEach((p, idx) => {
      promptText += `${idx + 1}. ${p.name} (₹${p.price} for ${p.durationDays} Days)\n`;
    });
    promptText += "\nEnter the number of the plan (e.g. 1):";
    
    const choice = prompt(promptText);
    if (choice === null || choice === "") return;
    
    const planIdx = parseInt(choice) - 1;
    if (isNaN(planIdx) || planIdx < 0 || planIdx >= activePlans.length) {
      alert("Invalid selection.");
      return;
    }
    
    const selectedPlan = activePlans[planIdx];
    const res = await API.superadmin.changeSubscription(shopId, selectedPlan._id);
    showToast(res.message, 'success');
    loadShops();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteShop(id) {
  if (!confirm('Are you sure you want to soft delete this shop? It can be restored later.')) return;
  try {
    await API.superadmin.deleteShop(id);
    showToast('Shop soft deleted', 'success');
    loadShops();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function restoreShop(id) {
  try {
    await API.superadmin.restoreShop(id);
    showToast('Shop restored', 'success');
    loadShops();
  } catch (err) {
    showToast(err.message, 'error');
  }
}


// ==========================================
// 3. PAYMENTS QUEUE
// ==========================================
async function loadPendingPayments() {
  try {
    const res = await API.superadmin.getPendingPayments();
    const paymentsTbody = document.getElementById('payments-tbody');
    paymentsTbody.innerHTML = '';

    if (!res.data || res.data.length === 0) {
      paymentsTbody.innerHTML = `<tr><td colspan="8" class="text-center">No pending payment verifications.</td></tr>`;
      return;
    }

    res.data.forEach(p => {
      const tr = document.createElement('tr');
      const owner = p.ownerId || {};
      const plan = p.planId || {};

      const screenshotHtml = p.screenshotUrl 
        ? `<a href="${p.screenshotUrl}" target="_blank" class="text-neon-blue" style="font-size:0.85rem;"><i class="fa-solid fa-external-link"></i> View Proof</a>`
        : `<span class="text-muted" style="font-size:0.85rem;">None</span>`;

      const payDateTime = `${p.paymentDate || new Date(p.createdAt).toISOString().split('T')[0]} ${p.paymentTime || ''}`;

      tr.innerHTML = `
        <td>
          <div class="flex-col">
            <strong>${owner.shopName || 'Unknown Shop'}</strong>
            <span class="text-tiny text-muted">ID: ${owner._id || 'N/A'}</span>
            <span class="text-tiny text-muted">Owner: ${owner.name || 'N/A'} (${owner.email || ''})</span>
            <span class="text-tiny text-muted">Phone: ${owner.mobile || 'N/A'}</span>
          </div>
        </td>
        <td><span class="badge badge-active">${plan.name || 'Unknown Plan'}</span></td>
        <td><code>${p.transactionRef}</code></td>
        <td class="text-neon-green font-bold">₹${p.amount.toFixed(2)}</td>
        <td>${payDateTime}</td>
        <td>${screenshotHtml}</td>
        <td><span class="badge badge-expired" style="background: rgba(255, 193, 7, 0.2); color: #ffc107; border: 1px solid #ffc107;">${p.status}</span></td>
        <td class="text-center">
          <div class="flex-row gap-1 justify-center">
            <button class="btn-success btn-compact" onclick="approvePayment('${p._id}')"><i class="fa-solid fa-circle-check"></i> Approve</button>
            <button class="btn-danger btn-compact" onclick="rejectPayment('${p._id}')"><i class="fa-solid fa-circle-xmark"></i> Reject</button>
          </div>
        </td>
      `;
      paymentsTbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function approvePayment(id) {
  const remarks = prompt('Enter approval remarks / transaction notes (optional):');
  if (remarks === null) return; // cancelled
  try {
    await API.superadmin.approvePayment(id, { remarks });
    showToast('Payment approved. Subscription activated!', 'success');
    await updatePendingBadgeCount();
    loadPendingPayments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rejectPayment(id) {
  const remarks = prompt('Enter rejection reason / remarks (optional):');
  if (remarks === null) return; // cancelled
  try {
    await API.superadmin.rejectPayment(id, { remarks });
    showToast('Payment reference rejected', 'error');
    await updatePendingBadgeCount();
    loadPendingPayments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}


// ==========================================
// 4. PLAN BILLING CONFIGURATION
// ==========================================
async function loadPlans() {
  try {
    const res = await API.superadmin.getPlans();
    plans = res.data;
    const plansTbody = document.getElementById('plans-tbody');
    plansTbody.innerHTML = '';

    plans.forEach(p => {
      const tr = document.createElement('tr');
      
      const statusHtml = p.active 
        ? `<span class="badge badge-active">Enabled</span>`
        : `<span class="badge badge-expired">Disabled</span>`;

      tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td class="text-neon-green">₹${p.price.toFixed(2)}</td>
        <td>${p.durationDays} Days</td>
        <td>${statusHtml}</td>
        <td class="text-center">
          <div class="flex-row gap-1 justify-center">
            <button class="btn-primary btn-compact" onclick="editPlan('${p._id}')"><i class="fa-solid fa-edit"></i> Edit</button>
            <button class="btn-danger btn-compact" onclick="deletePlan('${p._id}')"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </td>
      `;
      plansTbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editPlan(id) {
  const plan = plans.find(p => p._id === id);
  if (!plan) return;

  document.getElementById('plan-id').value = plan._id;
  document.getElementById('plan-name').value = plan.name;
  document.getElementById('plan-price').value = plan.price;
  document.getElementById('plan-duration').value = plan.durationDays;
  document.getElementById('plan-desc').value = plan.description || '';
  
  document.getElementById('plan-form-title').textContent = 'Edit Subscription Plan';
  document.getElementById('plan-reset-btn').classList.remove('hidden');
}

function resetPlanForm() {
  document.getElementById('plan-id').value = '';
  document.getElementById('plan-name').value = '';
  document.getElementById('plan-price').value = '';
  document.getElementById('plan-duration').value = '';
  document.getElementById('plan-desc').value = '';
  
  document.getElementById('plan-form-title').textContent = 'Create Subscription Plan';
  document.getElementById('plan-reset-btn').classList.add('hidden');
}

async function savePlan(e) {
  e.preventDefault();
  const id = document.getElementById('plan-id').value;
  const name = document.getElementById('plan-name').value.trim();
  const price = parseFloat(document.getElementById('plan-price').value);
  const durationDays = parseInt(document.getElementById('plan-duration').value);
  const description = document.getElementById('plan-desc').value.trim();

  const planData = { name, price, durationDays, description, active: true };

  try {
    if (id) {
      await API.superadmin.updatePlan(id, planData);
      showToast('Plan updated successfully', 'success');
    } else {
      await API.superadmin.createPlan(planData);
      showToast('Plan created successfully', 'success');
    }
    resetPlanForm();
    loadPlans();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePlan(id) {
  if (!confirm('Are you sure you want to delete this billing plan?')) return;
  try {
    await API.superadmin.deletePlan(id);
    showToast('Plan deleted successfully', 'success');
    loadPlans();
  } catch (err) {
    showToast(err.message, 'error');
  }
}


// ==========================================
// 5. SECURITY LOGIN LOGS
// ==========================================
async function loadLogins() {
  try {
    const res = await API.superadmin.getLoginHistory();
    const loginsTbody = document.getElementById('logins-tbody');
    loginsTbody.innerHTML = '';

    if (res.data.length === 0) {
      loginsTbody.innerHTML = `<tr><td colspan="5" class="text-center">No active logins recorded.</td></tr>`;
      return;
    }

    res.data.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(log.createdAt || log.timestamp).toLocaleString()}</td>
        <td><strong>${log.username}</strong></td>
        <td><span class="badge ${log.role === 'superadmin' ? 'badge-expired' : 'badge-active'}">${log.role.toUpperCase()}</span></td>
        <td><code>${log.ipAddress}</code></td>
        <td class="text-small text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.userAgent}</td>
      `;
      loginsTbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadGlobalUpiSettings() {
  try {
    const res = await API.superadmin.getGlobalConfig();
    const d = res.data;
    const upiInput = document.getElementById('global-upi-id');
    const merchantInput = document.getElementById('global-merchant-name');
    if (upiInput) upiInput.value = d.platformUpiId || '';
    if (merchantInput) merchantInput.value = d.platformMerchantName || '';
  } catch (err) {
    showToast('Failed to load global UPI configuration: ' + err.message, 'error');
  }
}

async function saveGlobalUpiSettings(event) {
  event.preventDefault();
  const platformUpiId = document.getElementById('global-upi-id').value.trim();
  const platformMerchantName = document.getElementById('global-merchant-name').value.trim();

  try {
    const res = await API.superadmin.updateGlobalConfig({ platformUpiId, platformMerchantName });
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
