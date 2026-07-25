// Suppliers View Controller
async function initSuppliers() {
  await loadSuppliersDirectory();
  setupSupplierFormListener();
}

async function loadSuppliersDirectory() {
  try {
    const res = await API.suppliers.list();
    renderSuppliersTable(res.data);
  } catch (err) {
    showToast('Failed to load suppliers: ' + err.message, 'error');
  }
}

function renderSuppliersTable(suppliers) {
  const tbody = document.getElementById('suppliers-table-body');
  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No suppliers registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = suppliers.map(s => {
    // Owner Actions
    const actionsHtml = currentUser && currentUser.role === 'owner'
      ? `
        <td>
          <button class="btn-text" onclick="openSupplierModal('${s._id}')" title="Edit Supplier"><i class="fa-solid fa-pen-to-square text-neon-blue"></i></button>
          <button class="btn-text" onclick="deleteSupplier('${s._id}')" title="Delete Supplier" style="margin-left: 8px;"><i class="fa-solid fa-trash-can text-neon-pink"></i></button>
        </td>
      `
      : '<td></td>';

    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.contactPerson || 'N/A'}</td>
        <td><code>${s.mobile}</code></td>
        <td>${s.email || 'N/A'}</td>
        <td>${s.address || 'N/A'}</td>
        <td>${s.gstNumber || 'N/A'}</td>
        ${actionsHtml}
      </tr>
    `;
  }).join('');
}

function setupSupplierFormListener() {
  const form = document.getElementById('supplier-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById('supp-id').value;
    const name = document.getElementById('supp-name').value.trim();
    const contactPerson = document.getElementById('supp-contact').value.trim();
    const mobile = document.getElementById('supp-mobile').value.trim();
    const email = document.getElementById('supp-email').value.trim();
    const gstNumber = document.getElementById('supp-gst').value.trim();
    const address = document.getElementById('supp-address').value.trim();

    const payload = { name, contactPerson, mobile, email, gstNumber, address };

    try {
      if (id) {
        await API.suppliers.update(id, payload);
        showToast('Supplier updated successfully', 'success');
      } else {
        await API.suppliers.create(payload);
        showToast('Supplier registered successfully', 'success');
      }
      closeSupplierModal();
      loadSuppliersDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

async function openSupplierModal(id = null) {
  // Safe helpers
  function sSet(elId, val) {
    const el = document.getElementById(elId);
    if (el) el.value = val != null ? val : '';
  }
  function sText(elId, val) {
    const el = document.getElementById(elId);
    if (el) el.textContent = val;
  }

  const form = document.getElementById('supplier-form');
  if (form) form.reset();
  sSet('supp-id', '');
  sText('supplier-modal-title', 'Add Supplier');

  if (id) {
    try {
      const res = await API.suppliers.list();
      const supp = res.data.find(s => s._id === id);
      if (supp) {
        sSet('supp-id',      supp._id);
        sSet('supp-name',    supp.name);
        sSet('supp-contact', supp.contactPerson || '');
        sSet('supp-mobile',  supp.mobile);
        sSet('supp-email',   supp.email || '');
        sSet('supp-gst',     supp.gstNumber || '');
        sSet('supp-address', supp.address || '');
        sText('supplier-modal-title', 'Edit Supplier');
      }
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  const modal = document.getElementById('supplier-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeSupplierModal() {
  const modal = document.getElementById('supplier-modal');
  if (modal) modal.classList.add('hidden');
}

async function deleteSupplier(id) {
  if (confirm('Are you sure you want to delete this supplier?')) {
    try {
      await API.suppliers.delete(id);
      showToast('Supplier deleted successfully', 'success');
      loadSuppliersDirectory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
