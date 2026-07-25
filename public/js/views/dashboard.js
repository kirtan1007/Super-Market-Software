// Dashboard View Initialization & Charts
let salesWeeklyChartInstance = null;
let categorySharesChartInstance = null;

// Safe helper: set textContent only if element exists
function safeText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  } else {
    console.warn(`[Dashboard] Element not found: #${id}`);
  }
}

// Safe helper: set innerHTML only if element exists
function safeHTML(id, html) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
  } else {
    console.warn(`[Dashboard] Element not found: #${id}`);
  }
}

async function initDashboard() {
  try {
    // Parallelize dashboard and low inventory alerts data fetching
    const [res, prodRes] = await Promise.all([
      API.reports.getDashboard(),
      API.products.list({ minStockAlert: 'true', limit: 5 })
    ]);

    const stats = res.data;

    // 1. Populate Metrics Cards
    safeText('dash-sales-val', `₹${stats.todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    safeText('dash-profit-val', `₹${stats.todayProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    safeText('dash-orders-val', stats.todayOrders);

    const alertsTotal = stats.lowStock + stats.outOfStock;
    safeText('dash-alerts-val', `${alertsTotal} Items`);
    safeText('dash-low-stock', `${stats.lowStock} Low`);
    safeText('dash-out-stock', `${stats.outOfStock} Out`);

    // Populate Expiry widgets
    safeText('dash-exp-expired',  stats.expiredCount || 0);
    safeText('dash-exp-today',    stats.expiringTodayCount || 0);
    safeText('dash-exp-7days',    stats.expiring7DaysCount || 0);
    safeText('dash-exp-15days',   stats.expiring15DaysCount || 0);
    safeText('dash-exp-30days',   stats.expiring30DaysCount || 0);

    // 2. Populate Recent Sales Table
    const salesTbody = document.getElementById('dash-recent-sales');
    if (salesTbody) {
      if (stats.recentSales && stats.recentSales.length > 0) {
        salesTbody.innerHTML = stats.recentSales.map(s => {
          const date = new Date(s.createdAt);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <tr>
              <td><strong>${s.invoiceNo}</strong></td>
              <td>${s.customer?.name || 'Walk-in Customer'}</td>
              <td><span class="badge-status active">${s.paymentMode}</span></td>
              <td>₹${s.finalAmount.toFixed(2)}</td>
              <td>${timeStr}</td>
            </tr>
          `;
        }).join('');
      } else {
        salesTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No recent sales invoices.</td></tr>`;
      }
    }

    // 3. Populate Low Inventory Warning Table & System Notifications bell
    const lowInventoryTbody = document.getElementById('dash-low-inventory-list');
    const lowStockItems = (prodRes.data || []).filter(p => p.currentStock > 0);
    const outOfStockItems = (prodRes.data || []).filter(p => p.currentStock === 0);

    // Populate dropdown alerts list
    if (typeof renderNotificationsList === 'function') {
      renderNotificationsList(lowStockItems, outOfStockItems);
    }

    if (lowInventoryTbody) {
      if (prodRes.data && prodRes.data.length > 0) {
        lowInventoryTbody.innerHTML = prodRes.data.map(p => `
          <tr>
            <td><span class="${p.currentStock === 0 ? 'text-neon-pink' : 'text-neon-yellow'}">${p.name}</span></td>
            <td><code>${p.barcode}</code></td>
            <td>${p.rackNumber || 'N/A'}</td>
            <td><strong>${p.currentStock}</strong> / ${p.minimumStock}</td>
          </tr>
        `).join('');
      } else {
        lowInventoryTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Inventory levels healthy.</td></tr>`;
      }
    }

    // 4. Render Chart.js Graphs
    renderWeeklyTrendChart(stats.chart);
    renderCategoryDistribution();
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast('Failed to load dashboard metrics: ' + error.message, 'error');
    }
    console.error('[Dashboard] initDashboard error:', error);
  }
}

// Chart 1: Daily Sales & Profit trends
function renderWeeklyTrendChart(chartData) {
  const ctx = document.getElementById('salesWeeklyChart');
  if (!ctx) return;

  if (salesWeeklyChartInstance) {
    salesWeeklyChartInstance.destroy();
  }

  if (!chartData) {
    console.warn('[Dashboard] No chart data for weekly trend');
    return;
  }

  // Neon gradient themes for charts
  const ctx2d = ctx.getContext('2d');
  const salesGrad = ctx2d.createLinearGradient(0, 0, 0, 300);
  salesGrad.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
  salesGrad.addColorStop(1, 'rgba(0, 210, 255, 0.02)');

  const profitGrad = ctx2d.createLinearGradient(0, 0, 0, 300);
  profitGrad.addColorStop(0, 'rgba(57, 255, 20, 0.4)');
  profitGrad.addColorStop(1, 'rgba(57, 255, 20, 0.02)');

  salesWeeklyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels || [],
      datasets: [
        {
          label: 'Gross Sales (₹)',
          data: chartData.sales || [],
          borderColor: '#00d2ff',
          backgroundColor: salesGrad,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#00d2ff'
        },
        {
          label: 'Net Profit (₹)',
          data: chartData.profits || [],
          borderColor: '#39ff14',
          backgroundColor: profitGrad,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#39ff14'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#8c899c', font: { family: 'Inter' } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8c899c' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8c899c' }
        }
      }
    }
  });
}

// Chart 2: Product Category Pie Chart
async function renderCategoryDistribution() {
  const ctx = document.getElementById('categorySharesChart');
  if (!ctx) return;

  if (categorySharesChartInstance) {
    categorySharesChartInstance.destroy();
  }

  try {
    // Generate shares dynamically from inventory listing
    const res = await API.products.list({ limit: 100 });
    const counts = {};
    (res.data || []).forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + p.currentStock;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    if (labels.length === 0) {
      labels.push('No Items');
      data.push(1);
    }

    categorySharesChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(0, 210, 255, 0.75)',
            'rgba(57, 255, 20, 0.75)',
            'rgba(255, 0, 127, 0.75)',
            'rgba(255, 238, 0, 0.75)',
            'rgba(147, 51, 234, 0.75)',
            'rgba(249, 115, 22, 0.75)',
            'rgba(100, 116, 139, 0.75)'
          ],
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#8c899c', font: { family: 'Inter' } }
          }
        }
      }
    });
  } catch (err) {
    console.error('[Dashboard] Failed to render category distribution chart:', err);
  }
}
