// Worker Staff Management View Controller

// Safe DOM helpers
function _w(id) { return document.getElementById(id); }
function _wSet(id, val) {
  const el = _w(id);
  if (el) el.value = val != null ? val : '';
  else console.warn(`[Workers] Element not found: #${id}`);
}
function _wText(id, val) {
  const el = _w(id);
  if (el) el.textContent = val;
  else console.warn(`[Workers] Element not found: #${id}`);
}
function _wClass(id, action, cls) {
  const el = _w(id);
  if (el) el.classList[action](cls);
  else console.warn(`[Workers] Element not found: #${id}`);
}

async function initWorkers() {
  await loadWorkersDirectory();
  setupWorkerFormListener();
}

async function loadWorkersDirectory() {
  try {
    const res = await API.workers.list();
    renderWorkersTable(res.data);
  } catch (err) {
    showToast('Failed to load workers directory: ' + err.message, 'error');
  }
}

function renderWorkersTable(workers) {
  const tbody = _w('workers-table-body');
  if (!tbody) return;

  if (!workers || workers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No worker staff registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = workers.map(w => {
    const statusBadge = w.active
      ? '<span class="badge-status active">Active Billing</span>'
      : '<span class="badge-status inactive">Suspended</span>';

    const roleName = w.role ? w.role.charAt(0).toUpperCase() + w.role.slice(1) : 'Worker';

    return `
      <tr>
        <td><strong>${w.name}</strong></td>
        <td><code>${w.username}</code></td>
        <td><span class="badge-status active" style="background-color: var(--neon-blue); color: #fff;">${roleName}</span></td>
        <td>${w.mobile}</td>
        <td>${w.email}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-text" onclick="openWorkerModal('${w._id}')" title="Edit Worker"><i class="fa-solid fa-pen-to-square text-neon-blue"></i></button>
          <button class="btn-text" onclick="resetWorkerPasswordDirect('${w._id}', '${w.name}')" title="Reset Password" style="margin-left: 8px;"><i class="fa-solid fa-key text-neon-yellow"></i></button>
          <button class="btn-text" onclick="deleteWorker('${w._id}')" title="Delete Worker" style="margin-left: 8px;"><i class="fa-solid fa-trash-can text-neon-pink"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupWorkerFormListener() {
  const form = _w('worker-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const id       = _w('work-id')?.value || '';
    const name     = _w('work-name')?.value.trim() || '';
    const username = _w('work-username')?.value.trim().toLowerCase() || '';
    const role     = _w('work-role')?.value || 'cashier';
    const mobile   = _w('work-mobile')?.value.trim() || '';
    const email    = _w('work-email')?.value.trim() || '';

    let active = true;
    if (id) {
      const activeEl = _w('work-active');
      active = activeEl ? activeEl.value === 'true' : true;
    }

    const payload = { name, username, role, mobile, email, active };

    // Password only on creation
    if (!id) {
      const password = _w('work-password')?.value || '';
      if (!password || password.length < 6) {
        showToast('Password is required and must be min 6 characters', 'error');
        return;
      }
      payload.password = password;
    }

    try {
      if (id) {
        await API.workers.update(id, payload);
        showToast('Worker profile updated successfully', 'success');
      } else {
        await API.workers.create(payload);
        showToast('Worker registered successfully', 'success');
      }
      closeWorkerModal();
      loadWorkersDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

async function openWorkerModal(id = null) {
  const form = _w('worker-form');
  if (form) form.reset();

  _wSet('work-id',   '');
  _wSet('work-role', 'cashier');
  _wText('worker-modal-title', 'Register Cashier Worker');
  _wClass('work-pwd-group',    'remove', 'hidden');
  _wClass('work-status-group', 'add',    'hidden');

  if (id) {
    try {
      const res = await API.workers.list();
      const worker = res.data.find(w => w._id === id);
      if (worker) {
        _wSet('work-id',       worker._id);
        _wSet('work-name',     worker.name);
        _wSet('work-username', worker.username);
        _wSet('work-role',     worker.role || 'cashier');
        _wSet('work-mobile',   worker.mobile);
        _wSet('work-email',    worker.email);
        _wSet('work-active',   worker.active.toString());

        // Hide password input, show status toggle on edit
        _wClass('work-pwd-group',    'add',    'hidden');
        _wClass('work-status-group', 'remove', 'hidden');
        _wText('worker-modal-title', 'Edit Worker Details');
      }
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  _wClass('worker-modal', 'remove', 'hidden');
}

function closeWorkerModal() {
  _wClass('worker-modal', 'add', 'hidden');
}

async function resetWorkerPasswordDirect(id, name) {
  const newPassword = prompt(`Enter a new login password for worker '${name}':`);
  if (newPassword === null) return;

  if (newPassword.trim().length < 6) {
    showToast('Password must be at least 6 characters long', 'error');
    return;
  }

  try {
    await API.workers.resetPassword(id, newPassword.trim());
    showToast(`Password for worker '${name}' has been reset successfully.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteWorker(id) {
  if (confirm('Are you sure you want to delete this worker account? They will lose all billing access.')) {
    try {
      await API.workers.delete(id);
      showToast('Worker account deleted successfully', 'success');
      loadWorkersDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
