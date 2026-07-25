// SPA Router, Scanner Integration, Themes, and Shortcuts
let currentUser = null;
let currentSettings = null;
let systemAlerts = [];

// USB Barcode Scanner Globals
let barcodeBuffer = '';
let lastKeyTime = Date.now();

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupGlobalListeners();
});

// App Entry Point
// Rule: On every fresh page load:
//   - If no token          → Show Login
//   - If rememberMe=false  → Show Login (token was in sessionStorage, cleared on browser close)
//   - If rememberMe=true   → Verify token with server → Show Dashboard
async function initApp() {
  // 1. Apply saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // 2. Check if first-time setup is needed (no owner in DB)
  try {
    const setupStatus = await API.auth.checkSetup();
    if (setupStatus.setupRequired) {
      navigateSPA('register');
      return;
    }
    const loginTitleEl = document.getElementById('login-shop-title');
    if (loginTitleEl) {
      loginTitleEl.textContent = 'Super Market Software';
    }
    document.title = 'Super Market Software';
    const loginLogoImg = document.getElementById('login-logo-img');
    const loginLogoIcon = document.getElementById('login-logo-icon');
    if (loginLogoImg && loginLogoIcon) {
      if (setupStatus.shopLogo) {
        loginLogoImg.src = setupStatus.shopLogo;
        loginLogoImg.classList.remove('hidden');
        loginLogoIcon.classList.add('hidden');
      } else {
        loginLogoImg.src = '';
        loginLogoImg.classList.add('hidden');
        loginLogoIcon.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.warn('Setup status check failed, defaulting to login:', err.message);
  }

  // 3. Session decision
  //
  //  authToken is already resolved by api.js getStoredToken():
  //  - If rememberMe=false, getStoredToken() clears localStorage and reads sessionStorage
  //  - If sessionStorage is empty (browser was closed), authToken = ''
  //  - If rememberMe=true, authToken comes from localStorage
  //
  //  So the rule here is simple:
  //  - No authToken → Login
  //  - Has authToken → Verify with server (token could still be expired)

  if (!authToken) {
    // No session at all (browser closed without Remember Me, or never logged in)
    currentUser = null;
    window.location.hash = '#login';
    navigateSPA('login');
    return;
  }

  // Has token — verify it is still valid on the server
  try {
    const res = await API.auth.getMe();
    currentUser = res.user;

    if (currentUser.role === 'superadmin') {
      window.location.href = '/admin.html';
      return;
    }

    applyUserRoleGates();
    loadShopMetadata();
    updateHeaderSubscriptionBadge();

    // Expired/suspended owner — force subscription page
    const LOCKED = ['expired', 'suspended'];
    if (currentUser.role === 'owner' && LOCKED.includes(currentUser.subscriptionStatus)) {
      navigateSPA('subscription');
      return;
    }

    // Go to dashboard (token was valid = user is logged in with Remember Me)
    navigateSPA('dashboard');
  } catch (error) {
    // Token rejected by server — destroy all session data
    clearAllTokens();
    authToken = '';
    currentUser = null;
    history.replaceState(null, '', window.location.pathname + '#login');
    navigateSPA('login');
  }
}

// Router Logic
function navigateSPA(viewName, isUserClick = false) {
  // Clear modal overlays if open
  closeAllModals();

  // Redirect logged-in users away from Login/Register pages to their Dashboard
  if ((viewName === 'login' || viewName === 'register') && authToken && currentUser) {
    if (currentUser.role === 'superadmin') {
      window.location.href = '/admin.html';
      return;
    }
    viewName = 'dashboard';
  }

  // Authentication routes
  if (viewName === 'login') {
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('register-card').classList.add('hidden');
    document.getElementById('login-card').classList.remove('hidden');
    document.getElementById('forgot-card').classList.add('hidden');
    window.location.hash = 'login';
    return;
  }

  if (viewName === 'register') {
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('register-card').classList.remove('hidden');
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('forgot-card').classList.add('hidden');
    window.location.hash = 'register';
    return;
  }

  // Protected routes: redirect unauthenticated users directly to Login
  if (!authToken || !currentUser) {
    clearAllTokens();
    authToken = '';
    currentUser = null;
    window.location.hash = '#login';
    navigateSPA('login');
    return;
  }

  // Subscription check — block expired/suspended owners from ALL ERP views
  const LOCKED_STATUSES = ['expired', 'suspended'];
  const isSubscriptionLocked = currentUser &&
    currentUser.role === 'owner' &&
    currentUser.role !== 'superadmin' &&
    LOCKED_STATUSES.includes(currentUser.subscriptionStatus);

  if (isSubscriptionLocked && viewName !== 'subscription') {
    viewName = 'subscription';
  }

  if (currentUser && currentUser.role !== 'superadmin' && currentUser.role !== 'owner' &&
      LOCKED_STATUSES.includes(currentUser.subscriptionStatus)) {
    viewName = 'suspended';
  }


  // Role visibility permissions
  const rolePermissions = {
    owner: ['dashboard', 'billing', 'products', 'purchases', 'customers', 'suppliers', 'workers', 'reports', 'settings', 'subscription'],
    manager: ['dashboard', 'billing', 'products', 'customers', 'suppliers', 'reports'],
    cashier: ['dashboard', 'billing', 'customers'],
    staff: ['dashboard', 'products', 'purchases'],
    employee: ['dashboard'],
    worker: ['dashboard', 'billing', 'products', 'customers']
  };

  const allowedViews = (currentUser && rolePermissions[currentUser.role]) || ['dashboard'];

  // Handle Settings block explicitly
  if (viewName === 'settings' && currentUser && currentUser.role !== 'owner') {
    const authCont = document.getElementById('auth-container');
    const appCont  = document.getElementById('app-container');
    if (authCont) authCont.classList.add('hidden');
    if (appCont)  appCont.classList.remove('hidden');
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(sec => sec.classList.add('hidden'));
    const deniedEl = document.getElementById('view-settings-denied');
    if (deniedEl) deniedEl.classList.remove('hidden');
    const breadEl = document.getElementById('breadcrumb-active');
    if (breadEl) breadEl.textContent = 'Settings';

    const links = document.querySelectorAll('.sidebar-nav .nav-link');
    links.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === '#settings') {
        l.classList.add('active');
      }
    });
    window.location.hash = 'settings';
    return;
  }

  // Handle other unauthorized views
  if (currentUser && !allowedViews.includes(viewName)) {
    showToast('Access denied: Unauthorized view', 'error');
    navigateSPA('dashboard');
    return;
  }

  // Switch wrapper containers (null-safe)
  const authContainer = document.getElementById('auth-container');
  const appContainer  = document.getElementById('app-container');
  if (authContainer) authContainer.classList.add('hidden');
  if (appContainer)  appContainer.classList.remove('hidden');

  // Toggle active view sections
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.add('hidden'));

  const activeSec = document.getElementById(`view-${viewName}`);
  if (activeSec) {
    activeSec.classList.remove('hidden');

    // Set breadcrumbs
    const breadcrumb = document.getElementById('breadcrumb-active');
    if (breadcrumb) breadcrumb.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    // Set sidebar link active class
    const links = document.querySelectorAll('.sidebar-nav .nav-link');
    links.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === `#${viewName}`) {
        l.classList.add('active');
      }
    });

    // Hash tracking
    window.location.hash = viewName;

    // Load view specific data
    triggerViewInitialization(viewName);
  } else {
    navigateSPA('dashboard');
  }
}

// Router Initializations
function triggerViewInitialization(view) {
  switch (view) {
    case 'dashboard':
      if (typeof initDashboard === 'function') initDashboard();
      break;
    case 'billing':
      if (typeof initBilling === 'function') initBilling();
      break;
    case 'products':
      if (typeof initProducts === 'function') initProducts();
      break;
    case 'purchases':
      if (typeof initPurchases === 'function') initPurchases();
      break;
    case 'customers':
      if (typeof initCustomers === 'function') initCustomers();
      break;
    case 'suppliers':
      if (typeof initSuppliers === 'function') initSuppliers();
      break;
    case 'workers':
      if (typeof initWorkers === 'function') initWorkers();
      break;
    case 'reports':
      if (typeof initReports === 'function') initReports();
      break;
    case 'settings':
      if (typeof initSettings === 'function') initSettings();
      break;
    case 'subscription':
      if (typeof initSubscription === 'function') initSubscription();
      break;
  }
}

// Apply Role Visibility Restrictions
function applyUserRoleGates() {
  if (!currentUser) return;

  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  if (nameEl) nameEl.textContent = currentUser.name;
  if (roleEl) roleEl.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

  // Define allowed views for each role
  const rolePermissions = {
    owner: ['dashboard', 'billing', 'products', 'purchases', 'customers', 'suppliers', 'workers', 'reports', 'settings'],
    manager: ['dashboard', 'billing', 'products', 'customers', 'suppliers', 'reports'],
    cashier: ['dashboard', 'billing', 'customers'],
    staff: ['dashboard', 'products', 'purchases'],
    employee: ['dashboard'],
    worker: ['dashboard', 'billing', 'products', 'customers']
  };

  const allowedViews = rolePermissions[currentUser.role] || ['dashboard'];

  // Update sidebar links visibility dynamically
  const navItems = document.querySelectorAll('.sidebar-nav li');
  navItems.forEach(li => {
    const link = li.querySelector('a');
    if (!link) return;
    const view = link.getAttribute('href').replace('#', '');
    if (allowedViews.includes(view)) {
      li.classList.remove('hidden');
      li.style.display = 'block';
    } else {
      li.classList.add('hidden');
      li.style.display = 'none';
    }
  });
}

// Update Header Subscription Badge details dynamically
function updateHeaderSubscriptionBadge() {
  const badge = document.getElementById('header-subscription-badge');
  const textEl = document.getElementById('header-subscription-text');
  const iconEl = document.getElementById('header-subscription-icon');
  if (!badge || !currentUser) return;

  if (currentUser.role === 'superadmin') {
    badge.classList.add('hidden');
    return;
  }

  badge.classList.remove('hidden');

  const status = currentUser.subscriptionStatus;
  const expiry = currentUser.subscriptionEndDate;
  const now = new Date();
  const remainingMs = expiry ? new Date(expiry).getTime() - now.getTime() : 0;
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  // Reset classes
  badge.className = 'network-badge';

  if (status === 'suspended') {
    badge.classList.add('expired');
    textEl.textContent = 'Subscription Suspended';
    if (iconEl) iconEl.className = 'fa-solid fa-ban';
  } else if (status === 'expired' || remainingDays <= 0) {
    badge.classList.add('expired');
    textEl.textContent = 'Subscription Expired';
    if (iconEl) iconEl.className = 'fa-solid fa-triangle-exclamation';
  } else if (remainingDays <= 7) {
    badge.classList.add('warning');
    textEl.textContent = `Expiring soon: ${remainingDays} day(s) left`;
    if (iconEl) iconEl.className = 'fa-solid fa-circle-exclamation';
  } else {
    badge.classList.add('online');
    textEl.textContent = `Subscription Active (${remainingDays} days left)`;
    if (iconEl) iconEl.className = 'fa-solid fa-crown';
  }
}

// Load Supermarket Configuration Metadata
async function loadShopMetadata() {
  try {
    const res = await API.settings.get();
    currentSettings = res.data;

    // Safe helper for setting text content
    function setEl(id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '';
    }

    // Set Shop branding in header templates (null-safe)
    setEl('inv-shop-name',    currentSettings.shopName);
    setEl('inv-shop-address', currentSettings.shopAddress);
    setEl('inv-shop-mobile',  currentSettings.shopMobile);
    setEl('inv-shop-gst',     currentSettings.gstNumber);

    // Set sidebar logo branding dynamically based on configured shop name and logo
    const sidebarTitleEl = document.getElementById('sidebar-shop-name');
    if (sidebarTitleEl) {
      sidebarTitleEl.textContent = currentSettings.shopName || 'Super Market';
    }

    const sidebarLogoImg = document.getElementById('sidebar-logo-img');
    const sidebarLogoIcon = document.getElementById('sidebar-logo-icon');
    if (sidebarLogoImg && sidebarLogoIcon) {
      if (currentSettings.shopLogo) {
        sidebarLogoImg.src = currentSettings.shopLogo;
        sidebarLogoImg.classList.remove('hidden');
        sidebarLogoIcon.classList.add('hidden');
      } else {
        sidebarLogoImg.src = '';
        sidebarLogoImg.classList.add('hidden');
        sidebarLogoIcon.classList.remove('hidden');
      }
    }

    // Set Dashboard branding dynamically
    setEl('dashboard-shop-title-text', currentSettings.shopName || 'Super Market');
    const dashLogoImg = document.getElementById('dashboard-logo-img');
    const dashLogoIcon = document.getElementById('dashboard-logo-icon');
    if (dashLogoImg && dashLogoIcon) {
      if (currentSettings.shopLogo) {
        dashLogoImg.src = currentSettings.shopLogo;
        dashLogoImg.classList.remove('hidden');
        dashLogoIcon.classList.add('hidden');
      } else {
        dashLogoImg.src = '';
        dashLogoImg.classList.add('hidden');
        dashLogoIcon.classList.remove('hidden');
      }
    }

    // Set Login Page branding dynamically in case of logout
    setEl('login-shop-title', 'Super Market Software');
    const loginLogoImg = document.getElementById('login-logo-img');
    const loginLogoIcon = document.getElementById('login-logo-icon');
    if (loginLogoImg && loginLogoIcon) {
      if (currentSettings.shopLogo) {
        loginLogoImg.src = currentSettings.shopLogo;
        loginLogoImg.classList.remove('hidden');
        loginLogoIcon.classList.add('hidden');
      } else {
        loginLogoImg.src = '';
        loginLogoImg.classList.add('hidden');
        loginLogoIcon.classList.remove('hidden');
      }
    }

    // Update profile card name dynamically to store name if owner
    if (currentUser && currentUser.role === 'owner') {
      setEl('user-display-name', currentSettings.shopName || 'Super Market');
    }

    setEl('breadcrumb-parent', currentSettings.shopName || 'Super Market');
    
    // Update Browser Title
    document.title = (currentSettings.shopName || 'Super Market') + ' Management System';

    // Trigger theme update if sync setting enabled
    if (currentSettings.theme) {
      document.documentElement.setAttribute('data-theme', currentSettings.theme);
      updateThemeIcon(currentSettings.theme);
    }
  } catch (err) {
    console.error('Failed to load shop settings', err);
  }
}

// Setup Event Listeners
function setupGlobalListeners() {
  // Auth Submit forms
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user       = document.getElementById('login-username')?.value || '';
      const pass       = document.getElementById('login-password')?.value || '';
      const rememberEl = document.getElementById('login-remember');
      const rememberMe = rememberEl ? rememberEl.checked : false;
      try {
        const res = await API.auth.login(user, pass, rememberMe);
        currentUser = res.user;
        showToast('Login successful', 'success');

        if (currentUser.role === 'superadmin') {
          window.location.href = '/admin.html';
          return;
        }

        applyUserRoleGates();
        await loadShopMetadata();
        navigateSPA('dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const shopName = document.getElementById('reg-shop-name').value;
      const ownerName = document.getElementById('reg-owner-name').value;
      const gst = document.getElementById('reg-gst').value;
      const email = document.getElementById('reg-email').value;
      const mobile = document.getElementById('reg-mobile').value;
      const address = document.getElementById('reg-address').value;
      const username = document.getElementById('reg-username').value;
      const password = document.getElementById('reg-password').value;
      const confirmPass = document.getElementById('reg-confirm-password').value;

      if (password !== confirmPass) {
        showToast('Passwords do not match', 'error');
        return;
      }

      const q1 = document.getElementById('reg-q1').value;
      const a1 = document.getElementById('reg-a1').value;
      const q2 = document.getElementById('reg-q2').value;
      const a2 = document.getElementById('reg-a2').value;

      const payload = {
        name: ownerName,
        shopName,
        gstNumber: gst,
        email,
        mobile,
        username,
        password,
        shopAddress: address,
        securityQuestions: [
          { question: q1, answer: a1 },
          { question: q2, answer: a2 }
        ]
      };

      try {
        const res = await API.auth.registerOwner(payload);
        currentUser = res.user;
        showToast('Supermarket initialized successfully!', 'success');
        applyUserRoleGates();
        await loadShopMetadata();
        navigateSPA('dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Keyboard Event Handlers
  window.addEventListener('keydown', handleKeyboardShortcuts);
  window.addEventListener('keypress', handleBarcodeScanInput);

  // Hash Navigation Listener
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    if ((hash === 'login' || hash === 'register') && authToken && currentUser) {
      navigateSPA('dashboard');
    } else if (hash === 'login' || hash === 'register') {
      navigateSPA(hash);
    } else if (authToken && currentUser) {
      navigateSPA(hash);
    } else {
      window.location.hash = '#login';
      navigateSPA('login');
    }
  });
}

// Toast Notifications Engine
function showToast(message, type = 'success') {
  const container = document.getElementById('notification-toast-container');
  if (!container) return;

  // Deduplicate: If an identical or matching toast exists, update & reset timer instead of creating new element
  const existingToasts = container.querySelectorAll('.toast');
  for (let existing of existingToasts) {
    const textEl = existing.querySelector('p');
    if (textEl && textEl.textContent.trim() === message.trim()) {
      existing.className = `toast ${type}`;
      if (existing._dismissTimer) clearTimeout(existing._dismissTimer);
      existing._dismissTimer = setTimeout(() => {
        existing.style.animation = 'fadeIn 0.3s ease reverse forwards';
        setTimeout(() => existing.remove(), 300);
      }, 2500);
      return;
    }
  }

  // Prevent UI clutter: Keep max 3 toasts visible at a time
  if (existingToasts.length >= 3) {
    existingToasts[0].remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Icon selector
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'warning') icon = 'fa-triangle-exclamation';
  if (type === 'info') icon = 'fa-circle-info';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div>
      <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">${message}</p>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  // Auto remove toast in 2.5 seconds
  toast._dismissTimer = setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Global Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
  // Skip shortcuts inside input forms except F-keys/Escape
  const activeTag = document.activeElement.tagName;
  const isInput = activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA';

  if (e.key === 'F1') {
    e.preventDefault();
    openShortcutsModal();
  } else if (e.key === 'F2') {
    e.preventDefault();
    navigateSPA('billing');
    setTimeout(() => {
      const barcodeInput = document.getElementById('bill-barcode-input');
      if (barcodeInput) barcodeInput.focus();
    }, 100);
  } else if (e.key === 'F4') {
    e.preventDefault();
    navigateSPA('billing');
    setTimeout(() => {
      const nameInput = document.getElementById('bill-name-search');
      if (nameInput) nameInput.focus();
    }, 100);
  } else if (e.key === 'F8') {
    e.preventDefault();
    const billingView = document.getElementById('view-billing');
    if (billingView && !billingView.classList.contains('hidden')) {
      document.getElementById('pay-mode').value = 'Cash';
      openPaymentModal();
    }
  } else if (e.key === 'F9') {
    e.preventDefault();
    const billingView = document.getElementById('view-billing');
    if (billingView && !billingView.classList.contains('hidden')) {
      document.getElementById('pay-mode').value = 'UPI';
      openPaymentModal();
    }
  } else if (e.key === 'Escape') {
    closeAllModals();
    // Dismiss search dropdowns
    const dropdowns = document.querySelectorAll('.search-results-dropdown');
    dropdowns.forEach(d => d.classList.add('hidden'));
  }
}

// USB Barcode Scanner Key Capture
function handleBarcodeScanInput(e) {
  const currentTime = Date.now();
  
  // Scanners send keys extremely fast (< 35ms between characters)
  if (currentTime - lastKeyTime < 35) {
    // Exclude Enter Key
    if (e.key !== 'Enter') {
      barcodeBuffer += e.key;
    }
  } else {
    // Normal human typing started, reset buffer
    if (e.key !== 'Enter') {
      barcodeBuffer = e.key;
    }
  }
  
  lastKeyTime = currentTime;

  // Scanner sends 'Enter' at the end of scan
  if (e.key === 'Enter' && barcodeBuffer.length >= 8) {
    e.preventDefault();
    const scannedBarcode = barcodeBuffer;
    barcodeBuffer = '';
    
    // Scanned product hook
    handleGlobalBarcodeScanned(scannedBarcode);
  }
}

// Global Barcode Scan Event Hook
function handleGlobalBarcodeScanned(barcode) {
  const cleanBarcode = String(barcode).trim();
  if (!cleanBarcode) return;

  // 1. If we are currently on the billing page, add it to the checkout cart automatically
  const billingView = document.getElementById('view-billing');
  if (billingView && !billingView.classList.contains('hidden')) {
    if (typeof handleBarcodeScanCheckout === 'function') {
      handleBarcodeScanCheckout(cleanBarcode);
    }
    return;
  }

  // 2. If on Purchase page, populate search and select product
  const purchaseView = document.getElementById('view-purchases');
  if (purchaseView && !purchaseView.classList.contains('hidden')) {
    if (typeof handleBarcodeScanPurchase === 'function') {
      handleBarcodeScanPurchase(cleanBarcode);
    } else {
      const purSearch = document.getElementById('pur-product-search');
      if (purSearch) {
        purSearch.value = cleanBarcode;
        purSearch.dispatchEvent(new Event('input'));
      }
    }
    return;
  }

  // 3. Otherwise (Inventory / Stock page, etc.), navigate to products and search
  navigateSPA('products');
  setTimeout(() => {
    const productSearchInput = document.getElementById('product-search');
    if (productSearchInput) {
      productSearchInput.value = cleanBarcode;
    }
    const filterSearch = document.getElementById('prod-filter-search');
    if (filterSearch) {
      filterSearch.value = cleanBarcode;
    }
    if (typeof loadProductDirectory === 'function') {
      loadProductDirectory();
    } else if (typeof loadProductsList === 'function') {
      loadProductsList();
    }
  }, 200);
}

// Forgot Password Recovery variables
let forgotEmailAddress = '';
let otpCountdownTimer = null;
let resendCooldownTimer = null;

// Show forgot password flow
async function showForgotPasswordFlow() {
  document.getElementById('login-card').classList.add('hidden');
  document.getElementById('forgot-card').classList.remove('hidden');
  
  // Reset steps
  document.getElementById('forgot-step-email').classList.remove('hidden');
  document.getElementById('forgot-step-otp').classList.add('hidden');
  document.getElementById('forgot-step-reset').classList.add('hidden');
  document.getElementById('forgot-loading-spinner').classList.add('hidden');

  document.getElementById('forgot-step-text').textContent = 'Step 1: Verify Username & Registered Email';
  document.getElementById('forgot-progress-fill').style.width = '33.3%';
  
  // Clear inputs
  const usernameEl = document.getElementById('forgot-username');
  if (usernameEl) usernameEl.value = '';
  document.getElementById('forgot-email').value = '';
  clearOtpInputs();

  // Clear timers
  clearInterval(otpCountdownTimer);
  clearInterval(resendCooldownTimer);
}

// Clear all OTP input boxes
function clearOtpInputs() {
  for (let i = 0; i < 6; i++) {
    const box = document.getElementById(`otp-digit-${i}`);
    if (box) box.value = '';
  }
}

// HOP/Hop focus to next box
window.hopOtpInput = function(input, index) {
  // Allow only numbers
  input.value = input.value.replace(/[^0-9]/g, '');
  
  // Remove error class if typing
  input.classList.remove('otp-error');
  input.classList.remove('otp-success');

  if (input.value.length === 1 && index < 5) {
    document.getElementById(`otp-digit-${index + 1}`).focus();
  }
};

// Setup Backspace handlers for OTP boxes
function setupOtpBackspaceHandlers() {
  for (let i = 0; i < 6; i++) {
    const box = document.getElementById(`otp-digit-${i}`);
    if (box) {
      // Clear event to prevent duplicates
      box.onkeydown = null;
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!box.value && i > 0) {
            const prevBox = document.getElementById(`otp-digit-${i - 1}`);
            prevBox.value = '';
            prevBox.focus();
            e.preventDefault();
          } else {
            box.value = '';
          }
        }
      });
    }
  }
}

// Step 1: Send OTP
async function handleSendOtp() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }

  // Format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  // Show Loading Spinner
  document.getElementById('forgot-step-email').classList.add('hidden');
  document.getElementById('forgot-loading-spinner').classList.remove('hidden');

  try {
    const res = await API.auth.sendOtp(email);
    forgotEmailAddress = email;
    showToast(res.message, 'success');

    // Transition to Step 2: OTP Entry
    document.getElementById('forgot-loading-spinner').classList.add('hidden');
    document.getElementById('forgot-step-otp').classList.remove('hidden');
    document.getElementById('forgot-step-text').textContent = 'Step 2: Enter Verification Code';
    document.getElementById('forgot-progress-fill').style.width = '66.6%';
    
    // Setup backspace events and focus first box
    setupOtpBackspaceHandlers();
    setTimeout(() => {
      document.getElementById('otp-digit-0').focus();
    }, 150);

    // Timers setup
    startOtpCountdown(5 * 60); // 5 minutes
    startResendCooldown(60);   // 60 seconds resend cooldown
  } catch (err) {
    document.getElementById('forgot-loading-spinner').classList.add('hidden');
    document.getElementById('forgot-step-email').classList.remove('hidden');
    showToast(err.message, 'error');
  }
}

// Expiry countdown timer (5 mins)
function startOtpCountdown(durationSeconds) {
  clearInterval(otpCountdownTimer);
  let timeRemaining = durationSeconds;
  
  const timerLabel = document.getElementById('otp-timer-countdown');

  otpCountdownTimer = setInterval(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    timerLabel.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (timeRemaining <= 0) {
      clearInterval(otpCountdownTimer);
      timerLabel.textContent = 'Expired';
      showToast('OTP code has expired. Please request a new one.', 'warning');
    }
    timeRemaining--;
  }, 1000);
}

// Resend throttle cooldown (60 seconds)
function startResendCooldown(cooldownSeconds) {
  clearInterval(resendCooldownTimer);
  let remaining = cooldownSeconds;
  
  const resendBtn = document.getElementById('btn-resend-otp');
  resendBtn.disabled = true;
  resendBtn.style.cursor = 'not-allowed';
  resendBtn.style.color = 'var(--text-muted)';

  resendCooldownTimer = setInterval(() => {
    resendBtn.textContent = `Resend OTP (${remaining}s)`;
    
    if (remaining <= 0) {
      clearInterval(resendCooldownTimer);
      resendBtn.disabled = false;
      resendBtn.style.cursor = 'pointer';
      resendBtn.style.color = 'var(--neon-blue)';
      resendBtn.textContent = 'Resend OTP';
    }
    remaining--;
  }, 1000);
}

// Trigger resend
async function handleResendOtp() {
  const resendBtn = document.getElementById('btn-resend-otp');
  resendBtn.disabled = true;
  clearOtpInputs();

  try {
    const res = await API.auth.sendOtp(forgotEmailAddress);
    showToast(res.message, 'success');
    
    // Focus first input
    document.getElementById('otp-digit-0').focus();
    
    // Reset timers
    startOtpCountdown(5 * 60);
    startResendCooldown(60);
  } catch (err) {
    showToast(err.message, 'error');
    resendBtn.disabled = false;
  }
}

// Step 2: Verify OTP
async function handleVerifyOtp() {
  let code = '';
  const boxes = [];
  
  for (let i = 0; i < 6; i++) {
    const box = document.getElementById(`otp-digit-${i}`);
    code += box.value.trim();
    boxes.push(box);
  }

  if (code.length < 6) {
    showToast('Please enter the complete 6-digit OTP code', 'warning');
    return;
  }

  // Show Loading Spinner
  document.getElementById('forgot-step-otp').classList.add('hidden');
  document.getElementById('forgot-loading-spinner').classList.remove('hidden');

  try {
    await API.auth.verifyOtp(forgotEmailAddress, code);
    showToast('Email verified successfully!', 'success');

    // Deactive timers
    clearInterval(otpCountdownTimer);
    clearInterval(resendCooldownTimer);

    // Transition to Step 3: Password reset
    document.getElementById('forgot-loading-spinner').classList.add('hidden');
    document.getElementById('forgot-step-reset').classList.remove('hidden');
    document.getElementById('forgot-step-text').textContent = 'Step 3: Reset Account Password';
    document.getElementById('forgot-progress-fill').style.width = '100%';
    
    // Reset inputs
    document.getElementById('forgot-new-pwd').value = '';
    document.getElementById('forgot-confirm-pwd').value = '';
  } catch (err) {
    document.getElementById('forgot-loading-spinner').classList.add('hidden');
    document.getElementById('forgot-step-otp').classList.remove('hidden');
    showToast(err.message, 'error');
    
    // Add visual error glow to inputs and focus first box
    boxes.forEach(box => {
      box.value = '';
      box.classList.add('otp-error');
    });
    document.getElementById('otp-digit-0').focus();
  }
}

// Step 3: Reset Password Submit
async function handleResetPasswordSubmit() {
  const newPwd = document.getElementById('forgot-new-pwd').value;
  const confirmPwd = document.getElementById('forgot-confirm-pwd').value;

  if (!newPwd || !confirmPwd) {
    showToast('Both password fields are required', 'error');
    return;
  }

  if (newPwd.length < 6) {
    showToast('Password must be at least 6 characters long', 'error');
    return;
  }

  if (newPwd !== confirmPwd) {
    showToast('Passwords do not match', 'error');
    return;
  }

  // Show Loading Spinner
  document.getElementById('forgot-step-reset').classList.add('hidden');
  document.getElementById('forgot-loading-spinner').classList.remove('hidden');

  try {
    const res = await API.auth.resetPassword(forgotEmailAddress, newPwd, confirmPwd);
    showToast(res.message, 'success');
    
    document.getElementById('forgot-loading-spinner').classList.add('hidden');
    showLoginFlow();
  } catch (err) {
    document.getElementById('forgot-loading-spinner').classList.add('hidden');
    document.getElementById('forgot-step-reset').classList.remove('hidden');
    showToast(err.message, 'error');
  }
}

function showLoginFlow() {
  // Clear timers if back to login clicked midway
  clearInterval(otpCountdownTimer);
  clearInterval(resendCooldownTimer);

  document.getElementById('forgot-card').classList.add('hidden');
  document.getElementById('register-card').classList.add('hidden');
  document.getElementById('login-card').classList.remove('hidden');
}


// Session Logout — clears ALL storage and forces Login page
async function logoutSession() {
  try {
    await API.auth.logout(); // Clears localStorage + sessionStorage + rememberMe
  } catch (err) {
    // Ignore server error — still clear client state
  }
  currentUser = null;
  authToken = '';
  // Replace hash to prevent browser back-button restoring a protected view
  history.replaceState(null, '', window.location.pathname + '#login');
  showToast('Logged out successfully', 'success');
  navigateSPA('login');
}

// UI Modals triggers
function openShortcutsModal() {
  document.getElementById('kbd-shortcuts-modal').classList.remove('hidden');
}

function closeShortcutsModal() {
  document.getElementById('kbd-shortcuts-modal').classList.add('hidden');
}

function closeAllModals() {
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(ov => ov.classList.add('hidden'));
  document.getElementById('invoice-print-modal').classList.add('hidden');
}

// Password show/hide toggle
function togglePasswordVisibility(fieldId) {
  const field = document.getElementById(fieldId);
  const eye = document.getElementById(`${fieldId}-eye`);
  if (field && eye) {
    if (field.type === 'password') {
      field.type = 'text';
      eye.className = 'fa-solid fa-eye-slash';
    } else {
      field.type = 'password';
      eye.className = 'fa-solid fa-eye';
    }
  }
}

// Theme management
function toggleTheme() {
  const currTheme = document.documentElement.getAttribute('data-theme');
  const targetTheme = currTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', targetTheme);
  localStorage.setItem('theme', targetTheme);
  updateThemeIcon(targetTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'light') {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  }
}

// Expiry alerts bell dropdown toggle
function toggleAlertsDropdown() {
  const dp = document.getElementById('alerts-dropdown');
  if (dp) {
    dp.classList.toggle('hidden');
  }
}

// Load Alerts notification from dashboard data
function renderNotificationsList(lowStockProducts, outOfStockProducts) {
  const badge = document.getElementById('alerts-count-badge');
  const list = document.getElementById('alerts-list-content');
  if (!badge || !list) return;

  const alerts = [];
  
  lowStockProducts.forEach(p => {
    alerts.push({
      type: 'low-stock',
      msg: `Product '${p.name}' is running low! Stock: ${p.currentStock} left.`
    });
  });

  outOfStockProducts.forEach(p => {
    alerts.push({
      type: 'out-stock',
      msg: `Product '${p.name}' is out of stock!`
    });
  });

  systemAlerts = alerts;

  if (alerts.length > 0) {
    badge.textContent = alerts.length;
    badge.classList.remove('hidden');

    list.innerHTML = alerts.map(a => `
      <div class="alert-list-item ${a.type === 'low-stock' ? 'low-stock' : 'expiry'}">
        <i class="fa-solid ${a.type === 'low-stock' ? 'fa-triangle-exclamation text-neon-yellow' : 'fa-ban text-neon-pink'}"></i>
        <span>${a.msg}</span>
      </div>
    `).join('');
  } else {
    badge.classList.add('hidden');
    list.innerHTML = `<div class="no-alerts">No stock or expiry warnings.</div>`;
  }
}

function clearSystemNotifications() {
  systemAlerts = [];
  const badge = document.getElementById('alerts-count-badge');
  const list  = document.getElementById('alerts-list-content');
  if (badge) badge.classList.add('hidden');
  if (list)  list.innerHTML = `<div class="no-alerts">No stock or expiry warnings.</div>`;
}
