// ============================================================
// Subscription Page — Full Controller (Redesigned)
// ============================================================

let loadedPlans = [];
let selectedPlanId = null;
let selectedPlanData = null;
let subUpiId = 'market@upi';
let subMerchantName = 'Super Market';

// ─────────────────────────────────────────────
// INIT — called by router when view activates
// ─────────────────────────────────────────────
async function initSubscription() {
  try {
    // Default payment date/time
    const dateEl = document.getElementById('sub-payment-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    const timeEl = document.getElementById('sub-payment-time');
    if (timeEl && !timeEl.value) {
      timeEl.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Load in parallel
    await Promise.all([
      loadSubscriptionStatus(),
      loadSubscriptionPlans()
    ]);
  } catch (err) {
    showToast(err.message || 'Failed to initialize subscription page', 'error');
  }
}

// ─────────────────────────────────────────────
// Load current subscription status + status cards
// ─────────────────────────────────────────────
async function loadSubscriptionStatus() {
  try {
    const res = await API.subscriptions.getStatus();
    const d = res.data;

    // Load platform UPI configurations
    subUpiId = d.platformUpiId || 'market@upi';
    subMerchantName = d.platformMerchantName || 'Super Market';
    const upiDisplayEl = document.getElementById('sub-upi-id-display');
    if (upiDisplayEl) upiDisplayEl.textContent = subUpiId;

    // Shop name
    const shopNameEl = document.getElementById('sub-shop-name');
    if (shopNameEl) shopNameEl.textContent = d.shopName || currentSettings?.shopName || '—';

    // Current plan (from subscription status)
    const planEl = document.getElementById('sub-current-plan');
    if (planEl) planEl.textContent = d.currentPlan || d.status?.toUpperCase() || '—';

    // Expiry date
    const expiryEl = document.getElementById('sub-expiry-date');
    if (expiryEl) {
      expiryEl.textContent = d.expiryDate
        ? new Date(d.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
    }

    // Days expired (negative daysRemaining = days past expiry)
    const daysExpiredEl = document.getElementById('sub-days-since-expiry');
    const badgeEl = document.getElementById('sub-days-expired-count');
    const warningBanner = document.getElementById('sub-warning-banner');
    const warningTextH1 = warningBanner ? warningBanner.querySelector('.sub-warning-text h1') : null;
    const warningTextP = warningBanner ? warningBanner.querySelector('.sub-warning-text p') : null;
    const warningIcon = warningBanner ? warningBanner.querySelector('.sub-warning-icon i') : null;
    const warningBadgeLabel = warningBanner ? warningBanner.querySelector('.sub-warning-badge small') : null;

    if (d.daysRemaining <= 0 || d.status === 'expired' || d.status === 'suspended') {
      // Expired state
      if (warningBanner) {
        warningBanner.style.background = 'linear-gradient(135deg, rgba(255, 51, 51, 0.15) 0%, rgba(255, 100, 0, 0.1) 100%)';
        warningBanner.style.borderColor = 'rgba(255, 51, 51, 0.4)';
        warningBanner.style.borderLeftColor = 'var(--neon-red)';
      }
      if (warningTextH1) {
        warningTextH1.textContent = '⚠ Subscription Expired';
        warningTextH1.style.color = 'var(--neon-red)';
      }
      if (warningTextP) warningTextP.textContent = 'Your Super Market ERP subscription has expired. Please renew your subscription to continue using the software.';
      if (warningIcon) {
        warningIcon.className = 'fa-solid fa-triangle-exclamation';
        warningIcon.style.color = 'var(--neon-red)';
        warningIcon.style.background = 'rgba(255, 51, 51, 0.15)';
      }
      if (warningBadgeLabel) warningBadgeLabel.textContent = 'Days Expired';
      
      const daysAgo = Math.abs(d.daysRemaining);
      if (daysExpiredEl) daysExpiredEl.textContent = `${daysAgo} days ago`;
      if (badgeEl) {
        badgeEl.textContent = daysAgo;
        badgeEl.style.color = 'var(--neon-red)';
        const badgeParent = badgeEl.parentElement;
        if (badgeParent) {
          badgeParent.style.borderColor = 'rgba(255, 51, 51, 0.35)';
          badgeParent.style.background = 'rgba(255, 51, 51, 0.12)';
        }
      }
    } else {
      // Active state
      if (warningBanner) {
        warningBanner.style.background = 'linear-gradient(135deg, rgba(57, 255, 20, 0.15) 0%, rgba(0, 200, 80, 0.1) 100%)';
        warningBanner.style.borderColor = 'rgba(57, 255, 20, 0.4)';
        warningBanner.style.borderLeftColor = 'var(--neon-green)';
      }
      if (warningTextH1) {
        warningTextH1.textContent = '✓ Subscription Active';
        warningTextH1.style.color = 'var(--neon-green)';
      }
      if (warningTextP) warningTextP.textContent = 'Thank you for subscribing! Your Premium Subscription is fully active and unlocked.';
      if (warningIcon) {
        warningIcon.className = 'fa-solid fa-circle-check';
        warningIcon.style.color = 'var(--neon-green)';
        warningIcon.style.background = 'rgba(57, 255, 20, 0.15)';
      }
      if (warningBadgeLabel) warningBadgeLabel.textContent = 'Days Left';
      if (daysExpiredEl) daysExpiredEl.textContent = `${d.daysRemaining} days left`;
      if (badgeEl) {
        badgeEl.textContent = d.daysRemaining;
        badgeEl.style.color = 'var(--neon-green)';
        const badgeParent = badgeEl.parentElement;
        if (badgeParent) {
          badgeParent.style.borderColor = 'rgba(57, 255, 20, 0.35)';
          badgeParent.style.background = 'rgba(57, 255, 20, 0.12)';
        }
      }
    }

    // Check if payment is pending
    await checkPendingPayment();
  } catch (err) {
    console.error('loadSubscriptionStatus error:', err.message);
  }
}

// ─────────────────────────────────────────────
// Check if owner has a pending payment request
// ─────────────────────────────────────────────
async function checkPendingPayment() {
  try {
    const res = await API.subscriptions.getPaymentStatus();
    const pendingBanner = document.getElementById('sub-pending-banner');
    const renewalStatusEl = document.getElementById('sub-renewal-status');
    const renewalCard = document.getElementById('sub-renewal-status-card');
    const step1 = document.getElementById('sub-step-1');
    const step2 = document.getElementById('sub-step-2');

    if (res.hasPending) {
      // Show pending banner + success card
      if (pendingBanner) pendingBanner.classList.remove('hidden');
      if (step1) step1.classList.add('hidden');
      if (step2) {
        step2.classList.remove('hidden');
        // Fill in pending details
        const detailsEl = document.getElementById('sub-success-details');
        if (detailsEl && res.payment) {
          detailsEl.innerHTML = `
            <div class="sub-success-detail-row"><span>Plan</span><strong>${res.payment.planName || '—'}</strong></div>
            <div class="sub-success-detail-row"><span>Amount</span><strong>₹${res.payment.amount?.toFixed(2) || '—'}</strong></div>
            <div class="sub-success-detail-row"><span>UTR Ref</span><strong>${res.payment.transactionRef || '—'}</strong></div>
            <div class="sub-success-detail-row"><span>Submitted</span><strong>${res.payment.createdAt ? new Date(res.payment.createdAt).toLocaleDateString('en-IN') : '—'}</strong></div>
            <div class="sub-success-detail-row"><span>Status</span><strong class="sub-status-pending">⏳ Pending Admin Review</strong></div>
          `;
        }
      }
      if (renewalStatusEl) renewalStatusEl.textContent = '⏳ Pending Approval';
      if (renewalCard) {
        renewalCard.classList.remove('sub-stat-warning');
        renewalCard.classList.add('sub-stat-info');
      }
    } else {
      if (pendingBanner) pendingBanner.classList.add('hidden');
      if (step1) step1.classList.remove('hidden');
      if (step2) step2.classList.add('hidden');
      if (renewalStatusEl) renewalStatusEl.textContent = 'No Request';
    }
  } catch (err) {
    // API may not exist yet — gracefully ignore
    console.error('checkPendingPayment error:', err.message);
  }
}

// ─────────────────────────────────────────────
// Load plans and render plan cards
// ─────────────────────────────────────────────
async function loadSubscriptionPlans() {
  try {
    const res = await API.subscriptions.getPlans();
    loadedPlans = res.data || [];
    renderPlanCards();
  } catch (err) {
    const list = document.getElementById('sub-plans-list');
    if (list) list.innerHTML = '<p class="text-muted">Failed to load plans.</p>';
  }
}

// Plan card icons by duration
const PLAN_ICONS = {
  30:  { icon: 'fa-calendar',        label: '1 Month',   gradient: 'linear-gradient(135deg,#00c6ff,#0072ff)' },
  90:  { icon: 'fa-calendar-days',   label: '3 Months',  gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  180: { icon: 'fa-star',            label: '6 Months',  gradient: 'linear-gradient(135deg,#f7971e,#ffd200)' },
  365: { icon: 'fa-crown',           label: '12 Months', gradient: 'linear-gradient(135deg,#11998e,#38ef7d)' }
};

function renderPlanCards() {
  const list = document.getElementById('sub-plans-list');
  if (!list) return;

  if (!loadedPlans.length) {
    list.innerHTML = '<p class="text-muted">No plans available. Contact support.</p>';
    return;
  }

  list.innerHTML = loadedPlans.map(plan => {
    const meta = PLAN_ICONS[plan.durationDays] || { icon: 'fa-box', label: plan.name, gradient: 'linear-gradient(135deg,#667eea,#764ba2)' };
    const savings = plan.durationDays >= 90 ? Math.round(100 - (plan.price / (plan.price / plan.durationDays * 30) / (plan.durationDays / 30) * 100)) : 0;
    return `
      <div class="sub-plan-card" id="plan-card-${plan._id}" onclick="selectPlan('${plan._id}')">
        <div class="sub-plan-icon" style="background:${meta.gradient}">
          <i class="fa-solid ${meta.icon}"></i>
        </div>
        <div class="sub-plan-info">
          <strong>${plan.name} Plan</strong>
          <small>${plan.durationDays} Days Access</small>
          ${plan.description ? `<span class="sub-plan-desc">${plan.description}</span>` : ''}
        </div>
        <div class="sub-plan-price-tag">
          <span>₹${plan.price.toLocaleString('en-IN')}</span>
          ${plan.durationDays >= 90 ? `<small class="sub-save-badge">Save More!</small>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
// Select a plan
// ─────────────────────────────────────────────
function selectPlan(planId) {
  selectedPlanId = planId;
  selectedPlanData = loadedPlans.find(p => p._id === planId);

  // Visual selection
  document.querySelectorAll('.sub-plan-card').forEach(card => card.classList.remove('sub-plan-selected'));
  const selected = document.getElementById(`plan-card-${planId}`);
  if (selected) selected.classList.add('sub-plan-selected');

  // Update QR
  generateSubscriptionQR(selectedPlanData);

  // Update amount display
  const amountEl = document.getElementById('sub-selected-amount');
  if (amountEl && selectedPlanData) {
    amountEl.textContent = `₹${selectedPlanData.price.toLocaleString('en-IN')}`;
    amountEl.style.color = 'var(--neon-green)';
  }

  // Update plan summary
  const summaryEl = document.getElementById('sub-plan-summary-text');
  if (summaryEl && selectedPlanData) {
    summaryEl.textContent = `${selectedPlanData.name} Plan — ₹${selectedPlanData.price.toLocaleString('en-IN')} for ${selectedPlanData.durationDays} days`;
  }

  // Enable submit button
  const btn = document.getElementById('sub-pay-btn');
  if (btn) btn.disabled = false;
}

// ─────────────────────────────────────────────
// Generate QR Code for selected plan
// ─────────────────────────────────────────────
function generateSubscriptionQR(plan) {
  if (!plan) return;
  const canvasHolder = document.getElementById('sub-payment-qr-canvas');
  if (!canvasHolder) return;

  canvasHolder.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 170;
  canvas.height = 170;
  canvasHolder.appendChild(canvas);

  const invoiceNo = `SUB-${Date.now()}`;
  const upiUrl = `upi://pay?pa=${encodeURIComponent(subUpiId)}&pn=${encodeURIComponent(subMerchantName)}&am=${plan.price.toFixed(2)}&tr=${invoiceNo}&tn=${encodeURIComponent('Plan ' + plan.name)}&cu=INR`;

  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(canvas, upiUrl, { width: 170, margin: 1, color: { dark: '#000000', light: '#ffffff' } }, function(err) {
      if (err) canvasHolder.innerHTML = '<p class="text-muted">QR error</p>';
    });
  } else {
    canvasHolder.innerHTML = '<p class="text-muted" style="font-size:0.75rem;">QR library not loaded</p>';
  }
}

// ─────────────────────────────────────────────
// Load UPI settings from server settings
// ─────────────────────────────────────────────
async function loadUpiSettings() {
  try {
    if (currentSettings) {
      subUpiId = currentSettings.qrCodeUpi || 'market@upi';
      subMerchantName = currentSettings.upiMerchantName || 'Super Market';
      const upiEl = document.getElementById('sub-upi-id-display');
      if (upiEl) upiEl.textContent = subUpiId;
    }
  } catch (err) {
    console.error('loadUpiSettings error:', err.message);
  }
}

// ─────────────────────────────────────────────
// Copy UPI ID to clipboard
// ─────────────────────────────────────────────
function copyUpiId() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(subUpiId).then(() => {
      showToast(`UPI ID copied: ${subUpiId}`, 'success');
    });
  } else {
    // Fallback
    const tmp = document.createElement('input');
    tmp.value = subUpiId;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    showToast(`UPI ID copied: ${subUpiId}`, 'success');
  }
}

// ─────────────────────────────────────────────
// Submit Payment Request
// ─────────────────────────────────────────────
async function submitSubscriptionRenewal(event) {
  event.preventDefault();

  if (!selectedPlanId) {
    showToast('Please select a subscription plan first', 'error');
    return;
  }

  const txRef    = document.getElementById('sub-transaction-ref').value.trim();
  const payDate  = document.getElementById('sub-payment-date').value;
  const payTime  = document.getElementById('sub-payment-time').value.trim();
  const fileInput = document.getElementById('sub-screenshot-file');

  if (!txRef) {
    showToast('UTR / Transaction Reference ID is required', 'error');
    return;
  }

  const btn = document.getElementById('sub-pay-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
  }

  try {
    // Handle optional screenshot upload
    let screenshotUrl = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        showToast('Screenshot file is too large (max 2MB)', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> I Have Paid — Submit for Approval'; }
        return;
      }
      // Upload screenshot
      const formData = new FormData();
      formData.append('screenshot', file);
      try {
        const uploadRes = await API.subscriptions.uploadScreenshot(formData);
        screenshotUrl = uploadRes.url || '';
      } catch (uploadErr) {
        // Non-fatal — proceed without screenshot
        console.warn('Screenshot upload failed:', uploadErr.message);
      }
    }

    const res = await API.subscriptions.submitPay({
      planId: selectedPlanId,
      transactionRef: txRef,
      paymentDate: payDate,
      paymentTime: payTime,
      screenshotUrl
    });

    showToast(res.message || 'Payment submitted successfully!', 'success');

    // Show success card
    const step1 = document.getElementById('sub-step-1');
    const step2 = document.getElementById('sub-step-2');
    const pendingBanner = document.getElementById('sub-pending-banner');

    if (step1) step1.classList.add('hidden');
    if (pendingBanner) pendingBanner.classList.remove('hidden');

    if (step2) {
      step2.classList.remove('hidden');
      const detailsEl = document.getElementById('sub-success-details');
      if (detailsEl && selectedPlanData) {
        detailsEl.innerHTML = `
          <div class="sub-success-detail-row"><span>Plan</span><strong>${selectedPlanData.name} Plan</strong></div>
          <div class="sub-success-detail-row"><span>Amount</span><strong>₹${selectedPlanData.price.toLocaleString('en-IN')}</strong></div>
          <div class="sub-success-detail-row"><span>UTR Ref</span><strong>${txRef}</strong></div>
          <div class="sub-success-detail-row"><span>Date</span><strong>${payDate} ${payTime}</strong></div>
          <div class="sub-success-detail-row"><span>Status</span><strong class="sub-status-pending">⏳ Pending Admin Review</strong></div>
        `;
      }
    }

    // Update renewal status card
    const renewalEl = document.getElementById('sub-renewal-status');
    if (renewalEl) renewalEl.textContent = '⏳ Pending Approval';

  } catch (err) {
    showToast(err.message || 'Submission failed. Try again.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> I Have Paid — Submit for Approval';
    }
  }
}

// ─────────────────────────────────────────────
// Support buttons
// ─────────────────────────────────────────────
function openWhatsAppSupport() {
  const msg = encodeURIComponent('Hello, I need help with my Super Market ERP subscription renewal.');
  window.open(`https://wa.me/919574646343?text=${msg}`, '_blank');
}

function openEmailSupport() {
  window.location.href = 'mailto:support@supermarketsoftware.com?subject=Subscription%20Renewal%20Support&body=Hello%2C%20I%20need%20help%20with%20my%20subscription%20renewal.';
}

// ─────────────────────────────────────────────
// Legacy shim — keep updateDynamicSubscriptionQR accessible
// ─────────────────────────────────────────────
function updateDynamicSubscriptionQR() {
  if (selectedPlanData) generateSubscriptionQR(selectedPlanData);
}
