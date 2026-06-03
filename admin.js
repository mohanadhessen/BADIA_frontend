let API = localStorage.getItem('badia_admin_api') || 'https://badia-backend.onrender.com';
const TOKEN = () => localStorage.getItem('access_token') || '';

// ── State ───────────────────────────────────────────────────────
let _users    = [];
let _plans    = [];
let _requests = [];
let _reviews  = [];
let _currentPage = 'dashboard';
let _totalUsers = 0;
let _totalRequests = 0;
let _totalReviews = 0;

// ── Pagination State (persists across tab switches) ─────────────
let _userPage = 1, _userHasMore = false, _userLoading = false;
let _reqPage  = 1, _reqHasMore  = false, _reqLoading  = false;
let _revPage  = 1, _revHasMore  = false, _revLoading  = false;
const PAGE_LIMIT = 25;

// ── API Helper (with auto token refresh) ───────────────────────
let _refreshing = false;
let _refreshQueue = [];

async function doRefreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${API}/api/v1/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  if (data.access_token) localStorage.setItem('access_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (TOKEN()) headers['Authorization'] = `Bearer ${TOKEN()}`;
  let res = await fetch(`${API}${path}`, { ...opts, headers });

  if (res.status === 401) {
    // Try refreshing once
    if (!_refreshing) {
      _refreshing = true;
      try {
        const newToken = await doRefreshToken();
        _refreshing = false;
        // Drain queued resolvers
        _refreshQueue.forEach(r => r(newToken));
        _refreshQueue = [];
        // Retry original request
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${API}${path}`, { ...opts, headers });
      } catch (e) {
        _refreshing = false;
        _refreshQueue.forEach(r => r(null));
        _refreshQueue = [];
        // Refresh token expired — redirect to sign in
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        toast('Session expired. Redirecting to sign in…', 'error');
        setTimeout(() => { window.location.href = 'Signin.html'; }, 1500);
        throw new Error('Session expired');
      }
    } else {
      // Another request is already refreshing — queue this one
      const newToken = await new Promise(resolve => _refreshQueue.push(resolve));
      if (!newToken) throw new Error('Session expired');
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API}${path}`, { ...opts, headers });
    }
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ── Page Navigation (with hash persistence) ────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${id}`)?.classList.add('active');
  document.querySelector(`[data-page="${id}"]`)?.classList.add('active');
  _currentPage = id;
  const titles = { dashboard:'Dashboard', requests:'Service Requests', users:'Users', plans:'Pricing Plans', reviews:'Reviews', settings:'Settings' };
  document.getElementById('topbarTitle').textContent = titles[id] || id;
  // Persist section in URL hash so F5 restores it
  history.replaceState(null, '', '#' + id);
  closeSidebar();
}

// ── Sidebar ─────────────────────────────────────────────────────
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebarOverlay');
  const h = document.getElementById('hamburger');
  s.classList.toggle('open'); o.classList.toggle('visible'); h.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
  document.getElementById('hamburger').classList.remove('open');
}

// ── Toast ───────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-dot"></div>${msg}`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

// ── Modal helpers ───────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Utilities ───────────────────────────────────────────────────
function planClass(name) {
  const m = { starter:'plan-starter', business:'plan-business', pro:'plan-pro', enterprise:'plan-enterprise' };
  return m[(name||'').toLowerCase()] || 'plan-none';
}
function statusBadge(status) {
  const m = {
    pending: '<span class="badge badge-yellow"><span class="badge-dot"></span>Pending</span>',
    approved: '<span class="badge badge-green"><span class="badge-dot"></span>Approved</span>',
    rejected: '<span class="badge badge-red"><span class="badge-dot"></span>Rejected</span>',
    active:   '<span class="badge badge-green"><span class="badge-dot"></span>Active</span>',
    inactive: '<span class="badge badge-gray"><span class="badge-dot"></span>Inactive</span>',
    suspended:'<span class="badge badge-red"><span class="badge-dot"></span>Suspended</span>',
  };
  return m[status] || `<span class="badge badge-gray"><span class="badge-dot"></span>${status}</span>`;
}
function typeChip(type) {
  return type === 'partnership'
    ? '<span class="type-chip type-partnership"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>Partnership</span>'
    : '<span class="type-chip type-feasibility"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>Feasibility</span>';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(0)}KB`;
  return `${(bytes/1048576).toFixed(1)}MB`;
}

// ── Download helpers ──────────────────────────────────────────────
async function downloadFileById(reqId, fileId, filename) {
  if (!fileId) {
    toast('File ID missing', 'error');
    return;
  }

  try {
    const data = await apiFetch(`/api/v1/admin/requests/${reqId}/files/${fileId}`);
    const url = data.url || data.presigned_url;

    if (!url) throw new Error('No URL');

    // THIS is what triggers download
    window.location.href = url;

  } catch (e) {
    toast('Failed to get download link', 'error');
  }
}

async function downloadAllFiles(reqId) {
  const req = _requests.find(r => r.id === reqId);
  if (!req || !req.files?.length) { toast('No files found', 'error'); return; }
  toast(`Opening ${req.files.length} file(s) for download…`, 'info');
  for (const f of req.files) {
    const fileId = f.file_id || f.id || '';
    const fname  = f.filename || f.name || 'file';
    if (!fileId) continue;
    await downloadFileById(reqId, fileId, fname);
    await new Promise(r => setTimeout(r, 500));
  }
}

async function triggerDownload(url, filename) {
  try {
    // Fetch as blob so the browser treats it as a download regardless of CORS origin
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (e) {
    // Fallback: open in new tab if blob fetch fails (e.g. CORS blocks it)
    window.open(url, '_blank', 'noopener');
  }
}

// Keep old name as alias just in case
function downloadFileAuth(url, filename) { triggerDownload(url, filename); }
function downloadFile(url, filename)     { triggerDownload(url, filename); }
let _planDistributionData = [];

async function loadPlanDistribution() {
  try {
    const data = await apiFetch('/api/v1/admin/users/plan-distribution');
    if (Array.isArray(data)) {
      _planDistributionData = data;
    } else if (data && typeof data === 'object') {
      _planDistributionData = Object.entries(data).map(([name, count]) => ({ name, count }));
    }
  } catch (e) {
    // silently fail
  }
}

async function loadAll() {
  await Promise.allSettled([loadUsers(1), loadPlans(), loadRequests(1), loadReviews(1), loadStorageUsage(), loadPlanDistribution()]);
  renderDashboard();
}



async function loadStorageUsage() {
  try {
    const data = await apiFetch('/api/v1/admin/storage/usage');
    const mb  = data.used_mb  ?? 0;
    const gb  = data.used_gb  ?? 0;
    const pct = data.usage_percent ?? 0;
    const rem = data.remaining_gb ?? 0;
    const files = data.total_files ?? 0;
    const displayVal = gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
    document.getElementById('statStorageVal').textContent = displayVal;
    document.getElementById('statStorageSub').textContent = `${files} file${files!==1?'s':''} · ${rem.toFixed(2)} GB free`;
    document.getElementById('statStoragePct').textContent = `${pct.toFixed(1)}%`;
    const bar = document.getElementById('statStorageBar');
    bar.style.width = `${Math.min(pct, 100)}%`;
    bar.className = 'storage-bar-fill' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');
  } catch (e) {
    document.getElementById('statStorageVal').textContent = '—';
    document.getElementById('statStorageSub').textContent = 'Storage data unavailable';
  }
}

// ── USERS ────────────────────────────────────────────────────────
async function loadUsers(page) {
  if (_userLoading) return;
  _userLoading = true;
  _userPage = page || 1;
  setUserPaginationLoading(true);
  try {
    const data = await apiFetch(`/api/v1/admin/users?page=${_userPage}`);
    _users = data && Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : (data.results || data.users || []));
    _userHasMore = data && data.has_next !== undefined ? !!data.has_next : (_users.length === PAGE_LIMIT);
    _totalUsers = data?.metrics?.total_users ?? _users.length;
    renderUsersTable(_users);
    updateUserCount();
    populatePlanFilter();
  } catch (e) {
    _users = [];
    _totalUsers = 0;
    renderUsersTable([]);
    toast('Could not load users — API not yet available', 'error');
  }
  _userLoading = false;
  setUserPaginationLoading(false);
  updateUserPagination();
}

function updateUserPagination() {
  document.getElementById('userPageNum').textContent = _userPage;
  document.getElementById('userPaginationInfo').textContent = `Page ${_userPage} · ${_users.length} of ${_totalUsers} shown`;
  document.getElementById('userPrevBtn').disabled = _userPage <= 1;
  document.getElementById('userNextBtn').disabled = !_userHasMore;
}

function setUserPaginationLoading(on) {
  const info = document.getElementById('userPaginationInfo');
  if (on) info.innerHTML = '<span class="pagination-loading"><span class="pagination-spinner"></span>Loading…</span>';
}

async function changeUserPage(page) {
  if (page < 1 || _userLoading) return;
  if (page > _userPage && !_userHasMore) return;
  await loadUsers(page);
  document.getElementById('page-users').scrollIntoView({ behavior:'smooth', block:'start' });
}

function updateUserCount() {
  const displayCount = _users.length;
  const n = _totalUsers !== undefined ? _totalUsers : displayCount;
  document.getElementById('userCount').textContent = `${n} user${n !== 1 ? 's' : ''}`;
  document.getElementById('sidebarUserCount').textContent = n;
  document.getElementById('statUsers').textContent = n;
  document.getElementById('statActive').textContent = _users.filter(u => u.is_active !== false && (u.plan_name || u.plan)).length;
}

function populatePlanFilter() {
  ['planFilter','reqPlanFilter'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const existing = new Set([...sel.options].map(o => o.value));
    const names = [...new Set(_users.map(u => u.plan_name || u.plan || '').filter(Boolean))];
    names.forEach(p => {
      if (!existing.has(p)) {
        const o = document.createElement('option');
        o.value = p; o.textContent = p; sel.appendChild(o);
      }
    });
  });
}

function renderUsersTable(users) { renderUsersCards(users); }
function renderUsersCards(users) {
  const grid = document.getElementById('usersCardsGrid');
  if (!users.length) {
    grid.innerHTML = `<div class="item-row"><div class="item-row-body"><div class="empty-state"><div class="empty-state-icon"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><h3>No users found</h3><p>Try adjusting your search or filters</p></div></div></div>`;
    return;
  }
  grid.innerHTML = users.map(u => {
    const name    = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '—';
    const email   = u.email || '—';
    const phone   = u.phone || u.phone_number || '—';
    const plan    = u.plan_name || u.plan || 'None';
    const status  = u.is_active === false ? 'inactive' : 'active';
    const joined  = fmtDate(u.date_joined || u.created_at);
    const uid     = u.id || u.user_id || '—';
    const initials = name !== '—' ? name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() : (email[0]||'?').toUpperCase();
    return `<div class="item-row">
      <div class="item-row-body">
        <div class="item-info-header">
          <div class="recent-avatar" style="width:42px;height:42px;font-size:.84rem;border-radius:10px;flex-shrink:0">${initials}</div>
          <div style="flex:1;min-width:0">
            <div class="item-info-title">${name}</div>
            <div class="item-info-sub">${email}</div>
          </div>
          <div>${statusBadge(status)}</div>
        </div>
        <div class="item-info-grid">
          <div class="item-info-field">
            <span class="item-info-label">User ID</span>
            <span class="item-info-value td-mono">#${uid}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Phone</span>
            <span class="item-info-value">${phone}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Plan</span>
            <span class="item-info-value"><span class="plan-pill ${planClass(plan)}">${plan}</span></span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Joined</span>
            <span class="item-info-value">${joined}</span>
          </div>
        </div>
      </div>
      <div class="item-row-actions">
        <button class="act-btn act-btn-edit" onclick="openEditUserById(${uid})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit User
        </button>
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" onclick="confirmDelete(${uid},'${email}')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete User
        </button>
      </div>
    </div>`;
  }).join('');
}

let _userSearchTimer = null;
function filterUsers(q) {
  clearTimeout(_userSearchTimer);
  _userSearchTimer = setTimeout(() => _filterUsersNow(q), 300);
}

async function _filterUsersNow(q) {
  const plan = document.getElementById('planFilter').value.toLowerCase();
  const st   = document.getElementById('statusFilter')?.value.toLowerCase() || '';
  const query = (q || '').toLowerCase().trim();

  let pool = _users;

  // Use server search endpoint when query looks like an email or is non-empty
  if (query && query.includes('@')) {
    try {
      const result = await apiFetch(`/api/v1/admin/users/by-email?email=${encodeURIComponent(query)}`);
      pool = result ? (Array.isArray(result) ? result : [result]) : [];
    } catch (e) {
      pool = [];
    }
  } else if (query) {
    pool = _users.filter(u =>
      (u.email||'').toLowerCase().includes(query) ||
      (u.first_name||'').toLowerCase().includes(query) ||
      (u.last_name||'').toLowerCase().includes(query) ||
      String(u.id||u.user_id||'').includes(query)
    );
  }

  const filtered = pool.filter(u => {
    const matchPlan = !plan || (u.plan_name||u.plan||'').toLowerCase() === plan;
    const status = u.is_active === false ? 'inactive' : 'active';
    const matchSt = !st || status === st;
    return matchPlan && matchSt;
  });
  document.getElementById('userCount').textContent = `${filtered.length} user${filtered.length!==1?'s':''}`;
  renderUsersCards(filtered);
}

function openEditUserById(id) {
  const user = _users.find(u => String(u.id || u.user_id) === String(id));
  if (user) openEditUser(user);
}

function openEditUser(user) {
  document.getElementById('editUserId').value = user.id || user.user_id;
  document.getElementById('editFirstName').value = user.first_name || '';
  document.getElementById('editLastName').value  = user.last_name  || '';
  document.getElementById('editEmail').value  = user.email || '';
  document.getElementById('editPhone').value  = user.phone || user.phone_number || '';
  document.getElementById('editStatus').value = user.is_active === false ? 'inactive' : 'active';
  document.getElementById('editUserSubtitle').textContent = user.email || `User #${user.id}`;
  const sel = document.getElementById('editPlan');
  sel.innerHTML = `<option value="">No Plan</option>` +
    _plans.map(p => `<option value="${p.id}" ${user.plan_id===p.id?'selected':''}>${p.name}</option>`).join('');
  openModal('editUserModal');
}

async function saveUser() {
  const id = document.getElementById('editUserId').value;
  const payload = {
    first_name: document.getElementById('editFirstName').value,
    last_name:  document.getElementById('editLastName').value,
    email:      document.getElementById('editEmail').value,
    phone:      document.getElementById('editPhone').value,
    is_active:  document.getElementById('editStatus').value === 'active',
    plan_id:    document.getElementById('editPlan').value || null,
  };
  try {
    await apiFetch(`/api/v1/admin/users/${encodeURIComponent(payload.email)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const idx = _users.findIndex(u => String(u.id||u.user_id) === String(id));
    if (idx >= 0) { _users[idx] = { ..._users[idx], ...payload }; renderUsersTable(_users); }
    closeModal('editUserModal');
    toast('User updated successfully', 'success');
  } catch (e) {
    toast('Failed to update user', 'error');
  }
}

function confirmDelete(userId, email) {
  document.getElementById('deleteUserDetail').textContent = `${email} (ID: ${userId})`;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteUser(userId);
  openModal('deleteModal');
}

async function deleteUser(userId) {
  const user = _users.find(u => String(u.id||u.user_id) === String(userId));
  const email = user?.email;
  try {
    await apiFetch(`/api/v1/admin/users/${encodeURIComponent(email || userId)}`, { method: 'DELETE' });
    _users = _users.filter(u => String(u.id||u.user_id) !== String(userId));
    renderUsersTable(_users);
    updateUserCount();
    closeModal('deleteModal');
    toast('User deleted', 'info');
  } catch (e) {
    toast('Failed to delete user', 'error');
  }
}

// ── REQUESTS ─────────────────────────────────────────────────────
async function loadRequests(page) {
  if (_reqLoading) return;
  _reqLoading = true;
  _reqPage = page || 1;
  setReqPaginationLoading(true);
  try {
    const data = await apiFetch(`/api/v1/admin/requests?page=${_reqPage}`);
    _requests = data && Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : (data.results || data.requests || []));
    _reqHasMore = data && data.has_next !== undefined ? !!data.has_next : (_requests.length === PAGE_LIMIT);
    _totalRequests = data?.metrics?.total ?? _requests.length;
  } catch (e) {
    _requests = [];
    _totalRequests = 0;
  }
  renderRequests(_requests);
  updateRequestStats();
  _reqLoading = false;
  setReqPaginationLoading(false);
  updateReqPagination();
}

function updateReqPagination() {
  document.getElementById('reqPageNum').textContent = _reqPage;
  document.getElementById('reqPaginationInfo').textContent = `Page ${_reqPage} · ${_requests.length} of ${_totalRequests} shown`;
  document.getElementById('reqPrevBtn').disabled = _reqPage <= 1;
  document.getElementById('reqNextBtn').disabled = !_reqHasMore;
}

function setReqPaginationLoading(on) {
  const info = document.getElementById('reqPaginationInfo');
  if (on) info.innerHTML = '<span class="pagination-loading"><span class="pagination-spinner"></span>Loading…</span>';
}

async function changeReqPage(page) {
  if (page < 1 || _reqLoading) return;
  if (page > _reqPage && !_reqHasMore) return;
  await loadRequests(page);
  document.getElementById('page-requests').scrollIntoView({ behavior:'smooth', block:'start' });
}

function updateRequestStats() {
  const displayCount = _requests.length;
  const total    = _totalRequests !== undefined ? _totalRequests : displayCount;
  const pending  = _requests.filter(r => r.status === 'pending').length;
  const approved = _requests.filter(r => r.status === 'approved').length;
  const rejected = _requests.filter(r => r.status === 'rejected').length;
  document.getElementById('reqStatTotal').textContent    = total;
  document.getElementById('reqStatPending').textContent  = pending;
  document.getElementById('reqStatApproved').textContent = approved;
  document.getElementById('reqStatRejected').textContent = rejected;
  document.getElementById('statRequests').textContent    = total;
  document.getElementById('statPending').textContent     = pending;
  document.getElementById('statApproved').textContent    = approved;
  document.getElementById('sidebarPendingCount').textContent = pending || '—';
  document.getElementById('reqCount').textContent = `${total} request${total!==1?'s':''}`;
}

let _reqSearchTimer = null;
function filterRequests() {
  clearTimeout(_reqSearchTimer);
  _reqSearchTimer = setTimeout(_filterRequestsNow, 250);
}

function _filterRequestsNow() {
  const q      = (document.getElementById('reqSearch').value || '').toLowerCase();
  const type   = document.getElementById('reqTypeFilter').value;
  const status = document.getElementById('reqStatusFilter').value;
  const plan   = document.getElementById('reqPlanFilter').value.toLowerCase();
  const sort   = document.getElementById('reqSortFilter').value;

  let filtered = _requests.filter(r => {
    const user = r.user || {};
    const matchQ = !q ||
      (user.email||'').toLowerCase().includes(q) ||
      ((user.full_name||'') + ' ' + (user.first_name||'')+' '+(user.last_name||'')).toLowerCase().includes(q) ||
      (r.request_type||r.type||'').toLowerCase().includes(q) ||
      String(r.id||'').includes(q);
    const matchType   = !type   || (r.request_type||r.type||'') === type;
    const matchStatus = !status || r.status === status;
    const matchPlan   = !plan   || (user.plan||user.plan_name||'').toLowerCase() === plan;
    return matchQ && matchType && matchStatus && matchPlan;
  });

  filtered.sort((a, b) => {
    const da = new Date(a.created_at||0), db = new Date(b.created_at||0);
    return sort === 'oldest' ? da - db : db - da;
  });

  document.getElementById('reqCount').textContent = `${filtered.length} request${filtered.length!==1?'s':''}`;
  renderRequests(filtered);
}

function renderRequests(requests) {
  const grid = document.getElementById('requestsCardsGrid');
  if (!requests.length) {
    grid.innerHTML = `<div class="item-row"><div class="item-row-body"><div class="empty-state"><div class="empty-state-icon"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg></div><h3>No requests found</h3><p>Try adjusting your filters</p></div></div></div>`;
    return;
  }
  grid.innerHTML = requests.map(req => {
    const user      = req.user || {};
    const type      = req.request_type || req.type || 'unknown';
    const plan      = user.plan || user.plan_name || 'None';
    const files     = req.files || [];
    const name      = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || '—';
    const firstName = user.first_name || '—';
    const lastName  = user.last_name  || '—';
    const phone     = user.phone || user.phone_number || '—';
    const company   = user.company_name || user.company || req.company_name || '—';
    const initials  = (name !== '—' ? name : (user.email||'?')).split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();

    const fileChips = files.map(f => {
      const fname  = f.filename || f.name || 'file.pdf';
      const sz     = fmtSize(f.size || 0);
      const fileId = f.file_id || f.id || '';
      return `<span class="file-chip" onclick="event.stopPropagation();downloadFileById(${req.id},'${fileId}','${fname}')" title="Download ${fname}">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        ${fname.length > 18 ? fname.slice(0,15)+'…' : fname}
        ${sz ? `<span class="file-size">${sz}</span>` : ''}
      </span>`;
    }).join('');

    return `<div class="item-row">
      <div class="item-row-body">
        <div class="item-info-header">
          <div class="recent-avatar" style="width:42px;height:42px;font-size:.84rem;border-radius:10px;flex-shrink:0">${initials}</div>
          <div style="flex:1;min-width:0">
            <div class="item-info-title">${name}</div>
            <div class="item-info-sub">${user.email||'—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">${typeChip(type)}${statusBadge(req.status)}</div>
        </div>
        <div class="item-info-grid">
          <div class="item-info-field">
            <span class="item-info-label">First Name</span>
            <span class="item-info-value strong">${firstName}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Last Name</span>
            <span class="item-info-value strong">${lastName}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Phone</span>
            <span class="item-info-value">${phone}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Company</span>
            <span class="item-info-value">${company}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Plan</span>
            <span class="item-info-value"><span class="plan-pill ${planClass(plan)}">${plan}</span></span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Request ID</span>
            <span class="item-info-value td-mono">#${req.id}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Submitted</span>
            <span class="item-info-value">${fmtDate(req.created_at)}</span>
          </div>
        </div>
        ${files.length ? `<div class="item-info-files">
          <div class="item-info-files-label">Attached Files (${files.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${fileChips}</div>
        </div>` : ''}
      </div>
      <div class="item-row-actions">
        <button class="act-btn act-btn-view" onclick="viewRequest(${req.id})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          View Details
        </button>
        ${req.status === 'pending' ? `
        <button class="act-btn act-btn-approve" onclick="approveRequest(${req.id})">
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
          Approve
        </button>
        <button class="act-btn act-btn-reject" onclick="openRejectModal(${req.id})">
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Reject
        </button>` : ''}
        ${files.length ? `<button class="act-btn act-btn-download" onclick="downloadAllFiles(${req.id})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download All (${files.length})
        </button>` : ''}
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" onclick="confirmDeleteRequest(${req.id})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
}

async function approveRequest(reqId) {
  const req = _requests.find(r => r.id === reqId);
  if (!req) return;
  try {
    await apiFetch(`/api/v1/admin/requests/${reqId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
    req.status = 'approved';
    filterRequests();
    updateRequestStats();
    renderDashboard();
    toast('Request approved successfully', 'success');
  } catch (e) {
    toast('Failed to approve request', 'error');
  }
}

function openRejectModal(reqId) {
  const req = _requests.find(r => r.id === reqId);
  document.getElementById('rejectReqId').value = reqId;
  document.getElementById('rejectReqReason').value = '';
  document.getElementById('rejectReqNotes').value = '';
  document.getElementById('rejectReqSubtitle').textContent =
    req ? `Request #${reqId} — ${req.user?.email || '—'}` : `Request #${reqId}`;
  openModal('rejectReqModal');
}

async function confirmRejectRequest() {
  const reqId = parseInt(document.getElementById('rejectReqId').value);
  const reason = document.getElementById('rejectReqReason').value.trim();
  const notes  = document.getElementById('rejectReqNotes').value.trim();
  const req = _requests.find(r => r.id === reqId);
  if (!req) return;
  try {
    await apiFetch(`/api/v1/admin/requests/${reqId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', rejection_reason: reason, admin_notes: notes }),
    });
    req.status = 'rejected';
    req.rejection_reason = reason;
    req.admin_notes = notes;
    closeModal('rejectReqModal');
    filterRequests();
    updateRequestStats();
    renderDashboard();
    toast('Request rejected', 'info');
  } catch (e) {
    toast('Failed to reject request', 'error');
  }
}

function viewRequest(reqId) {
  const req = _requests.find(r => r.id === reqId);
  if (!req) return;
  const user  = req.user || {};
  const type  = req.request_type || req.type || 'unknown';
  const files = req.files || [];
  const name  = user.full_name || [user.first_name,user.last_name].filter(Boolean).join(' ') || user.email || '—';

  document.getElementById('viewReqTitle').textContent = `Request #${req.id}`;
  document.getElementById('viewReqSubtitle').textContent = `${type === 'partnership' ? 'Operational Partnership' : 'Feasibility Study'} — ${fmtDate(req.created_at)}`;

  const fileCards = files.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${files.map(f => {
        const fname  = f.filename || f.name || 'file.pdf';
        const fsize  = fmtSize(f.size||0);
        const fdate  = fmtDate(f.uploaded_at||f.upload_date);
        const fileId = f.file_id || f.id || '';
        return `<div style="background:var(--bg2);border:1.5px solid var(--border);border-radius:9px;padding:10px 12px;display:flex;align-items:center;gap:9px;min-width:200px;flex:1">
          <div style="width:34px;height:34px;border-radius:8px;background:var(--red-dim);color:var(--red);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer" onclick="downloadFileById(${req.id},'${fileId}','${fname}')" title="Download ${fname}">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.81rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fname}</div>
            <div style="font-size:.72rem;color:var(--text-3)">${[fsize,fdate].filter(Boolean).join(' · ')}</div>
          </div>
          <button class="btn-icon download btn-xs" onclick="downloadFileById(${req.id},'${fileId}','${fname}')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>`;
      }).join('')}</div>`
    : '<p style="font-size:.83rem;color:var(--text-3)">No files attached to this request.</p>';

  const notesSection = req.admin_notes
    ? `<div style="margin-top:14px"><div class="detail-label" style="margin-bottom:5px">Admin Notes</div><div class="notes-box">${req.admin_notes}</div></div>` : '';
  const rejSection = req.rejection_reason
    ? `<div style="margin-top:10px"><div class="detail-label" style="margin-bottom:5px">Rejection Reason</div><div class="notes-box rejection-note">${req.rejection_reason}</div></div>` : '';

  document.getElementById('viewReqBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:18px">
      <div><div class="detail-label">User</div><div class="detail-value">${name}</div></div>
      <div><div class="detail-label">Email</div><div class="detail-value">${user.email||'—'}</div></div>
      <div><div class="detail-label">Plan</div><div>${'<span class="plan-pill '+planClass(user.plan||user.plan_name||'None')+'">'+(user.plan||user.plan_name||'None')+'</span>'}</div></div>
      <div><div class="detail-label">Status</div><div>${statusBadge(req.status)}</div></div>
      <div><div class="detail-label">Type</div><div>${typeChip(type)}</div></div>
      <div><div class="detail-label">Submitted</div><div class="detail-value">${fmtDate(req.created_at)}</div></div>
    </div>
    <div class="detail-label" style="margin-bottom:8px">Uploaded Files (${files.length})</div>
    ${fileCards}
    ${notesSection}${rejSection}`;

  const footer = document.getElementById('viewReqFooter');
  footer.innerHTML = `<button class="btn btn-ghost" onclick="closeModal('viewReqModal')">Close</button>`;
  if (req.status === 'pending') {
    footer.innerHTML += `
      <button class="btn btn-danger" onclick="closeModal('viewReqModal');openRejectModal(${req.id})">Reject</button>
      <button class="btn btn-green" onclick="closeModal('viewReqModal');approveRequest(${req.id})">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
        Approve
      </button>`;
  }
  openModal('viewReqModal');
}




function confirmDeleteRequest(reqId) {
  const req = _requests.find(r => r.id === reqId);
  document.getElementById('deleteReqDetail').textContent =
    req ? `#${reqId} — ${req.user?.email || '—'} (${req.request_type || req.type || 'unknown'})` : `#${reqId}`;
  document.getElementById('confirmDeleteReqBtn').onclick = () => deleteRequest(reqId);
  openModal('deleteReqModal');
}


async function deleteRequest(reqId) {
  try {
    await apiFetch(`/api/v1/admin/requests/${reqId}`, { method: 'DELETE' });
    _requests = _requests.filter(r => r.id !== reqId);
    closeModal('deleteReqModal');
    filterRequests();
    updateRequestStats();
    renderDashboard();
    toast('Request deleted', 'info');
  } catch (e) {
    toast('Failed to delete request', 'error');
  }
}

// ── PLANS ────────────────────────────────────────────────────────
// State
let _planDetailsTab = 'json';   // 'json' | 'order'

async function loadPlans(forceRefetch = false) {
  // 1. Show cached version instantly
  if (!forceRefetch) {
    const cachedRaw = localStorage.getItem('admin_plans_data');
    if (cachedRaw) {
      try {
        _plans = JSON.parse(cachedRaw);
        renderPlansAdmin(_plans);
        syncPlanCounters();
      } catch (_) {
        localStorage.removeItem('admin_plans_data');
        localStorage.removeItem('admin_plans_etag');
      }
    }
  }

  // 2. Validate with ETag
  try {
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (TOKEN()) reqHeaders['Authorization'] = `Bearer ${TOKEN()}`;
    const storedEtag = localStorage.getItem('admin_plans_etag');
    if (storedEtag && !forceRefetch) reqHeaders['If-None-Match'] = storedEtag;

    const res = await fetch(`${API}/api/v1/plans/`, { headers: reqHeaders });
    if (res.status === 304 && !forceRefetch) return;  // cache still fresh
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    _plans = Array.isArray(data) ? data : (data.items || data.results || data.plans || []);
    localStorage.setItem('admin_plans_data', JSON.stringify(_plans));
    const newEtag = res.headers.get('ETag');
    if (newEtag) localStorage.setItem('admin_plans_etag', newEtag);

    renderPlansAdmin(_plans);
    syncPlanCounters();
  } catch (e) {
    if (!_plans.length) {
      document.getElementById('plansAdminGrid').innerHTML = `<div style="color:var(--text-3);font-size:.84rem;padding:12px">Could not load plans.</div>`;
      toast('Could not load plans', 'error');
    }
  }
}

function syncPlanCounters() {
  const total       = _plans.length;
  const avgM        = total ? (_plans.reduce((s,p) => s + (p.price_monthly||0), 0) / total).toFixed(3) : '0.000';
  const avgY        = total ? (_plans.reduce((s,p) => s + (p.price_yearly||0),  0) / total).toFixed(3) : '0.000';
  const withDetails = _plans.filter(p => p.plan_details && Object.keys(p.plan_details).length > 0).length;
  document.getElementById('statPlans').textContent           = total;
  document.getElementById('plansCount').textContent          = `${total} plan${total!==1?'s':''}`;
  document.getElementById('planStatTotal').textContent       = total;
  document.getElementById('planStatAvgMonthly').textContent  = avgM;
  document.getElementById('planStatAvgYearly').textContent   = avgY;
  document.getElementById('planStatWithDetails').textContent = withDetails;
}

function renderPlansAdmin(plans) {
  const grid = document.getElementById('plansAdminGrid');
  if (!plans.length) {
    grid.innerHTML = `<div style="color:var(--text-3);font-size:.84rem;padding:12px">No plans configured.</div>`;
    return;
  }
  grid.innerHTML = plans.map(plan => {
    const d = plan.plan_details || {};
    // Render plan_details as a compact key/value list (up to 6 keys)
    const detailKeys = Object.keys(d).slice(0, 6);
    const detailItems = detailKeys.map(k =>
      `<li style="display:flex;justify-content:space-between;gap:8px;font-size:.75rem;padding:3px 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--text-3);font-weight:600;text-transform:capitalize">${k.replace(/_/g,' ')}</span>
        <span style="color:var(--text-2);font-family:'DM Mono',monospace;font-size:.72rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${JSON.stringify(d[k])}</span>
      </li>`
    ).join('');
    const moreKeys = Object.keys(d).length - detailKeys.length;

    return `<div class="plan-admin-card${plan.name==='Pro'?' featured':''}">
      <div class="plan-card-top">
        <div>
          <div class="plan-card-name">${plan.name}</div>
          <div class="plan-card-id">ID: ${plan.id}</div>
        </div>
        <span class="plan-pill ${planClass(plan.name)}">${plan.name}</span>
      </div>
      <div class="plan-card-body">
        <div class="plan-price-row">
          <div><div class="plan-price-label">Monthly</div><div class="plan-price-val">${Number(plan.price_monthly).toFixed(3)} <span>KWD</span></div></div>
          <div><div class="plan-price-label">Yearly</div><div class="plan-price-val">${Number(plan.price_yearly).toFixed(3)} <span>KWD</span></div></div>
        </div>
        ${detailItems ? `<ul style="list-style:none;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">${detailItems}${moreKeys>0?`<li style="font-size:.72rem;color:var(--text-3);padding-top:4px">+ ${moreKeys} more key${moreKeys!==1?'s':''}</li>`:''}</ul>` : ''}
      </div>
      <div class="plan-card-footer">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openEditPlanById(${plan.id})">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeletePlan(${plan.id},'${plan.name.replace(/'/g,"\\'")}')">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Plan Modal helpers ──────────────────────────────────────────
function _clearPlanForm() {
  ['editPlanId','editPlanName','editPlanMonthly','editPlanYearly','editPlanDetails'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['errPlanName','errPlanMonthly','errPlanDetails'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  switchPlanDetailsTab('json');
}

function openNewPlanModal() {
  _clearPlanForm();
  document.getElementById('editPlanModalTitle').textContent = 'New Plan';
  document.getElementById('editPlanModalSub').textContent   = 'Create a new pricing tier';
  document.getElementById('savePlanLabel').textContent      = 'Create Plan';
  openModal('editPlanModal');
}

function openEditPlanById(id) {
  const plan = _plans.find(p => String(p.id) === String(id));
  if (plan) openEditPlan(plan);
}

function openEditPlan(plan) {
  _clearPlanForm();
  document.getElementById('editPlanId').value       = plan.id;
  document.getElementById('editPlanModalTitle').textContent = `Edit — ${plan.name}`;
  document.getElementById('editPlanModalSub').textContent   = `Plan ID: ${plan.id}`;
  document.getElementById('savePlanLabel').textContent      = 'Save Changes';
  document.getElementById('editPlanName').value     = plan.name || '';
  document.getElementById('editPlanMonthly').value  = plan.price_monthly ?? '';
  document.getElementById('editPlanYearly').value   = plan.price_yearly  ?? '';
  if (plan.plan_details && Object.keys(plan.plan_details).length) {
    document.getElementById('editPlanDetails').value = JSON.stringify(plan.plan_details, null, 2);
  }
  openModal('editPlanModal');
}

// ── Plan Details Tab switcher ───────────────────────────────────
function switchPlanDetailsTab(tab) {
  _planDetailsTab = tab;
  const jsonPane  = document.getElementById('planDetailsJsonPane');
  const orderPane = document.getElementById('planDetailsOrderPane');
  const btnJson   = document.getElementById('detTabJson');
  const btnOrder  = document.getElementById('detTabOrder');

  if (tab === 'json') {
    jsonPane.style.display  = '';
    orderPane.style.display = 'none';
    btnJson.style.borderColor  = 'var(--accent)';  btnJson.style.color  = 'var(--accent)';
    btnOrder.style.borderColor = '';               btnOrder.style.color = '';
  } else {
    // parse current JSON → build order list
    const raw = document.getElementById('editPlanDetails').value.trim();
    let obj = {};
    try {
      if (raw) obj = JSON.parse(raw);
      document.getElementById('errPlanDetailsOrder').textContent = '';
    } catch {
      document.getElementById('errPlanDetailsOrder').textContent = 'Fix JSON syntax before reordering.';
      return;
    }
    jsonPane.style.display  = 'none';
    orderPane.style.display = '';
    btnJson.style.borderColor  = '';               btnJson.style.color  = '';
    btnOrder.style.borderColor = 'var(--accent)';  btnOrder.style.color = 'var(--accent)';
    _renderPlanOrderList(obj);
  }
}

function _renderPlanOrderList(obj) {
  const list = document.getElementById('planDetailsOrderList');
  const keys = Object.keys(obj);
  list._obj  = obj;
  list.innerHTML = !keys.length
    ? `<p style="font-size:.78rem;color:var(--text-3)">No keys in the JSON yet.</p>`
    : keys.map((k, i) => `
      <div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1.5px solid var(--border);border-radius:7px;padding:7px 10px" data-key="${k.replace(/"/g,'&quot;')}">
        <span style="font-size:.78rem;font-weight:600;color:var(--text);flex:1">${k}</span>
        <span style="font-size:.72rem;color:var(--text-3);font-family:'DM Mono',monospace;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${JSON.stringify(obj[k])}</span>
        <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
          <button onclick="movePlanKey(this,-1)" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:.65rem;line-height:1;padding:1px 4px;border-radius:3px" title="Up">▲</button>
          <button onclick="movePlanKey(this,1)"  style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:.65rem;line-height:1;padding:1px 4px;border-radius:3px" title="Down">▼</button>
        </div>
      </div>`).join('');
}

function movePlanKey(btn, dir) {
  const item  = btn.closest('[data-key]');
  const list  = item.closest('#planDetailsOrderList');
  const items = Array.from(list.children).filter(el => el.dataset.key);
  const idx   = items.indexOf(item);
  const next  = idx + dir;
  if (next < 0 || next >= items.length) return;
  dir === -1 ? list.insertBefore(item, items[next]) : list.insertBefore(items[next], item);
  _syncPlanOrderToJSON();
}

function _syncPlanOrderToJSON() {
  const list = document.getElementById('planDetailsOrderList');
  const obj  = list._obj || {};
  const keys = Array.from(list.querySelectorAll('[data-key]')).map(el => el.dataset.key);
  const reordered = {};
  keys.forEach(k => { if (k in obj) reordered[k] = obj[k]; });
  list._obj = reordered;
  document.getElementById('editPlanDetails').value = JSON.stringify(reordered, null, 2);
}

// ── Validation & Payload ────────────────────────────────────────
function _validatePlanForm() {
  let ok = true;
  const name = document.getElementById('editPlanName').value.trim();
  if (!name) {
    document.getElementById('errPlanName').textContent = 'Name is required';
    ok = false;
  } else { document.getElementById('errPlanName').textContent = ''; }

  const monthly = document.getElementById('editPlanMonthly').value;
  if (monthly === '' || isNaN(monthly) || Number(monthly) < 0) {
    document.getElementById('errPlanMonthly').textContent = 'Enter a valid monthly price';
    ok = false;
  } else { document.getElementById('errPlanMonthly').textContent = ''; }

  const detRaw = document.getElementById('editPlanDetails').value.trim();
  if (detRaw) {
    try { JSON.parse(detRaw); document.getElementById('errPlanDetails').textContent = ''; }
    catch { document.getElementById('errPlanDetails').textContent = 'Invalid JSON'; ok = false; }
  }
  return ok;
}

function _buildPlanPayload() {
  const detRaw = document.getElementById('editPlanDetails').value.trim();
  return {
    name:          document.getElementById('editPlanName').value.trim(),
    price_monthly: parseFloat(document.getElementById('editPlanMonthly').value) || 0,
    price_yearly:  parseFloat(document.getElementById('editPlanYearly').value)  || 0,
    plan_details:  detRaw ? JSON.parse(detRaw) : {},
  };
}

// ── Save (Create or Edit) ───────────────────────────────────────
async function savePlan() {
  if (!_validatePlanForm()) return;
  const btn   = document.getElementById('savePlanBtn');
  const label = document.getElementById('savePlanLabel');
  btn.disabled = true;
  label.innerHTML = '<span class="pagination-spinner" style="display:inline-block;width:13px;height:13px;border:2px solid rgba(0,0,0,.2);border-top-color:currentColor;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:5px"></span>Saving…';

  try {
    const id      = document.getElementById('editPlanId').value;
    const payload = _buildPlanPayload();

    let saved;
    if (id) {
      // PATCH /api/v1/admin/plans/{plan_id}
      saved = await apiFetch(`/api/v1/admin/plans/${id}`, { method:'PATCH', body: JSON.stringify(payload) });
      const idx = _plans.findIndex(p => String(p.id) === String(id));
      if (idx >= 0) _plans[idx] = saved;
      toast(`Plan "${saved.name}" updated`, 'success');
    } else {
      // POST /api/v1/admin/plans
      saved = await apiFetch('/api/v1/admin/plans', { method:'POST', body: JSON.stringify(payload) });
      _plans.push(saved);
      toast(`Plan "${saved.name}" created`, 'success');
    }

    // Refresh plans specifically
    await loadPlans(true);
    closeModal('editPlanModal');
  } catch (e) {
    toast(`Failed to save plan: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = document.getElementById('editPlanId').value ? 'Save Changes' : 'Create Plan';
  }
}

// ── Delete ──────────────────────────────────────────────────────
function confirmDeletePlan(planId, planName) {
  document.getElementById('deletePlanDetail').textContent = `${planName} (ID: ${planId})`;
  document.getElementById('confirmDeletePlanBtn').onclick = () => deletePlan(planId, planName);
  openModal('deletePlanModal');
}

async function deletePlan(planId, planName) {
  const btn   = document.getElementById('confirmDeletePlanBtn');
  const label = document.getElementById('deletePlanLabel');
  btn.disabled = true;
  label.innerHTML = '<span class="pagination-spinner" style="display:inline-block;width:13px;height:13px;border:2px solid rgba(239,68,68,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:5px"></span>Deleting…';

  try {
    // DELETE /api/v1/admin/plans/{plan_id}
    await apiFetch(`/api/v1/admin/plans/${planId}`, { method:'DELETE' });
    _plans = _plans.filter(p => p.id !== planId);
    await loadPlans(true);
    closeModal('deletePlanModal');
    toast(`Plan "${planName}" deleted`, 'info');
  } catch (e) {
    toast(`Failed to delete plan: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Delete Plan';
  }
}



// ── REVIEWS ──────────────────────────────────────────────────────
async function loadReviews(page) {
  if (_revLoading) return;
  _revLoading = true;
  _revPage = page || 1;
  setRevPaginationLoading(true);
  try {
    const data = await apiFetch(`/api/v1/admin/reviews?page=${_revPage}`);
    _reviews = data && Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : (data.results || data.reviews || []));
    _revHasMore = data && data.has_next !== undefined ? !!data.has_next : (_reviews.length === PAGE_LIMIT);
    _totalReviews = data && data.total !== undefined ? data.total : _reviews.length;
  } catch (e) {
    _reviews = [];
    _totalReviews = 0;
  }
  renderReviews(_reviews);
  updateReviewStats();
  _revLoading = false;
  setRevPaginationLoading(false);
  updateRevPagination();
}

function updateRevPagination() {
  document.getElementById('revPageNum').textContent = _revPage;
  document.getElementById('revPaginationInfo').textContent = `Page ${_revPage} · ${_reviews.length} of ${_totalReviews} shown`;
  document.getElementById('revPrevBtn').disabled = _revPage <= 1;
  document.getElementById('revNextBtn').disabled = !_revHasMore;
}

function setRevPaginationLoading(on) {
  const info = document.getElementById('revPaginationInfo');
  if (on) info.innerHTML = '<span class="pagination-loading"><span class="pagination-spinner"></span>Loading…</span>';
}

async function changeRevPage(page) {
  if (page < 1 || _revLoading) return;
  if (page > _revPage && !_revHasMore) return;
  await loadReviews(page);
  document.getElementById('page-reviews').scrollIntoView({ behavior:'smooth', block:'start' });
}

function updateReviewStats() {
  const displayCount = _reviews.length;
  const total    = _totalReviews !== undefined ? _totalReviews : displayCount;
  const pending  = _reviews.filter(r => (r.status || (r.is_published ? 'accepted' : 'pending')) === 'pending').length;
  const accepted = _reviews.filter(r => (r.status || (r.is_published ? 'accepted' : 'pending')) === 'accepted').length;
  document.getElementById('revStatTotal').textContent    = total;
  document.getElementById('revStatPending').textContent  = pending;
  document.getElementById('revStatAccepted').textContent = accepted;
  document.getElementById('revStatPage').textContent     = displayCount;
  document.getElementById('revCount').textContent = `${total} review${total!==1?'s':''}`;
  document.getElementById('sidebarReviewsCount').textContent = pending || '—';
}

function starRating(rating) {
  const r = Math.round(rating || 0);
  return Array.from({length:5}, (_,i) =>
    `<svg class="review-star-${i < r ? 'filled':'empty'}" fill="${i < r ? 'currentColor':'none'}" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
  ).join('');
}

function renderReviews(reviews) {
  const grid = document.getElementById('reviewsCardsGrid');
  if (!reviews.length) {
    grid.innerHTML = `<div class="item-row"><div class="item-row-body"><div class="empty-state"><div class="empty-state-icon"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3>No reviews found</h3><p>Try adjusting your filters</p></div></div></div>`;
    return;
  }
  grid.innerHTML = reviews.map(rev => {
    const user       = rev.user || {};
    const name       = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '—';
    const email      = user.email || '—';
    const status     = rev.status || (rev.is_published ? 'accepted' : 'pending');
    const rating     = rev.stars || rev.rating || 0;
    const reviewText = rev.review_text || rev.text || rev.comment || rev.body || '—';
    const initials   = name !== '—' ? name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() : (email[0]||'?').toUpperCase();
    const badgeHtml  = status === 'accepted'
      ? '<span class="badge badge-green"><span class="badge-dot"></span>Accepted</span>'
      : '<span class="badge badge-yellow"><span class="badge-dot"></span>Pending</span>';
    return `<div class="item-row" id="rev-row-${rev.id}">
      <div class="item-row-body">
        <div class="item-info-header">
          <div class="recent-avatar" style="width:42px;height:42px;font-size:.84rem;border-radius:10px;flex-shrink:0">${initials}</div>
          <div style="flex:1;min-width:0">
            <div class="item-info-title">${name}</div>
            <div class="item-info-sub">${email}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="review-stars">${starRating(rating)}<span style="margin-left:5px;font-size:.8rem;font-weight:600;color:var(--text-2)">${rating}/5</span></div>
            ${badgeHtml}
          </div>
        </div>
        <div class="item-info-grid" style="margin-bottom:10px">
          <div class="item-info-field">
            <span class="item-info-label">Review ID</span>
            <span class="item-info-value td-mono">#${rev.id}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Submitted</span>
            <span class="item-info-value">${fmtDate(rev.created_at)}</span>
          </div>
        </div>
        <div class="item-review-text">${reviewText}</div>
      </div>
      <div class="item-row-actions">
        ${status !== 'accepted' ? `<button class="act-btn act-btn-accept" onclick="acceptReview(${rev.id})">
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
          Accept Review
        </button>` : '<span style="font-size:.82rem;color:var(--green);font-weight:600;display:flex;align-items:center;gap:5px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>Published</span>'}
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" onclick="confirmDeleteReview(${rev.id})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete Review
        </button>
      </div>
    </div>`;
  }).join('');
}

let _revSearchTimer = null;
function filterReviews() {
  clearTimeout(_revSearchTimer);
  _revSearchTimer = setTimeout(_filterReviewsNow, 250);
}

function _filterReviewsNow() {
  const q      = (document.getElementById('revSearch').value || '').toLowerCase();
  const status = document.getElementById('revStatusFilter').value;
  const rating = document.getElementById('revRatingFilter').value;
  const sort   = document.getElementById('revSortFilter').value;

  let filtered = _reviews.filter(r => {
    const user = r.user || {};
    const matchQ = !q ||
      (user.email||'').toLowerCase().includes(q) ||
      ((user.first_name||'') + ' ' + (user.last_name||'')).toLowerCase().includes(q) ||
      (r.review_text||r.text||r.comment||r.body||'').toLowerCase().includes(q) ||
      String(r.id||'').includes(q);
    const matchStatus = !status || (r.status || (r.is_published ? 'accepted' : 'pending')) === status;
    const matchRating = !rating || String(r.stars||r.rating||0) === rating;
    return matchQ && matchStatus && matchRating;
  });

  filtered.sort((a, b) => {
    const da = new Date(a.created_at||0), db = new Date(b.created_at||0);
    return sort === 'oldest' ? da - db : db - da;
  });

  document.getElementById('revCount').textContent = `${filtered.length} review${filtered.length!==1?'s':''}`;
  renderReviews(filtered);
}

async function acceptReview(revId) {
  try {
    await apiFetch(`/api/v1/admin/reviews/${revId}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ is_published: true }),
    });
    const idx = _reviews.findIndex(r => r.id === revId);
    if (idx >= 0) {
      _reviews[idx] = { ..._reviews[idx], is_published: true, status: 'accepted' };
      // Re-render the full cards grid (lightweight at page size)
      filterReviews();
    }
    updateReviewStats();
    toast('Review accepted and published', 'success');
  } catch (e) {
    toast('Failed to accept review', 'error');
  }
}

function confirmDeleteReview(revId) {
  const rev  = _reviews.find(r => r.id === revId);
  const text = rev ? (rev.review_text||rev.text||rev.comment||rev.body||'').slice(0, 60) : `#${revId}`;
  document.getElementById('deleteRevDetail').textContent = `#${revId} — "${text}${text.length >= 60 ? '…' : ''}"`;
  document.getElementById('confirmDeleteRevBtn').onclick = () => deleteReview(revId);
  openModal('deleteRevModal');
}

async function deleteReview(revId) {
  try {
    await apiFetch(`/api/v1/admin/reviews/${revId}`, { method: 'DELETE' });
    _reviews = _reviews.filter(r => r.id !== revId);
    // Remove row immediately with a fade
    const row = document.getElementById(`rev-row-${revId}`);
    renderReviews(_reviews);
    updateReviewStats();
    closeModal('deleteRevModal');
    toast('Review deleted', 'info');
  } catch (e) {
    toast('Failed to delete review', 'error');
  }
}

// ── DASHBOARD ────────────────────────────────────────────────────
function renderDashboard() {
  // Plan distribution — SVG Donut Chart
  let total = 0;
  const entries = _planDistributionData.map(item => {
    const name = item.plan_name || item.plan || item.name || 'None';
    const count = item.count || item.total || item.users || 0;
    total += count;
    return [name, count];
  }).sort((a,b)=>b[1]-a[1]);

  const distEl = document.getElementById('planDistribution');

  if (!entries.length || total === 0) {
    distEl.innerHTML = '<p style="color:var(--text-3);font-size:.82rem;padding:20px 0;text-align:center">No user data yet</p>';
  } else {
    const DASHBOARD_COLORS = ['#8b5cf6', '#3b82f6', '#d4af37', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899', '#14b8a6', '#6366f1'];
    function getColor(name) {
      if (name.toLowerCase() === 'none') return '#d1d5db';
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      return DASHBOARD_COLORS[Math.abs(hash) % DASHBOARD_COLORS.length];
    }

    // Build SVG donut
    const R = 70, CX = 90, CY = 80, INNER_R = 48;
    let startAngle = -Math.PI / 2;
    const slices = entries.map(([name, count]) => {
      const angle = (count / total) * 2 * Math.PI;
      const x1 = CX + R * Math.cos(startAngle);
      const y1 = CY + R * Math.sin(startAngle);
      startAngle += angle;
      const x2 = CX + R * Math.cos(startAngle);
      const y2 = CY + R * Math.sin(startAngle);
      const large = angle > Math.PI ? 1 : 0;
      const color = getColor(name);
      const pct = Math.round(count / total * 100);
      const midA = startAngle - angle / 2;
      return { name, count, pct, x1, y1, x2, y2, large, color, midA };
    });

    const labelSlices = slices.filter(s => s.pct >= 8);
    const svgLabels = labelSlices.map(s => {
      const lx = CX + (R * 0.78) * Math.cos(s.midA);
      const ly = CY + (R * 0.78) * Math.sin(s.midA);
      return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
        fill="#fff" font-size="9" font-weight="700" font-family="DM Sans,sans-serif" style="pointer-events:none">${s.pct}%</text>`;
    }).join('');

    const svgPaths = slices.map(s =>
      entries.length === 1
        ? `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${s.color}"/>`
        : `<path d="M${CX},${CY} L${s.x1.toFixed(2)},${s.y1.toFixed(2)} A${R},${R} 0 ${s.large},1 ${s.x2.toFixed(2)},${s.y2.toFixed(2)} Z"
             fill="${s.color}" stroke="var(--white)" stroke-width="2">
             <title>${s.name}: ${s.count} user${s.count!==1?'s':''} (${s.pct}%)</title>
           </path>`
    ).join('');

    const legend = slices.map(s =>
      `<div style="display:flex;align-items:center;gap:7px;padding:4px 0">
        <span style="width:9px;height:9px;border-radius:50%;background:${s.color};flex-shrink:0;display:inline-block"></span>
        <span style="font-size:.78rem;font-weight:600;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</span>
        <span style="font-size:.75rem;color:var(--text-3);font-weight:500;flex-shrink:0">${s.count}</span>
        <span style="font-size:.72rem;color:var(--text-3);flex-shrink:0;min-width:32px;text-align:right">${s.pct}%</span>
      </div>`
    ).join('');

    distEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;width:100%">
        <svg width="180" height="160" viewBox="0 0 180 160" style="flex-shrink:0;overflow:visible;display:block">
          ${svgPaths}
          <circle cx="${CX}" cy="${CY}" r="${INNER_R}" fill="var(--white)" />
          ${svgLabels}
          <text x="${CX}" y="${CY-2}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="800" fill="var(--text)">${total}</text>
          <text x="${CX}" y="${CY+12}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="700" fill="var(--text-3)">USERS</text>
        </svg>
        <div style="width:100%">${legend}</div>
      </div>`;
  }

  // Recent signups
  const sorted = [..._users].sort((a,b) => new Date(b.date_joined||b.created_at||0)-new Date(a.date_joined||a.created_at||0)).slice(0,5);
  const recentEl = document.getElementById('recentSignups');
  recentEl.innerHTML = sorted.length
    ? sorted.map(u => {
        const n = [u.first_name,u.last_name].filter(Boolean).join(' ') || (u.email||'?');
        const initials = n.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
        const plan = u.plan_name||u.plan||'None';
        return `<div class="recent-row">
          <div class="recent-avatar">${initials}</div>
          <div class="recent-info"><div class="recent-name">${u.email||n}</div><div class="recent-time">${fmtDate(u.date_joined||u.created_at)}</div></div>
          <span class="plan-pill ${planClass(plan)}">${plan}</span>
        </div>`;
      }).join('')
    : '<p style="color:var(--text-3);font-size:.82rem">No users yet</p>';

  // Pending requests widget
  const pending = _requests.filter(r => r.status === 'pending').slice(0, 5);
  const pendEl = document.getElementById('dashPendingList');
  pendEl.innerHTML = pending.length
    ? pending.map(req => {
        const user = req.user || {};
        const type = req.request_type || req.type || 'unknown';
        const name = user.email || user.full_name || `User #${user.id}`;
        return `<div class="pending-req-row">
          <div class="pending-req-type">
            <div class="pending-req-email">${name}</div>
            <div class="pending-req-meta">${type==='partnership'?'Operational Partnership':'Feasibility Study'} · ${fmtDate(req.created_at)}</div>
          </div>
          <div class="pending-req-actions">
            <button class="btn-icon btn-xs" onclick="showPage('requests');setTimeout(()=>viewRequest(${req.id}),150)" title="View request details">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </button>
          </div>
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:24px 0;color:var(--text-3)">
        <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 8px;display:block"><polyline points="20,6 9,17 4,12"/></svg>
        <p style="font-size:.82rem">All caught up — no pending requests</p>
      </div>`;

}

// ── Search global ────────────────────────────────────────────────
function handleGlobalSearch(q) {
  const query = (q || '').trim();
  if (_currentPage === 'users')    { document.getElementById('userSearch').value = query; filterUsers(query); }
  if (_currentPage === 'requests') { document.getElementById('reqSearch').value  = query; filterRequests(); }
}

// ── Refresh ──────────────────────────────────────────────────────
async function refreshAll() {
  toast('Refreshing data…', 'info');
  await Promise.allSettled([loadUsers(_userPage), loadPlans(true), loadRequests(_reqPage), loadReviews(_revPage), loadStorageUsage(), loadPlanDistribution()]);
  renderDashboard();
}

// ── Settings ─────────────────────────────────────────────────────
function saveSettings() {
  API = document.getElementById('settingsApiBase').value.trim().replace(/\/$/, '');
  localStorage.setItem('badia_admin_api', API);
  toast('Settings saved', 'success');
}

// ── Logout ───────────────────────────────────────────────────────
function handleLogout() {
  if (confirm('Log out of the admin dashboard?')) {
    localStorage.removeItem('access_token');
    window.location.href = 'Signin.html';
  }
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('settingsApiBase').value = API;

  // Restore section from URL hash (e.g. admin.html#plans survives F5)
  const hash = (location.hash || '').replace('#', '').trim();
  const validPages = ['dashboard','requests','users','plans','reviews','settings'];
  if (hash && validPages.includes(hash)) {
    showPage(hash);
  }

  // Keyboard: Esc closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
    }
    // Ctrl/Cmd + Enter saves plan modal if open
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.getElementById('editPlanModal').classList.contains('open')) savePlan();
    }
  });

  // Init
  loadAll();
});