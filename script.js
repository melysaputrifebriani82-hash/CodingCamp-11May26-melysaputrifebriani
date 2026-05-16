/* ================================================================
   script.js — Budget Tracker (Polished)
   Vanilla JS · Rupiah · LocalStorage · Chart.js · Toast · Modal
   ================================================================ */

'use strict';

// ──────────────────────────────────────────────────────────────
// 1. CONSTANTS
// ──────────────────────────────────────────────────────────────

const CATEGORY_EMOJI = {
  Makanan:    '🍔',
  Transport:  '🚌',
  Hiburan:    '��',
  Kesehatan:  '💊',
  Belanja:    '🛍️',
  Tagihan:    '🧾',
  Pendidikan: '📚',
};

const CHART_COLORS = [
  '#6366f1','#ef4444','#10b981','#f59e0b',
  '#3b82f6','#a855f7','#f97316','#14b8a6',
];

// ──────────────────────────────────────────────────────────────
// 2. STATE
// ──────────────────────────────────────────────────────────────

let transactions  = [];
let pieChart      = null;
let activeFilter  = 'all';   // category filter chip
let searchQuery   = '';      // live search string
let pendingDelete = null;    // id of transaction awaiting modal confirm

// ──────────────────────────────────────────────────────────────
// 3. DOM REFERENCES
// ──────────────────────────────────────────────────────────────

// Form
const itemNameInput       = document.getElementById('itemName');
const amountInput         = document.getElementById('amount');
const categorySelect      = document.getElementById('category');
const customCategoryGroup = document.getElementById('customCategoryGroup');
const customCategoryInput = document.getElementById('customCategory');
const addBtn              = document.getElementById('addBtn');

// Errors
const nameError           = document.getElementById('nameError');
const amountError         = document.getElementById('amountError');
const categoryError       = document.getElementById('categoryError');
const customCategoryError = document.getElementById('customCategoryError');

// Banner
const totalExpenseEl      = document.getElementById('totalExpense');
const monthlyCountEl      = document.getElementById('monthlyCount');
const monthlyTotalEl      = document.getElementById('monthlyTotal');
const limitBarWrap        = document.getElementById('limitBarWrap');
const limitBarFill        = document.getElementById('limitBarFill');
const limitBarLabel       = document.getElementById('limitBarLabel');

// Monthly summary
const monthlyCategoryList = document.getElementById('monthlyCategoryList');
const currentMonthLabel   = document.getElementById('currentMonthLabel');

// Chart
const pieCanvas           = document.getElementById('pieChart');
const chartEmptyMsg       = document.getElementById('chartEmpty');

// List
const transactionList     = document.getElementById('transactionList');
const listEmpty           = document.getElementById('listEmpty');
const searchEmpty         = document.getElementById('searchEmpty');
const clearAllBtn         = document.getElementById('clearAllBtn');
const txCountBadge        = document.getElementById('txCountBadge');
const filterChips         = document.getElementById('filterChips');

// Controls
const sortSelect          = document.getElementById('sortSelect');
const searchInput         = document.getElementById('searchInput');
const searchClearBtn      = document.getElementById('searchClearBtn');
const themeToggle         = document.getElementById('themeToggle');
const themeIcon           = document.getElementById('themeIcon');
const spendingLimitInput  = document.getElementById('spendingLimit');
const navbarDate          = document.getElementById('navbarDate');

// Modal
const deleteModal         = document.getElementById('deleteModal');
const modalBody           = document.getElementById('modalBody');
const modalCancelBtn      = document.getElementById('modalCancelBtn');
const modalConfirmBtn     = document.getElementById('modalConfirmBtn');

// Toast
const toastEl             = document.getElementById('toast');

// Loading overlay
const loadingOverlay      = document.getElementById('loadingOverlay');

// ──────────────────────────────────────────────────────────────
// 4. LOCALSTORAGE HELPERS
// ──────────────────────────────────────────────────────────────

function loadTransactions() {
  try {
    const raw = localStorage.getItem('budget_transactions');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTransactions() {
  localStorage.setItem('budget_transactions', JSON.stringify(transactions));
}

function loadTheme()       { return localStorage.getItem('budget_theme') || 'light'; }
function saveTheme(t)      { localStorage.setItem('budget_theme', t); }
function loadLimit()       { return Number(localStorage.getItem('budget_limit')) || 0; }
function saveLimit(v)      { localStorage.setItem('budget_limit', v); }

// ──────────────────────────────────────────────────────────────
// 5. CURRENCY FORMATTER
// ──────────────────────────────────────────────────────────────

/** Format a number as Indonesian Rupiah, e.g. 25000 → "Rp 25.000" */
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

// ──────────────────────────────────────────────────────────────
// 6. TOAST NOTIFICATION
// ──────────────────────────────────────────────────────────────

let toastTimer = null;

/**
 * Show a brief toast message.
 * @param {string} message  - Text to display
 * @param {'success'|'error'|'warning'|''} type - Visual style
 */
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2800);
}

// ──────────────────────────────────────────────────────────────
// 7. CUSTOM DELETE MODAL
// ──────────────────────────────────────────────────────────────

/** Open the delete confirmation modal for a given transaction id. */
function openDeleteModal(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  pendingDelete = id;
  modalBody.textContent = `"${t.name}" — ${formatRupiah(t.amount)} akan dihapus secara permanen.`;
  deleteModal.style.display = 'flex';
  modalConfirmBtn.focus();
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  pendingDelete = null;
}

// Close modal on backdrop click
deleteModal.addEventListener('click', e => {
  if (e.target === deleteModal) closeDeleteModal();
});

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && deleteModal.style.display === 'flex') closeDeleteModal();
});

modalCancelBtn.addEventListener('click', closeDeleteModal);

modalConfirmBtn.addEventListener('click', () => {
  if (pendingDelete === null) return;
  transactions = transactions.filter(x => x.id !== pendingDelete);
  saveTransactions();
  closeDeleteModal();
  renderAll();
  showToast('Transaksi dihapus.', 'error');
});

// ──────────────────────────────────────────────────────────────
// 8. THEME TOGGLE
// ──────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
  renderChart(); // update chart legend colour
});

// ──────────────────────────────────────────────────────────────
// 9. NAVBAR DATE
// ──────────────────────────────────────────────────────────────

function renderNavbarDate() {
  navbarDate.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ──────────────────────────────────────────────────────────────
// 10. SPENDING LIMIT
// ──────────────────────────────────────────────────────────────

function renderLimitBar() {
  const limit = Number(spendingLimitInput.value) || 0;
  const total = transactions.reduce((s, t) => s + t.amount, 0);

  if (limit <= 0) { limitBarWrap.style.display = 'none'; return; }

  limitBarWrap.style.display = 'flex';
  const pct = Math.min((total / limit) * 100, 100);
  limitBarFill.style.width = pct + '%';
  limitBarFill.classList.toggle('over', total > limit);

  const remaining = limit - total;
  limitBarLabel.textContent = remaining >= 0
    ? `Sisa ${formatRupiah(remaining)} dari ${formatRupiah(limit)}`
    : `⚠️ Melebihi batas ${formatRupiah(Math.abs(remaining))}`;
}

spendingLimitInput.addEventListener('input', () => {
  saveLimit(spendingLimitInput.value);
  renderAll();
});

// ──────────────────────────────────────────────────────────────
// 11. CUSTOM CATEGORY TOGGLE
// ──────────────────────────────────────────────────────────────

categorySelect.addEventListener('change', () => {
  const isCustom = categorySelect.value === 'Custom';
  customCategoryGroup.style.display = isCustom ? 'flex' : 'none';
  if (isCustom) customCategoryInput.focus();
  else {
    customCategoryInput.value = '';
    clearFieldError(customCategoryInput, customCategoryError);
  }
});

// ──────────────────────────────────────────────────────────────
// 12. FORM VALIDATION
// ──────────────────────────────────────────────────────────────

function showFieldError(input, errorEl, message) {
  input.classList.add('invalid');
  errorEl.textContent = '⚠ ' + message;
}

function clearFieldError(input, errorEl) {
  input.classList.remove('invalid');
  errorEl.textContent = '';
}

function validateForm() {
  let valid = true;
  clearFieldError(itemNameInput,       nameError);
  clearFieldError(amountInput,         amountError);
  clearFieldError(categorySelect,      categoryError);
  clearFieldError(customCategoryInput, customCategoryError);

  const name = itemNameInput.value.trim();
  if (!name) {
    showFieldError(itemNameInput, nameError, 'Nama item tidak boleh kosong.');
    valid = false;
  } else if (name.length < 2) {
    showFieldError(itemNameInput, nameError, 'Nama item minimal 2 karakter.');
    valid = false;
  }

  const rawAmount = amountInput.value.trim();
  const amount    = parseFloat(rawAmount);
  if (!rawAmount || isNaN(amount) || amount <= 0) {
    showFieldError(amountInput, amountError, 'Masukkan jumlah yang valid (lebih dari 0).');
    valid = false;
  } else if (amount > 1_000_000_000_000) {
    showFieldError(amountInput, amountError, 'Jumlah terlalu besar.');
    valid = false;
  }

  let category = categorySelect.value;
  if (!category) {
    showFieldError(categorySelect, categoryError, 'Pilih kategori terlebih dahulu.');
    valid = false;
  }

  if (category === 'Custom') {
    const custom = customCategoryInput.value.trim();
    if (!custom) {
      showFieldError(customCategoryInput, customCategoryError, 'Masukkan nama kategori kustom.');
      valid = false;
    } else {
      category = custom;
    }
  }

  return { valid, name, amount, category };
}

// ──────────────────────────────────────────────────────────────
// 13. ADD TRANSACTION
// ──────────────────────────────────────────────────────────────

addBtn.addEventListener('click', addTransaction);

[itemNameInput, amountInput, customCategoryInput].forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') addTransaction(); });
});

function addTransaction() {
  const { valid, name, amount, category } = validateForm();
  if (!valid) return;

  const now = new Date();
  transactions.push({
    id:        Date.now(),
    name,
    amount:    Math.round(amount),
    category,
    dateISO:   now.toISOString(),
    dateLabel: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
  });

  saveTransactions();
  renderAll();
  resetForm();
  showToast(`✓ "${name}" ditambahkan!`, 'success');
}

function resetForm() {
  itemNameInput.value = amountInput.value = categorySelect.value = customCategoryInput.value = '';
  customCategoryGroup.style.display = 'none';
  [itemNameInput, amountInput, categorySelect, customCategoryInput].forEach(el => el.classList.remove('invalid'));
  [nameError, amountError, categoryError, customCategoryError].forEach(el => el.textContent = '');
  itemNameInput.focus();
}

// ──────────────────────────────────────────────────────────────
// 14. DELETE TRANSACTION
// ──────────────────────────────────────────────────────────────

// Single delete — opens modal
function deleteTransaction(id) {
  openDeleteModal(id);
}

// Clear all — also uses modal pattern via native confirm (kept simple)
clearAllBtn.addEventListener('click', () => {
  if (!confirm('Hapus SEMUA transaksi? Tindakan ini tidak dapat dibatalkan.')) return;
  transactions = [];
  saveTransactions();
  renderAll();
  showToast('Semua transaksi dihapus.', 'error');
});

// ──────────────────────────────────────────────────────────────
// 15. SEARCH
// ──────────────────────────────────────────────────────────────

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  searchClearBtn.style.display = searchQuery ? 'block' : 'none';
  renderList();
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClearBtn.style.display = 'none';
  searchInput.focus();
  renderList();
});

// ──────────────────────────────────────────────────────────────
// 16. CATEGORY FILTER CHIPS
// ──────────────────────────────────────────────────────────────

/** Rebuild the filter chip bar from current unique categories. */
function renderFilterChips() {
  const cats = [...new Set(transactions.map(t => t.category))].sort((a, b) =>
    a.localeCompare(b, 'id')
  );

  // Keep "Semua" chip, rebuild the rest
  filterChips.innerHTML = `<button class="chip${activeFilter === 'all' ? ' active' : ''}" data-cat="all">Semua</button>`;

  cats.forEach(cat => {
    const emoji = CATEGORY_EMOJI[cat] || '📌';
    const btn   = document.createElement('button');
    btn.className = 'chip' + (activeFilter === cat ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = `${emoji} ${cat}`;
    filterChips.appendChild(btn);
  });
}

// Event delegation on the chips container — no duplicate listeners
filterChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  activeFilter = chip.dataset.cat;
  renderFilterChips(); // re-render to update active class
  renderList();
});

// ──────────────────────────────────────────────────────────────
// 17. SORTING
// ──────────────────────────────────────────────────────────────

function getSorted() {
  const copy = [...transactions];
  switch (sortSelect.value) {
    case 'oldest':   return copy.sort((a, b) => a.id - b.id);
    case 'highest':  return copy.sort((a, b) => b.amount - a.amount);
    case 'lowest':   return copy.sort((a, b) => a.amount - b.amount);
    case 'category': return copy.sort((a, b) => a.category.localeCompare(b.category, 'id'));
    default:         return copy.sort((a, b) => b.id - a.id);
  }
}

sortSelect.addEventListener('change', renderList);

// ──────────────────────────────────────────────────────────────
// 18. RENDER — TRANSACTION LIST
// ──────────────────────────────────────────────────────────────

function renderList() {
  const limit = Number(spendingLimitInput.value) || 0;

  // Apply category filter
  let filtered = getSorted();
  if (activeFilter !== 'all') {
    filtered = filtered.filter(t => t.category === activeFilter);
  }

  // Apply search filter
  if (searchQuery) {
    filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(searchQuery) ||
      t.category.toLowerCase().includes(searchQuery)
    );
  }

  const hasTransactions = transactions.length > 0;
  const hasResults      = filtered.length > 0;
  const isSearching     = searchQuery !== '' || activeFilter !== 'all';

  // Show/hide states
  listEmpty.style.display   = !hasTransactions ? 'flex' : 'none';
  searchEmpty.style.display = hasTransactions && !hasResults && isSearching ? 'flex' : 'none';
  clearAllBtn.style.display = hasTransactions ? 'block' : 'none';

  // Update transaction counter badge
  txCountBadge.textContent = transactions.length;

  // Build list HTML
  transactionList.innerHTML = filtered.map(t => {
    const emoji    = CATEGORY_EMOJI[t.category] || '📌';
    const isOver   = limit > 0 && t.amount > limit;
    const overCls  = isOver ? ' over-limit' : '';
    const warnBadge = isOver ? `<span class="item-warn" title="Melebihi batas">⚠️</span>` : '';

    return `
      <li class="transaction-item${overCls}" data-id="${t.id}">
        <span class="item-badge">${emoji}</span>
        <div class="item-info">
          <div class="item-name">${escapeHtml(t.name)}</div>
          <div class="item-meta">
            <span class="item-cat-pill">${escapeHtml(t.category)}</span>
            ${t.dateLabel}
          </div>
        </div>
        ${warnBadge}
        <span class="item-amount">${formatRupiah(t.amount)}</span>
        <button class="btn-delete" data-id="${t.id}"
                title="Hapus transaksi"
                aria-label="Hapus ${escapeHtml(t.name)}">✕</button>
      </li>`;
  }).join('');

  // Attach delete listeners via event delegation on the list
  transactionList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
}

// ──────────────────────────────────────────────────────────────
// 19. RENDER — BALANCE BANNER
// ──────────────────────────────────────────────────────────────

function renderBanner() {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  totalExpenseEl.textContent = formatRupiah(total);

  const now = new Date();
  const monthly = transactions.filter(t => {
    const d = new Date(t.dateISO);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  monthlyCountEl.textContent = monthly.length;
  monthlyTotalEl.textContent = formatRupiah(monthly.reduce((s, t) => s + t.amount, 0));

  renderLimitBar();
}

// ──────────────────────────────────────────────────────────────
// 20. RENDER — MONTHLY SUMMARY CARD
// ──────────────────────────────────────────────────────────────

function renderMonthlySummary() {
  const now = new Date();
  currentMonthLabel.textContent = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const monthly = transactions.filter(t => {
    const d = new Date(t.dateISO);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  if (monthly.length === 0) {
    monthlyCategoryList.innerHTML = '<p class="empty-hint">Belum ada data bulan ini.</p>';
    return;
  }

  // Aggregate by category, sort descending
  const catTotals = {};
  monthly.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  monthlyCategoryList.innerHTML = sorted.map(([cat, total]) => `
    <div class="monthly-row">
      <span class="monthly-cat">${CATEGORY_EMOJI[cat] || '📌'} ${escapeHtml(cat)}</span>
      <span class="monthly-amount">${formatRupiah(total)}</span>
    </div>`).join('');
}

// ──────────────────────────────────────────────────────────────
// 21. RENDER — PIE CHART
// ──────────────────────────────────────────────────────────────

function renderChart() {
  const catTotals = {};
  transactions.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });

  const labels = Object.keys(catTotals);
  const data   = Object.values(catTotals);

  if (labels.length === 0) {
    chartEmptyMsg.style.display = 'flex';
    pieCanvas.style.display     = 'none';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  chartEmptyMsg.style.display = 'none';
  pieCanvas.style.display     = 'block';

  const bgColors   = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
  const style      = getComputedStyle(document.documentElement);
  const textColor  = style.getPropertyValue('--text').trim()    || '#1a1f36';
  const surfaceCol = style.getPropertyValue('--surface').trim() || '#ffffff';

  if (pieChart) {
    pieChart.data.labels                         = labels;
    pieChart.data.datasets[0].data               = data;
    pieChart.data.datasets[0].backgroundColor    = bgColors;
    pieChart.data.datasets[0].borderColor        = surfaceCol;
    pieChart.options.plugins.legend.labels.color = textColor;
    pieChart.update();
  } else {
    pieChart = new Chart(pieCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data, backgroundColor: bgColors,
          borderWidth: 3, borderColor: surfaceCol, hoverOffset: 10,
        }],
      },
      options: {
        responsive: true,
        animation: { duration: 450 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 14, color: textColor,
              font: { size: 12, family: "'Inter', sans-serif" },
              usePointStyle: true, pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${formatRupiah(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

// ──────────────────────────────────────────────────────────────
// 22. RENDER ALL
// ──────────────────────────────────────────────────────────────

function renderAll() {
  renderFilterChips();
  renderList();
  renderBanner();
  renderMonthlySummary();
  renderChart();
}

// ──────────────────────────────────────────────────────────────
// 23. XSS PREVENTION
// ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ──────────────────────────────────────────────────────────────
// 24. INITIALISE
// ──────────────────────────────────────────────────────────────

(function init() {
  // Restore theme immediately (before paint)
  applyTheme(loadTheme());

  // Show current date in navbar
  renderNavbarDate();

  // Restore spending limit
  const savedLimit = loadLimit();
  if (savedLimit > 0) spendingLimitInput.value = savedLimit;

  // Load data
  transactions = loadTransactions();

  // Render UI
  renderAll();

  // Hide loading overlay with a short delay for polish
  setTimeout(() => {
    loadingOverlay.classList.add('fade-out');
    setTimeout(() => { loadingOverlay.style.display = 'none'; }, 420);
  }, 500);

  // Focus first input
  itemNameInput.focus();
})();
