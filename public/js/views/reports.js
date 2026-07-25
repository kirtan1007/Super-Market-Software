// Financial Reports View Controller
async function initReports() {
  const filterEl = document.getElementById('report-filter-range');
  if (filterEl) filterEl.value = 'today';
  toggleCustomDates();
  await loadSalesReport();
  await loadExpiryReport();
}

function toggleCustomDates() {
  const filterEl = document.getElementById('report-filter-range');
  const customBox = document.getElementById('report-custom-dates');
  if (!filterEl || !customBox) return;
  const range = filterEl.value;
  if (range === 'custom') {
    customBox.classList.remove('hidden');
    const today = new Date().toISOString().split('T')[0];
    const startEl = document.getElementById('report-start-date');
    const endEl   = document.getElementById('report-end-date');
    if (startEl) startEl.value = today;
    if (endEl)   endEl.value   = today;
  } else {
    customBox.classList.add('hidden');
  }
}

async function loadSalesReport() {
  const range = document.getElementById('report-filter-range').value;
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;

  const params = { range };
  if (range === 'custom') {
    if (!startDate || !endDate) {
      showToast('Please select both start and end dates', 'error');
      return;
    }
    params.startDate = startDate;
    params.endDate = endDate;
  }

  try {
    // 1. Fetch Sales and GST margins
    const resSales = await API.reports.getSales(params);
    const sum = resSales.summary;

    // Safe text helper
    function safeRepText(id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
      else console.warn(`[Reports] Element not found: #${id}`);
    }

    safeRepText('rep-revenue-val', `₹${sum.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    safeRepText('rep-cost-val',    `₹${sum.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    safeRepText('rep-profit-val',  `₹${sum.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    safeRepText('rep-gst-val',     `₹${sum.totalGstCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    // Populate Sales breakdown table
    const salesTbody = document.getElementById('report-sales-tbody');
    if (resSales.data.length === 0) {
      salesTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No transactions logged in this range.</td></tr>`;
    } else {
      salesTbody.innerHTML = resSales.data.map(sale => {
        const d = new Date(sale.createdAt);
        return `
          <tr>
            <td><strong>${sale.invoiceNo}</strong></td>
            <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${sale.cashier?.name || 'Cashier'}</td>
            <td>₹${sale.totalGst.toFixed(2)}</td>
            <td><strong>₹${sale.finalAmount.toFixed(2)}</strong></td>
          </tr>
        `;
      }).join('');
    }

    // 2. Fetch GST ledger brackets
    const resGst = await API.reports.getGst(params);
    const gstTbody = document.getElementById('report-gst-tbody');
    if (resGst.data.length === 0) {
      gstTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No GST entries recorded.</td></tr>`;
    } else {
      gstTbody.innerHTML = resGst.data.map(item => `
        <tr>
          <td><strong>${item._id}% Bracket</strong></td>
          <td>₹${item.taxableValue.toFixed(2)}</td>
          <td class="text-neon-pink">₹${item.gstCollected.toFixed(2)}</td>
          <td><strong>₹${item.totalSales.toFixed(2)}</strong></td>
        </tr>
      `).join('');
    }

    // 3. Fetch Product performance metrics
    const resPerformance = await API.reports.getProducts();
    const bestTbody = document.getElementById('report-best-sellers');
    const worstTbody = document.getElementById('report-worst-sellers');

    if (resPerformance.bestSellers.length === 0) {
      bestTbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No data logs.</td></tr>`;
    } else {
      bestTbody.innerHTML = resPerformance.bestSellers.map(p => `
        <tr>
          <td><strong>${p.name}</strong><br><small class="text-muted">${p.barcode}</small></td>
          <td>${p.qtySold} Units</td>
          <td><strong>₹${p.revenue.toFixed(2)}</strong></td>
        </tr>
      `).join('');
    }

    if (resPerformance.worstSellers.length === 0) {
      worstTbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No data logs.</td></tr>`;
    } else {
      worstTbody.innerHTML = resPerformance.worstSellers.map(p => `
        <tr>
          <td><strong>${p.name}</strong><br><small class="text-muted">${p.barcode}</small></td>
          <td>${p.qtySold} Units</td>
          <td><strong>₹${p.revenue.toFixed(2)}</strong></td>
        </tr>
      `).join('');
    }

  } catch (err) {
    showToast('Failed to load reports data: ' + err.message, 'error');
  }
}

// Export generated reports to CSV
function exportReportToCSV() {
  const range = document.getElementById('report-filter-range').value;
  const table = document.getElementById('report-sales-tbody');
  
  if (!table || table.rows.length === 0 || table.rows[0].cells.length < 5 || table.rows[0].cells[0].textContent.includes('No transactions')) {
    showToast('No report data available to export', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Invoice No,Date,Cashier,GST Collected (Rs),Final Amount (Rs)\n";

  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const invNo = row.cells[0].textContent;
    const date = row.cells[1].textContent.replace(',', '');
    const cashier = row.cells[2].textContent;
    const gst = row.cells[3].textContent.replace('₹', '');
    const amount = row.cells[4].textContent.replace('₹', '');
    
    csvContent += `"${invNo}","${date}","${cashier}",${gst},${amount}\n`;
  }

  // Trigger download link
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Sales_Report_${range}_${Date.now()}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
  showToast('Report CSV file exported successfully', 'success');
}

// Load Expiry & Warning Reports
async function loadExpiryReport() {
  const status = document.getElementById('expiry-report-status').value;
  const tbody = document.getElementById('expiry-report-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading expiry report...</td></tr>';

  try {
    const res = await API.reports.getExpiry(status);
    const products = res.data;

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No products matching expiry criteria found.</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => {
      let daysLeftText = 'N/A';
      let badgeText = 'No Expiry';
      let badgeStyle = 'background: rgba(255, 255, 255, 0.05); color: var(--text-muted);';

      if (p.expiryDate) {
        const expDate = new Date(p.expiryDate);
        const now = new Date();
        const timeDiff = expDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        daysLeftText = daysRemaining;

        if (daysRemaining < 0) {
          badgeStyle = 'background: rgba(139, 0, 0, 0.15); color: #ff5555;';
          badgeText = 'Expired';
        } else if (daysRemaining === 0) {
          badgeStyle = 'background: rgba(255, 51, 51, 0.15); color: #ff3333;';
          badgeText = 'Expires Today';
        } else if (daysRemaining <= 7) {
          badgeStyle = 'background: rgba(255, 51, 51, 0.15); color: #ff3333;';
          badgeText = 'Red Warning (<=7d)';
        } else if (daysRemaining <= 15) {
          badgeStyle = 'background: rgba(255, 140, 0, 0.15); color: #ff8c00;';
          badgeText = 'Orange Alert (<=15d)';
        } else if (daysRemaining <= 30) {
          badgeStyle = 'background: rgba(255, 215, 0, 0.15); color: #ffd700;';
          badgeText = 'Yellow Alert (<=30d)';
        } else {
          badgeStyle = 'background: rgba(0, 204, 102, 0.15); color: #00cc66;';
          badgeText = 'Green (Fresh)';
        }
      }

      return `
        <tr>
          <td><strong>${p.name}</strong><br><small class="text-muted">${p.brand || 'Local'}</small></td>
          <td><code>${p.barcode}</code></td>
          <td>${p.batchNumber || 'N/A'}</td>
          <td>${p.supplier?.name || 'N/A'}</td>
          <td>${p.currentStock}</td>
          <td style="color: #ff5555; font-weight: bold;">${p.expiredStock || 0}</td>
          <td>${p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : 'N/A'}</td>
          <td><strong>${daysLeftText}</strong></td>
          <td><span class="badge-status" style="${badgeStyle}">${badgeText}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load expiry report: ' + err.message, 'error');
  }
}

// Print Expiry Report (PDF Export)
function printExpiryReport() {
  const status = document.getElementById('expiry-report-status').value || 'All';
  const tbody = document.getElementById('expiry-report-tbody');
  if (tbody.rows.length === 0 || tbody.rows[0].cells[0].textContent.includes('No products') || tbody.rows[0].cells[0].textContent.includes('Select filter')) {
    showToast('No report data available to print', 'warning');
    return;
  }

  const printWindow = window.open('', '_blank');
  let html = `
    <html>
    <head>
      <title>Expiry Report - ${status.toUpperCase()}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; color: #333; padding: 20px; }
        h1 { text-align: center; margin-bottom: 5px; font-size: 1.6rem; }
        h2 { text-align: center; font-size: 1rem; color: #666; margin-top: 0; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 0.85rem; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .badge { display: inline-block; padding: 3px 6px; border-radius: 3px; font-size: 0.75rem; font-weight: bold; }
      </style>
    </head>
    <body>
      ${currentSettings?.shopLogo ? `<div style="text-align: center; margin-bottom: 10px;"><img src="${currentSettings.shopLogo}" alt="Logo" style="max-height: 80px; object-fit: contain;"></div>` : ''}
      <h1>${currentSettings?.shopName || 'Super Market'}</h1>
      <h2>Inventory Expiry & Warning Report (${status.toUpperCase()}) - ${new Date().toLocaleDateString()}</h2>
      <table>
        <thead>
          <tr>
            <th>Product Details</th>
            <th>Barcode</th>
            <th>Batch Number</th>
            <th>Supplier</th>
            <th>Stock Qty</th>
            <th>Expired Qty</th>
            <th>Expiry Date</th>
            <th>Days Left</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    html += `
      <tr>
        <td>${row.cells[0].innerHTML}</td>
        <td>${row.cells[1].innerHTML}</td>
        <td>${row.cells[2].innerHTML}</td>
        <td>${row.cells[3].innerHTML}</td>
        <td>${row.cells[4].innerHTML}</td>
        <td>${row.cells[5].innerHTML}</td>
        <td>${row.cells[6].innerHTML}</td>
        <td>${row.cells[7].innerHTML}</td>
        <td>${row.cells[8].innerHTML}</td>
      </tr>
    `;
  }

  html += `
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); window.close(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

// Export Expiry Report to Excel (CSV Format)
function exportExpiryReportToExcel() {
  const status = document.getElementById('expiry-report-status').value || 'All';
  const tbody = document.getElementById('expiry-report-tbody');
  if (tbody.rows.length === 0 || tbody.rows[0].cells[0].textContent.includes('No products') || tbody.rows[0].cells[0].textContent.includes('Select filter')) {
    showToast('No report data available to export', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Product Details,Barcode,Batch Number,Supplier Name,Stock Qty,Expired Qty,Expiry Date,Days Left,Expiry Status\n";

  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    const name = row.cells[0].textContent.replace(/"/g, '""');
    const barcode = row.cells[1].textContent.trim();
    const batch = row.cells[2].textContent.trim();
    const supplier = row.cells[3].textContent.trim();
    const stock = row.cells[4].textContent.trim();
    const expired = row.cells[5].textContent.trim();
    const expiry = row.cells[6].textContent.trim();
    const daysLeft = row.cells[7].textContent.trim();
    const expStatus = row.cells[8].textContent.trim();

    csvContent += `"${name}","${barcode}","${batch}","${supplier}",${stock},${expired},"${expiry}",${daysLeft},"${expStatus}"\n`;
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Expiry_Report_${status}_${Date.now()}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
  showToast('Expiry report CSV exported successfully', 'success');
}
