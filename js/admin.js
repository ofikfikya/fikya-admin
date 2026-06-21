/* ============================================================
   admin.js — Dashboard Moderasi Komentar Fikya.id
   - adminKey diinput user saat login, tidak pernah disimpan
     di source code. Disimpan hanya di sessionStorage selama
     tab browser masih terbuka.
   - Semua aksi penting (hapus) wajib konfirmasi.
   - Toast notification untuk feedback sukses / gagal.
   - Filter per postId dan bulk action.
   ============================================================ */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2AQEhvZTYJjnoTkk1JhHhMdfLinKonWYN0JAyXWnswP0QExe-RdiFZXGr1g87Tx1DuQ/exec';

// ── STATE ────────────────────────────────────────────────────
let allComments   = [];   // semua komentar pending dari server
let selectedRows  = new Set(); // rowIndex yang dipilih untuk bulk action
let activeFilter  = '';   // postId yang sedang difilter, '' = semua

// ── SESSION: adminKey disimpan di sessionStorage (hilang saat tab ditutup) ──
function getAdminKey() {
  return sessionStorage.getItem('fikya_admin_key') || '';
}

function setAdminKey(key) {
  sessionStorage.setItem('fikya_admin_key', key);
}

function clearAdminKey() {
  sessionStorage.removeItem('fikya_admin_key');
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (getAdminKey()) {
    showDashboard();
  } else {
    showLoginScreen();
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
function showLoginScreen() {
  document.getElementById('login-screen').style.display  = 'flex';
  document.getElementById('dashboard').style.display     = 'none';
}

function showDashboard() {
  document.getElementById('login-screen').style.display  = 'none';
  document.getElementById('dashboard').style.display     = 'block';
  loadComments();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('key-input');
  const key   = input.value.trim();

  if (!key) return;

  const btn = document.getElementById('login-btn');
  btn.disabled    = true;
  btn.textContent = 'Memverifikasi...';

  // Verifikasi key dengan mencoba getComments?mode=pending
  // Jika server mengembalikan 'Akses ditolak', key salah
  const ok = await verifyAdminKey(key);

  if (ok) {
    setAdminKey(key);
    input.value = '';
    showDashboard();
  } else {
    document.getElementById('login-error').style.display = 'block';
    btn.disabled    = false;
    btn.textContent = 'Masuk';
  }
});

function verifyAdminKey(key) {
  return new Promise((resolve) => {
    const cbName = `_verifyCallback_${Date.now()}`;

    const timeout = setTimeout(() => {
      delete window[cbName];
      resolve(false);
    }, 8000);

    window[cbName] = (response) => {
      clearTimeout(timeout);
      delete window[cbName];
      resolve(response.status === 'ok');
    };

    const s = document.createElement('script');
    s.src =
      `${SCRIPT_URL}?action=getComments&mode=pending` +
      `&adminKey=${encodeURIComponent(key)}` +
      `&callback=${cbName}&_=${Date.now()}`;
    s.onerror = () => { clearTimeout(timeout); delete window[cbName]; resolve(false); };
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 10000);
  });
}

function logout() {
  clearAdminKey();
  allComments  = [];
  selectedRows = new Set();
  activeFilter = '';
  showLoginScreen();
}

// ── LOAD COMMENTS ─────────────────────────────────────────────
function loadComments() {
  const list = document.getElementById('comment-list');
  list.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Memuat komentar...</span>
    </div>`;

  updateBulkBar();

  const cbName = `_renderComments_${Date.now()}`;

  const timeout = setTimeout(() => {
    delete window[cbName];
    list.innerHTML = `<div class="empty-state error-state">
      <p>Gagal memuat komentar. Periksa koneksi internet.</p>
      <button class="btn btn-secondary" onclick="loadComments()">Coba Lagi</button>
    </div>`;
  }, 10000);

  window[cbName] = (response) => {
    clearTimeout(timeout);
    delete window[cbName];
    renderComments(response);
  };

  const s = document.createElement('script');
  s.src =
    `${SCRIPT_URL}?action=getComments&mode=pending` +
    `&adminKey=${encodeURIComponent(getAdminKey())}` +
    `&callback=${cbName}&_=${Date.now()}`;
  s.onerror = () => {
    clearTimeout(timeout);
    delete window[cbName];
    list.innerHTML = `<div class="empty-state error-state">
      <p>Gagal memuat komentar. Periksa koneksi internet.</p>
      <button class="btn btn-secondary" onclick="loadComments()">Coba Lagi</button>
    </div>`;
  };
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 12000);
}

// ── RENDER ────────────────────────────────────────────────────
function renderComments(response) {
  const list = document.getElementById('comment-list');
  selectedRows.clear();

  if (response.status !== 'ok') {
    // Jika akses ditolak, kemungkinan key berubah — paksa logout
    if (response.message && response.message.includes('ditolak')) {
      showToast('Sesi tidak valid. Silakan login ulang.', 'error');
      setTimeout(logout, 1500);
    } else {
      list.innerHTML = `<div class="empty-state error-state"><p>${response.message || 'Terjadi kesalahan.'}</p></div>`;
    }
    return;
  }

  allComments = response.comments || [];
  updateFilterBar();
  updatePendingCount(allComments.length);
  renderFiltered();
}

function renderFiltered() {
  const list = document.getElementById('comment-list');
  selectedRows.clear();
  updateBulkBar();

  const filtered = activeFilter
    ? allComments.filter(c => c.postId === activeFilter)
    : allComments;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <p>${activeFilter ? `Tidak ada komentar pending untuk <strong>${activeFilter}</strong>.` : 'Tidak ada komentar pending.'}</p>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(c => `
    <div class="comment-card" id="row-${c.rowIndex}">
      <label class="checkbox-wrap">
        <input type="checkbox" class="row-checkbox"
          onchange="toggleSelect(${c.rowIndex}, this.checked)"
          aria-label="Pilih komentar dari ${escHtml(c.nama)}">
      </label>

      <div class="comment-info">
        <div class="comment-meta">
          <strong>${escHtml(c.nama)}</strong>
          <span class="post-id-badge">${escHtml(c.postId)}</span>
          <time class="comment-time">${c.timestamp || ''}</time>
        </div>
        <p class="comment-text">${escHtml(c.komentar)}</p>
      </div>

      <div class="btn-group">
        <button class="btn btn-approve"
          onclick="updateStatus(${c.rowIndex}, 'approved')"
          aria-label="Approve komentar dari ${escHtml(c.nama)}">
          ✓ Approve
        </button>
        <button class="btn btn-delete"
          onclick="confirmDelete(${c.rowIndex})"
          aria-label="Hapus komentar dari ${escHtml(c.nama)}">
          ✕ Hapus
        </button>
      </div>
    </div>
  `).join('');
}

// ── FILTER BAR ────────────────────────────────────────────────
function updateFilterBar() {
  const postIds = [...new Set(allComments.map(c => c.postId))].sort();
  const bar = document.getElementById('filter-bar');

  if (postIds.length <= 1) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = `
    <span class="filter-label">Filter:</span>
    <button class="filter-btn ${activeFilter === '' ? 'active' : ''}"
      onclick="setFilter('')">Semua (${allComments.length})</button>
    ${postIds.map(id => {
      const count = allComments.filter(c => c.postId === id).length;
      return `<button class="filter-btn ${activeFilter === id ? 'active' : ''}"
        onclick="setFilter('${escAttr(id)}')">${escHtml(id)} (${count})</button>`;
    }).join('')}
  `;
}

function setFilter(postId) {
  activeFilter = postId;
  updateFilterBar();
  renderFiltered();
}

// ── BULK ACTION ───────────────────────────────────────────────
function toggleSelect(rowIndex, checked) {
  if (checked) selectedRows.add(rowIndex);
  else         selectedRows.delete(rowIndex);
  updateBulkBar();
}

function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('.row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const card = cb.closest('.comment-card');
    if (card) {
      const rowIndex = parseInt(card.id.replace('row-', ''));
      if (checked) selectedRows.add(rowIndex);
      else         selectedRows.delete(rowIndex);
    }
  });
  updateBulkBar();
}

function updateBulkBar() {
  const bar   = document.getElementById('bulk-bar');
  const count = selectedRows.size;
  bar.style.display = count > 0 ? 'flex' : 'none';
  bar.querySelector('.bulk-count').textContent =
    `${count} komentar dipilih`;
}

async function bulkAction(status) {
  if (selectedRows.size === 0) return;

  if (status === 'deleted') {
    const ok = await showConfirm(
      `Hapus ${selectedRows.size} komentar yang dipilih? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!ok) return;
  }

  const bar = document.getElementById('bulk-bar');
  bar.querySelector('.bulk-actions').style.opacity = '0.5';
  bar.querySelector('.bulk-actions').style.pointerEvents = 'none';

  const rows = [...selectedRows];
  let successCount = 0;

  for (const rowIndex of rows) {
    const success = await doUpdateStatus(rowIndex, status);
    if (success) {
      successCount++;
      removeCard(rowIndex);
      allComments = allComments.filter(c => c.rowIndex !== rowIndex);
    }
  }

  selectedRows.clear();
  updateBulkBar();
  updatePendingCount(allComments.length);
  updateFilterBar();

  const label = status === 'approved' ? 'di-approve' : 'dihapus';
  showToast(`${successCount} komentar berhasil ${label}.`, 'success');

  bar.querySelector('.bulk-actions').style.opacity      = '';
  bar.querySelector('.bulk-actions').style.pointerEvents = '';
}

// ── SINGLE ACTION ─────────────────────────────────────────────
async function confirmDelete(rowIndex) {
  const ok = await showConfirm('Hapus komentar ini? Tindakan ini tidak dapat dibatalkan.');
  if (!ok) return;
  updateStatus(rowIndex, 'deleted');
}

async function updateStatus(rowIndex, status) {
  const card = document.getElementById(`row-${rowIndex}`);
  if (!card) return;

  // Tampilkan loading state pada card
  const btnGroup = card.querySelector('.btn-group');
  const original = btnGroup.innerHTML;
  btnGroup.innerHTML = `<div class="card-spinner"></div>`;
  card.style.opacity = '0.6';

  const success = await doUpdateStatus(rowIndex, status);

  if (success) {
    // Animasi keluar lalu hapus card dari DOM
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity    = '0';
    card.style.transform  = 'translateX(20px)';
    setTimeout(() => {
      card.remove();
      allComments = allComments.filter(c => c.rowIndex !== rowIndex);
      selectedRows.delete(rowIndex);
      updateBulkBar();
      updatePendingCount(allComments.length);
      updateFilterBar();

      // Cek apakah list kosong setelah penghapusan
      const filtered = activeFilter
        ? allComments.filter(c => c.postId === activeFilter)
        : allComments;
      if (filtered.length === 0) renderFiltered();
    }, 300);

    const label = status === 'approved' ? 'di-approve' : 'dihapus';
    showToast(`Komentar berhasil ${label}.`, 'success');
  } else {
    // Kembalikan tombol jika gagal
    card.style.opacity = '1';
    btnGroup.innerHTML = original;
    showToast('Gagal menghubungi server. Coba lagi.', 'error');
  }
}

// Melakukan POST ke Apps Script, return true jika berhasil
function doUpdateStatus(rowIndex, status) {
  return new Promise((resolve) => {
    const formData = new URLSearchParams();
    formData.append('action',   'updateStatus');
    formData.append('rowIndex', rowIndex);
    formData.append('status',   status);
    formData.append('adminKey', getAdminKey());

    // Karena mode:'no-cors', response selalu opaque.
    // Kita anggap berhasil jika fetch tidak throw error,
    // lalu tunggu sebentar agar Apps Script selesai menulis.
    fetch(SCRIPT_URL, {
      method : 'POST',
      mode   : 'no-cors',
      body   : formData,
    })
      .then(() => new Promise(r => setTimeout(r, 800)))
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });
}

function removeCard(rowIndex) {
  const card = document.getElementById(`row-${rowIndex}`);
  if (card) card.remove();
}

// ── PENDING COUNT (badge di tab & judul) ──────────────────────
function updatePendingCount(count) {
  document.getElementById('pending-count').textContent = count;
  document.title = count > 0
    ? `(${count}) Admin Dashboard | Fikya.id`
    : 'Admin Dashboard | Fikya.id';
}

// ── TOAST NOTIFICATION ────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(toast);

  // Animasi masuk
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  // Auto-dismiss setelah 4 detik
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── CONFIRM DIALOG ────────────────────────────────────────────
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-message').textContent = message;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));

    function cleanup() {
      overlay.classList.remove('visible');
      setTimeout(() => { overlay.style.display = 'none'; }, 200);
      document.getElementById('confirm-ok').onclick     = null;
      document.getElementById('confirm-cancel').onclick = null;
    }

    document.getElementById('confirm-ok').onclick = () => {
      cleanup(); resolve(true);
    };
    document.getElementById('confirm-cancel').onclick = () => {
      cleanup(); resolve(false);
    };
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}
