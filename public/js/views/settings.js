// System settings, Brandings, backups, and security audits
async function initSettings() {
  await loadShopSettings();
  setupSettingsFormListener();
  setupUpiSettingsListener();
}

async function loadShopSettings() {
  try {
    const res = await API.settings.get();
    const config = res.data;

    // Safe value setter
    function setVal(id, val) {
      const el = document.getElementById(id);
      if (el) el.value = val != null ? val : '';
      else console.warn(`[Settings] Element not found: #${id}`);
    }

    setVal('set-shop-name',  config.shopName);
    setVal('set-gst-number', config.gstNumber);
    setVal('set-mobile',     config.shopMobile);
    setVal('set-email',      config.shopEmail);
    setVal('set-address',    config.shopAddress);
    setVal('set-upi',        config.qrCodeUpi);
    setVal('set-threshold',  config.lowStockThreshold);
    setVal('set-printer',    config.printerType);

    // Load Owner UPI Settings
    setVal('set-upi-merchant', config.upiMerchantName || '');
    setVal('set-upi-id',       config.qrCodeUpi || '');
    setVal('set-upi-enable',   config.enableQrPayment !== false ? 'true' : 'false');

    // Logo image preview
    const previewWrapper = document.getElementById('settings-logo-preview-wrapper');
    const previewImg = document.getElementById('settings-logo-preview');
    if (config.shopLogo) {
      previewImg.src = config.shopLogo;
      previewWrapper.classList.remove('hidden');
    } else {
      previewWrapper.classList.add('hidden');
    }

    // UPI QR Code preview
    const upiPreviewWrapper = document.getElementById('settings-upi-qr-preview-wrapper');
    const upiPreviewImg = document.getElementById('settings-upi-qr-preview');
    if (config.upiQrImage) {
      upiPreviewImg.src = config.upiQrImage;
      upiPreviewWrapper.classList.remove('hidden');
    } else {
      upiPreviewWrapper.classList.add('hidden');
    }
  } catch (err) {
    showToast('Failed to load shop settings: ' + err.message, 'error');
  }
}

function setupSettingsFormListener() {
  const form = document.getElementById('settings-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const shopName = document.getElementById('set-shop-name').value;
    const gstNumber = document.getElementById('set-gst-number').value;
    const shopMobile = document.getElementById('set-mobile').value;
    const shopEmail = document.getElementById('set-email').value;
    const shopAddress = document.getElementById('set-address').value;
    const qrCodeUpi = document.getElementById('set-upi').value;
    const lowStockThreshold = Number(document.getElementById('set-threshold').value || 10);
    const printerType = document.getElementById('set-printer').value;

    const payload = {
      shopName,
      gstNumber,
      shopMobile,
      shopEmail,
      shopAddress,
      qrCodeUpi,
      lowStockThreshold,
      printerType
    };

    try {
      // 1. Submit text details
      const res = await API.settings.update(payload);
      currentSettings = res.data; // Sync global settings

      // 2. Handle logo file upload if selected
      const logoInput = document.getElementById('set-logo-input');
      if (logoInput.files.length > 0) {
        const formData = new FormData();
        formData.append('shopLogo', logoInput.files[0]);
        const resLogo = await API.settings.uploadLogo(formData);
        currentSettings = resLogo.data;
      }

      showToast('Settings saved successfully', 'success');
      await initSettings(); // Reload logo preview and details
      loadShopMetadata();  // Sync breadcrumbs and invoice forms
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

function setupUpiSettingsListener() {
  const form = document.getElementById('upi-settings-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const upiMerchantName = document.getElementById('set-upi-merchant').value;
    const qrCodeUpi = document.getElementById('set-upi-id').value;
    const enableQrPayment = document.getElementById('set-upi-enable').value === 'true';

    const payload = {
      upiMerchantName,
      qrCodeUpi,
      enableQrPayment
    };

    try {
      // 1. Submit text details
      const res = await API.settings.update(payload);
      currentSettings = res.data; // Sync global settings

      // 2. Handle UPI QR file upload if selected
      const upiQrInput = document.getElementById('set-upi-qr-input');
      if (upiQrInput.files.length > 0) {
        const formData = new FormData();
        formData.append('upiQrImage', upiQrInput.files[0]);
        const resUpiQr = await API.settings.uploadUpiQr(formData);
        currentSettings = resUpiQr.data;
      }

      showToast('UPI Payment configurations saved successfully', 'success');
      await loadShopSettings(); // Reload preview and details
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// Fetch and open Audit logs modal
async function loadAuditLogs() {
  try {
    const res = await API.settings.getAuditLogs();
    const logModal = document.getElementById('audit-log-modal');
    const logTitle = logModal.querySelector('.modal-header h3');
    const tbody = document.getElementById('audit-logs-tbody');

    logTitle.innerHTML = `<i class="fa-solid fa-file-waveform"></i> Supermarket Security Audit Logs`;

    // Restore table headers to Audit layout
    logModal.querySelector('.data-table thead tr').innerHTML = `
      <th>Timestamp</th>
      <th>User (Role)</th>
      <th>IP Address</th>
      <th>Operation</th>
      <th>Details Description</th>
    `;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No activities logged.</td></tr>`;
    } else {
      tbody.innerHTML = res.data.map(log => {
        const d = new Date(log.createdAt);
        const roleClass = log.role === 'owner' ? 'badge-status active' : 'badge-status inactive';
        return `
          <tr>
            <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td><strong>${log.username}</strong> <span class="${roleClass}" style="font-size:0.7rem; padding: 2px 4px;">${log.role}</span></td>
            <td><code>${log.ipAddress || '127.0.0.1'}</code></td>
            <td><strong>${log.action}</strong></td>
            <td>${log.details}</td>
          </tr>
        `;
      }).join('');
    }

    logModal.classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load audit logs: ' + err.message, 'error');
  }
}

function closeAuditModal() {
  const modal = document.getElementById('audit-log-modal');
  if (modal) modal.classList.add('hidden');
}

// Download Database Backup JSON file
function triggerBackupDownload() {
  const exportUrl = API.backup.getExportUrl();
  
  // Creates temporary hidden download link
  const link = document.createElement("a");
  link.setAttribute("href", exportUrl);
  link.setAttribute("download", `Super_Market_Software_DB_Backup_${Date.now()}.json`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
  showToast('Database backup download initiated', 'success');
}

// Restore Database from JSON file upload
async function triggerBackupRestore() {
  const fileInput = document.getElementById('settings-restore-file');
  if (fileInput.files.length === 0) {
    showToast('Please select a backup JSON file first', 'warning');
    return;
  }

  if (confirm('CRITICAL WARNING: Restoring backup will drop all current data. Do you wish to continue?')) {
    const formData = new FormData();
    formData.append('backupFile', fileInput.files[0]);

    try {
      await API.backup.restore(formData);
      showToast('Database successfully restored! Reloading...', 'success');
      
      // Clear storage token and redirect to login, as users have changed
      localStorage.removeItem('token');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

// Reset Database / All Store Data
async function triggerDatabaseReset() {
  if (confirm('CRITICAL WARNING: This will permanently delete ALL products, sales, customers, suppliers, settings, workers, and activity logs. This action CANNOT be undone. Are you absolutely sure you want to proceed?')) {
    const password = prompt('For security, please enter your password to confirm data reset:');
    if (!password) {
      showToast('Data reset cancelled.', 'info');
      return;
    }

    try {
      await API.settings.resetData(password);
      showToast('All store data has been successfully reset! Logging out...', 'success');
      
      // Clear token and redirect to login
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('rememberMe');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      showToast(err.message || 'Failed to reset store data', 'error');
    }
  }
}

// Permanently Delete Owner Account
async function triggerAccountDeletion() {
  if (confirm('CRITICAL WARNING: You are about to PERMANENTLY DELETE your account. This will completely drop your database, delete your user credentials, delete all cashier worker profiles, remove all sales logs, and erase your brand files. THIS ACTION IS ENTIRELY IRREVERSIBLE. Are you absolutely sure you want to proceed?')) {
    const password = prompt('To confirm permanent account deletion, please enter your password:');
    if (!password) {
      showToast('Account deletion cancelled.', 'info');
      return;
    }

    try {
      await API.settings.deleteAccount(password);
      showToast('Your account and store data have been permanently deleted! Logging out...', 'success');
      
      // Clear local authentication state
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('rememberMe');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      showToast(err.message || 'Failed to delete account', 'error');
    }
  }
}
