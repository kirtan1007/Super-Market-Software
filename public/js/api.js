// API Endpoint Base Helper
const API_URL = '/api';

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN STORAGE — REMEMBER ME LOGIC
//
// Remember Me = ON  → token saved in localStorage (survives browser close/restart)
//                      Cookie is persistent (7-day expires)
//
// Remember Me = OFF → token saved in sessionStorage ONLY (cleared on browser close)
//                      Cookie is a session cookie (no 'expires' = auto-cleared)
//                      Reopening the browser ALWAYS shows Login page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the active token.
 * - Only reads from localStorage if "rememberMe" flag is also set.
 * - Otherwise reads sessionStorage (current tab session only).
 * This prevents a stale localStorage token from silently auto-logging in.
 */
function getStoredToken() {
  const rememberMe = localStorage.getItem('rememberMe') === 'true';
  if (rememberMe) {
    return localStorage.getItem('token') || '';
  }
  // No Remember Me: only trust sessionStorage (cleared on browser close)
  // Also clean up any leftover localStorage token from old code or old sessions
  localStorage.removeItem('token');
  return sessionStorage.getItem('token') || '';
}

/**
 * Save the token to the correct storage based on Remember Me preference.
 * @param {string} token     - JWT token
 * @param {boolean} rememberMe - Whether the user checked "Remember Me"
 */
function saveToken(token, rememberMe) {
  if (rememberMe) {
    localStorage.setItem('token',      token);
    localStorage.setItem('rememberMe', 'true');
    sessionStorage.removeItem('token'); // Don't keep both
  } else {
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');      // Ensure no persistent copy
    localStorage.removeItem('rememberMe');
  }
}

/**
 * Destroy ALL stored auth data across all storage mechanisms.
 * Called on logout or when token is invalid.
 */
function clearAllTokens() {
  localStorage.removeItem('token');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
}

// In-memory token — initialized from the correct storage at page load
let authToken = getStoredToken();

// ─────────────────────────────────────────────────────────────────────────────
// CENTRALIZED FETCH REQUEST HANDLER
// ─────────────────────────────────────────────────────────────────────────────
async function apiRequest(endpoint, method = 'GET', data = null, isMultipart = false) {
  const url = `${API_URL}${endpoint}`;

  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let body;
  if (isMultipart) {
    body = data; // FormData handles Content-Type boundary itself
  } else if (data) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  const options = { method, headers, body };

  try {
    const response = await fetch(url, options);

    // Token expired or invalid — destroy session and force login
    if (response.status === 401 && endpoint !== '/auth/me') {
      clearAllTokens();
      authToken = '';
      history.replaceState(null, '', window.location.pathname + '#login');
      if (typeof showToast === 'function') {
        showToast('Session expired. Please log in again.', 'error');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'API request failed');
    }
    return result;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL API SERVICES
// ─────────────────────────────────────────────────────────────────────────────
const API = {
  // Authentication & Session Management
  auth: {
    checkSetup: () => apiRequest('/auth/setup-status'),
    registerOwner: (data) => apiRequest('/auth/register-owner', 'POST', data),

    /**
     * Login — passes rememberMe to backend so the correct cookie type is set.
     * Saves token to correct storage on the frontend too.
     */
    login: async (username, password, rememberMe = false) => {
      const res = await apiRequest('/auth/login', 'POST', {
        username,
        password,
        rememberMe: !!rememberMe
      });
      if (res.token) {
        saveToken(res.token, rememberMe);
        authToken = res.token;
      }
      return res;
    },

    getMe: () => apiRequest('/auth/me'),

    /**
     * Logout — clears ALL storage and all cookies.
     */
    logout: async () => {
      try {
        await apiRequest('/auth/logout');
      } catch (_) {}
      clearAllTokens();
      authToken = '';
    },

    forgotVerifyUser:    (username)                         => apiRequest('/auth/forgot-password-verify-user',    'POST', { username }),
    forgotVerifyAnswers: (username, answers)                => apiRequest('/auth/forgot-password-verify-answers', 'POST', { username, answers }),
    forgotReset:         (username, otp, newPassword)       => apiRequest('/auth/forgot-password-reset',          'POST', { username, otp, newPassword }),
    sendOtp:             (payload)                          => typeof payload === 'string'
                                                                ? apiRequest('/auth/send-otp',   'POST', { email: payload })
                                                                : apiRequest('/auth/send-otp',   'POST', payload),
    verifyOtp:           (email, otp)                       => apiRequest('/auth/verify-otp',    'POST', { email, otp }),
    resetPassword:       (email, newPassword, confirmPassword) => apiRequest('/auth/reset-password', 'POST', { email, newPassword, confirmPassword }),
    verifyOwner:         (password)                         => apiRequest('/auth/verify-owner',  'POST', { password })
  },

  // Worker / Cashier Staff
  workers: {
    list:          ()           => apiRequest('/workers'),
    create:        (data)       => apiRequest('/workers',              'POST',   data),
    update:        (id, data)   => apiRequest(`/workers/${id}`,        'PUT',    data),
    delete:        (id)         => apiRequest(`/workers/${id}`,        'DELETE'),
    resetPassword: (id, newPwd) => apiRequest(`/workers/${id}/reset-password`, 'PUT', { newPassword: newPwd })
  },

  // Products / Inventory
  products: {
    list:       (params = {}) => { const q = new URLSearchParams(params).toString(); return apiRequest(`/products?${q}`); },
    getById:    (id)          => apiRequest(`/products/${id}`),
    getByBarcode:(barcode)    => apiRequest(`/products/barcode/${barcode}`),
    create:     (formData)    => apiRequest('/products',               'POST', formData, true),
    update:     (id, formData)=> apiRequest(`/products/${id}`,         'PUT',  formData, true),
    delete:     (id)          => apiRequest(`/products/${id}`,         'DELETE'),
    importCsv:  (formData)    => apiRequest('/products/import-csv',    'POST', formData, true),
    regenerateBarcodes: ()    => apiRequest('/products/regenerate-barcodes', 'POST')
  },

  // Customers
  customers: {
    list:        (params = {}) => { const q = new URLSearchParams(params).toString(); return apiRequest(`/customers?${q}`); },
    getByMobile: (mobile)      => apiRequest(`/customers/mobile/${mobile}`),
    create:      (data)        => apiRequest('/customers',            'POST', data),
    getHistory:  (id)          => apiRequest(`/customers/${id}/history`)
  },

  // Suppliers
  suppliers: {
    list:   ()          => apiRequest('/suppliers'),
    create: (data)      => apiRequest('/suppliers',          'POST',   data),
    update: (id, data)  => apiRequest(`/suppliers/${id}`,    'PUT',    data),
    delete: (id)        => apiRequest(`/suppliers/${id}`,    'DELETE')
  },

  // Stock Replenishment / Purchases
  purchases: {
    list:   ()     => apiRequest('/purchases'),
    create: (data) => apiRequest('/purchases', 'POST', data)
  },

  // Sales / Billing
  sales: {
    list:           () => apiRequest('/sales'),
    create:         (data) => apiRequest('/sales',        'POST', data),
    getById:        (id)   => apiRequest(`/sales/${id}`),
    getNextInvoice: ()     => apiRequest('/sales/next-invoice')
  },

  // Reports & Analytics
  reports: {
    getDashboard: ()       => apiRequest('/reports/dashboard'),
    getSales:     (params) => { const q = new URLSearchParams(params).toString(); return apiRequest(`/reports/sales?${q}`); },
    getProducts:  ()       => apiRequest('/reports/products-performance'),
    getGst:       (params) => { const q = new URLSearchParams(params).toString(); return apiRequest(`/reports/gst?${q}`); },
    getExpiry:    (status = '') => apiRequest(`/reports/expiry?status=${status}`)
  },

  // System Settings
  settings: {
    get:         ()         => apiRequest('/settings'),
    update:      (data)     => apiRequest('/settings',      'PUT',  data),
    uploadLogo:  (formData) => apiRequest('/settings/logo', 'POST', formData, true),
    uploadUpiQr: (formData) => apiRequest('/settings/upi-qr','POST', formData, true),
    getAuditLogs:()         => apiRequest('/settings/logs'),
    resetData:   (password) => apiRequest('/settings/reset', 'POST', { password }),
    deleteAccount:(password) => apiRequest('/settings/delete-account', 'POST', { password })
  },

  // Backup & Restore
  backup: {
    getExportUrl: () => `${API_URL}/backup/export?token=${authToken}`,
    restore:      (formData) => apiRequest('/backup/restore', 'POST', formData, true)
  },

  // Subscriptions
  subscriptions: {
    getPlans:        ()         => apiRequest('/subscriptions/plans'),
    getStatus:       ()         => apiRequest('/subscriptions/status'),
    getPaymentStatus:()         => apiRequest('/subscriptions/payment-status'),
    uploadScreenshot:(formData) => apiRequest('/subscriptions/upload-screenshot', 'POST', formData, true),
    submitPay: (planId, transactionRef, paymentDate, paymentTime, screenshotUrl) =>
      typeof planId === 'object'
        ? apiRequest('/subscriptions/pay', 'POST', planId)
        : apiRequest('/subscriptions/pay', 'POST', { planId, transactionRef, paymentDate, paymentTime, screenshotUrl })
  },

  // Super Admin
  superadmin: {
    getShops:          ()           => apiRequest('/superadmin/shops'),
    suspendShop:       (id)         => apiRequest(`/superadmin/shops/${id}/suspend`,           'POST'),
    activateShop:      (id)         => apiRequest(`/superadmin/shops/${id}/activate`,          'POST'),
    extendTrial:       (id, days)   => apiRequest(`/superadmin/shops/${id}/extend-trial`,      'POST', { days }),
    changeSubscription:(id, planId) => apiRequest(`/superadmin/shops/${id}/change-subscription`,'POST', { planId }),
    deleteShop:        (id)         => apiRequest(`/superadmin/shops/${id}`,                   'DELETE'),
    restoreShop:       (id)         => apiRequest(`/superadmin/shops/${id}/restore`,           'POST'),

    getPlans:          ()           => apiRequest('/superadmin/plans'),
    createPlan:        (data)       => apiRequest('/superadmin/plans',       'POST',   data),
    updatePlan:        (id, data)   => apiRequest(`/superadmin/plans/${id}`, 'PUT',    data),
    deletePlan:        (id)         => apiRequest(`/superadmin/plans/${id}`, 'DELETE'),

    getMetrics:        ()     => apiRequest('/superadmin/metrics'),
    getLoginHistory:   ()     => apiRequest('/superadmin/login-history'),
    getPendingPayments:()     => apiRequest('/superadmin/payments/pending'),
    approvePayment:    (id, data = {})   => apiRequest(`/superadmin/payments/${id}/approve`, 'POST', data),
    rejectPayment:     (id, data = {})   => apiRequest(`/superadmin/payments/${id}/reject`,  'POST', data),
    getGlobalConfig:   ()     => apiRequest('/superadmin/global-config'),
    updateGlobalConfig:(data) => apiRequest('/superadmin/global-config', 'POST', data)
  }
};
