// https://badia-backend.onrender.com

let API = localStorage.getItem('badia_admin_api') || 'https://badia-backend.onrender.com';
const TOKEN = () => localStorage.getItem('access_token') || '';

// ── State ───────────────────────────────────────────────────────
let _users    = [];
let _plans    = [];
let _requests = [];
let _reviews  = [];
let _payments = [];
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
  const method = (opts.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (TOKEN()) headers['Authorization'] = `Bearer ${TOKEN()}`;
  
  const cacheKeyData = `api_cache_data_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const cacheKeyEtag = `api_cache_etag_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  if (isGet) {
    const cachedEtag = localStorage.getItem(cacheKeyEtag);
    if (cachedEtag) {
      headers['If-None-Match'] = cachedEtag;
    }
  }

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
        setTimeout(() => { window.location.href = 'index.html?open_signin=true'; }, 1500);
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

  if (isGet && res.status === 304) {
    const cachedData = localStorage.getItem(cacheKeyData);
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (_) {
        // Fallback to reload if JSON parse error
      }
    }
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const data = await res.json();
  
  if (isGet) {
    const newEtag = res.headers.get('ETag');
    if (newEtag) {
      localStorage.setItem(cacheKeyEtag, newEtag);
      localStorage.setItem(cacheKeyData, JSON.stringify(data));
    }
  }
  
  return data;
}

// ── Page Navigation (with hash persistence) ────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${id}`)?.classList.add('active');
  document.querySelector(`[data-page="${id}"]`)?.classList.add('active');
  _currentPage = id;
  const titles = { dashboard:'Dashboard', requests:'Service Requests', users:'Users', plans:'Pricing Plans', reviews:'Reviews', payments:'Payments', settings:'Settings' };
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

function closeModal(id) { 
  document.getElementById(id).classList.remove('open'); 
  // Ensure the large plan modal resets cleanly every time it is closed
  if (id === 'editPlanModal') {
    _clearPlanForm();
  }
}

function confirmAction(title, subtitle, onConfirm) {
  document.getElementById('genericConfirmTitle').textContent = title;
  document.getElementById('genericConfirmSubtitle').textContent = subtitle;
  document.getElementById('genericConfirmBtn').onclick = () => {
    closeModal('genericConfirmModal');
    if (onConfirm) onConfirm();
  };
  openModal('genericConfirmModal');
}

// Clear all features and inputs
function confirmClearAllPlanForm() {
  confirmAction('Clear all data?', 'This will remove the plan name, prices, and all features.', () => {
    _clearPlanForm(); 
    _saveDraft();
  });
}

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
    ? '<span class="type-chip type-partnership"><i class="fas fa-handshake" style="font-size:10px; margin-right:4px;"></i>Partnership</span>'
    : '<span class="type-chip type-feasibility"><i class="fas fa-file-alt" style="font-size:10px; margin-right:4px;"></i>Feasibility</span>';
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

async function loadEmailsThisMonth() {
  try {
    const data = await apiFetch('/api/v1/admin/emails/sent-this-month');

    const thisMonth  = data.monthly_count ?? 0;
    const thisDay    = data.daily_count   ?? 0;
    const monthLimit = data.month_limit   ?? null;
    const dayLimit   = data.day_limit     ?? null;

    document.getElementById('statEmailsVal').textContent = thisMonth.toLocaleString();

    // Month stats (e.g. "120 / 3,000 (4%)")
    const monthPctVal = monthLimit ? Math.min((thisMonth / monthLimit) * 100, 100) : (thisMonth > 0 ? 100 : 0);
    const monthPctText = monthLimit ? `${thisMonth.toLocaleString()} / ${monthLimit.toLocaleString()} (${Math.round(monthPctVal)}%)` : thisMonth.toLocaleString();
    const elMonthPct = document.getElementById('statEmailMonthPct');
    if (elMonthPct) elMonthPct.textContent = monthPctText;

    const monthBar = document.getElementById('statEmailMonthBar');
    if (monthBar) {
      monthBar.style.width = `${monthPctVal}%`;
      monthBar.className = 'storage-bar-fill' + (monthLimit && monthPctVal >= 90 ? ' danger' : monthLimit && monthPctVal >= 70 ? ' warn' : '');
    }

    // Daily stats (e.g. "5 / 300 (2%)")
    const dayPctVal = dayLimit ? Math.min((thisDay / dayLimit) * 100, 100) : (thisDay > 0 ? 100 : 0);
    const dayPctText = dayLimit ? `${thisDay.toLocaleString()} / ${dayLimit.toLocaleString()} (${Math.round(dayPctVal)}%)` : thisDay.toLocaleString();
    const elDayPct = document.getElementById('statEmailDayPct');
    if (elDayPct) elDayPct.textContent = dayPctText;

    const dayBar = document.getElementById('statEmailDayBar');
    if (dayBar) {
      dayBar.style.width = `${dayPctVal}%`;
      dayBar.className = 'storage-bar-fill' + (dayLimit && dayPctVal >= 90 ? ' danger' : dayLimit && dayPctVal >= 70 ? ' warn' : '');
    }

  } catch (e) {
    document.getElementById('statEmailsVal').textContent = '—';
    const elMonthPct = document.getElementById('statEmailMonthPct');
    if (elMonthPct) elMonthPct.textContent = 'Unavailable';
    const elDayPct = document.getElementById('statEmailDayPct');
    if (elDayPct) elDayPct.textContent = 'Unavailable';
  }
}

async function loadAll() {
  await Promise.allSettled([loadUsers(1), loadPlans(), loadRequests(1), loadReviews(1), loadStorageUsage(), loadPlanDistribution(), loadEmailsThisMonth(), loadPaymentsTelemetry()]);
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
  // Active Plans stat is now populated by paid_payments from the payments telemetry
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
    grid.innerHTML = `<div class="item-row"><div class="item-row-body"><div class="empty-state"><div class="empty-state-icon"><i class="fas fa-users" style="font-size:2rem;color:var(--text-muted)"></i></div><h3>No users found</h3><p>Try adjusting your search or filters</p></div></div></div>`;
    return;
  }
  grid.innerHTML = users.map(u => {
    const name    = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '—';
    const email   = u.email || '—';
    const phone   = u.phone || u.phone_number || '—';
    const userPlanObj = _plans.find(p => p.id === (u.current_plan_id || u.plan_id));
    const plan    = userPlanObj ? userPlanObj.name : (u.plan_name || u.plan || 'None');
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
            <span class="item-info-value">${plan}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Joined</span>
            <span class="item-info-value">${joined}</span>
          </div>
        </div>
      </div>
      <div class="item-row-actions">
        <button class="act-btn act-btn-edit" onclick="openEditUserById(${uid})">
          <i class="fas fa-user-edit" style="margin-right:4px;"></i>
          Edit User
        </button>
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" onclick="confirmDelete(${uid},'${email}')">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
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
      const result = await apiFetch(`/api/v1/admin/user?email=${encodeURIComponent(query)}`);
      pool = result ? [result] : [];
    } catch (e) {
      pool = [];
    }
  } else if (query && /^\d+$/.test(query)) {
    try {
      const result = await apiFetch(`/api/v1/admin/user?user_id=${encodeURIComponent(query)}`);
      pool = result ? [result] : [];
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
  document.getElementById('editCompanyName').value = user.company_name || '';
  document.getElementById('editEmail').value  = user.email || '';
  document.getElementById('editPhone').value  = user.phone || user.phone_number || '';
  document.getElementById('editPassword').value = '';
  document.getElementById('editEmailVerified').checked = !!user.is_email_verified;

  document.getElementById('editStatus').value = user.is_active === false ? 'inactive' : 'active';
  document.getElementById('editUserSubtitle').textContent = user.email || `User #${user.id}`;
  const sel = document.getElementById('editPlan');
  sel.innerHTML = `<option value="">No Plan</option>` +
    _plans.map(p => `<option value="${p.id}" ${(user.current_plan_id || user.plan_id)===p.id?'selected':''}>${p.name}</option>`).join('');
  openModal('editUserModal');
}

async function saveUser() {
  const id = document.getElementById('editUserId').value;
  const userObj = _users.find(u => String(u.id||u.user_id) === String(id));
  const targetEmail = userObj ? userObj.email : document.getElementById('editEmail').value;
  
  const payload = {
    first_name: document.getElementById('editFirstName').value || null,
    last_name:  document.getElementById('editLastName').value || null,
    company_name: document.getElementById('editCompanyName').value || null,
    email:      document.getElementById('editEmail').value || null,
    phone:      document.getElementById('editPhone').value || null,
    is_email_verified: document.getElementById('editEmailVerified').checked,
    is_active:  document.getElementById('editStatus').value === 'active',
    current_plan_id: document.getElementById('editPlan').value ? parseInt(document.getElementById('editPlan').value) : null,
  };

  const pwd = document.getElementById('editPassword').value;
  if (pwd) payload.password_hash = pwd;

  try {
    await apiFetch(`/api/v1/admin/users/${encodeURIComponent(targetEmail)}`, {
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
  confirmAction('Delete User?', `Are you sure you want to delete user ${email}?`, async () => {
    await deleteUser(userId);
  });
}

async function deleteUser(userId) {
  const user = _users.find(u => String(u.id||u.user_id) === String(userId));
  const email = user?.email;
  try {
    await apiFetch(`/api/v1/admin/users/${encodeURIComponent(email || userId)}`, { method: 'DELETE' });
    _users = _users.filter(u => String(u.id||u.user_id) !== String(userId));
    renderUsersTable(_users);
    updateUserCount();
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
    _requests = _requests.map(r => ({ ...r, id: r.request_id || r.id }));
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
    grid.innerHTML = `<div class="item-row"><div class="item-row-body"><div class="empty-state"><div class="empty-state-icon"><i class="fas fa-clipboard-list" style="font-size:2rem;color:var(--text-muted)"></i></div><h3>No requests found</h3><p>Try adjusting your filters</p></div></div></div>`;
    return;
  }
  grid.innerHTML = requests.map(req => {
    const user      = req.user || {};
    const type      = req.request_type || req.type || 'unknown';
    const fullUser = _users.find(u => u.id === user.id) || user;
    const userPlanObj = _plans.find(p => p.id === (fullUser.current_plan_id || fullUser.plan_id));
    const plan      = userPlanObj ? userPlanObj.name : (user.plan || user.plan_name || 'None');
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
        <i class="fas fa-paperclip" style="margin-right:4px;"></i>
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
            <span class="item-info-value">${plan}</span>
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
          <i class="fas fa-eye" style="margin-right:4px;"></i>
          View Details
        </button>
        ${req.status !== 'approved' ? `
        <button class="act-btn act-btn-approve" onclick="approveRequest(${req.id})">
          <i class="fas fa-check" style="margin-right:4px;"></i>
          ${req.status === 'rejected' ? 'Re-Approve' : 'Approve'}
        </button>` : ''}
        ${req.status !== 'rejected' ? `
        <button class="act-btn act-btn-reject" onclick="openRejectModal(${req.id})">
          <i class="fas fa-ban" style="margin-right:4px;"></i>
          ${req.status === 'approved' ? 'Re-Reject' : 'Reject'}
        </button>` : ''}
        ${req.status !== 'pending' ? `
        <button class="act-btn act-btn-pending" onclick="setPendingRequest(${req.id})">
          <i class="fas fa-clock" style="margin-right:4px;"></i>
          Set Pending
        </button>` : ''}
        ${files.length ? `<button class="act-btn act-btn-download" onclick="downloadAllFiles(${req.id})">
          <i class="fas fa-download" style="margin-right:4px;"></i>
          Download All (${files.length})
        </button>` : ''}
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" onclick="confirmDeleteRequest(${req.id})">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
}

async function approveRequest(reqId) {
  confirmAction('Approve Request?', 'This action will send an approval email to the user. Are you sure you want to proceed?', async () => {
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
  });
}

async function setPendingRequest(reqId) {
  confirmAction('Set Pending?', 'This action will reset the request status to pending.', async () => {
    const req = _requests.find(r => r.id === reqId);
    if (!req) return;
    try {
      await apiFetch(`/api/v1/admin/requests/${reqId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' }),
      });
      req.status = 'pending';
      req.rejection_reason = null;
      req.admin_notes = null;
      filterRequests();
      updateRequestStats();
      renderDashboard();
      toast('Request set back to pending', 'info');
    } catch (e) {
      toast('Failed to update request status', 'error');
    }
  });
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
  confirmAction('Reject Request?', 'This action will send a rejection email to the user. Are you sure you want to proceed?', async () => {
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
  });
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
            <i class="fas fa-file-pdf"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.81rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fname}</div>
            <div style="font-size:.72rem;color:var(--text-3)">${[fsize,fdate].filter(Boolean).join(' · ')}</div>
          </div>
          <button class="btn-icon download btn-xs" onclick="downloadFileById(${req.id},'${fileId}','${fname}')">
            <i class="fas fa-download"></i>
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
  
      <div><div class="detail-label">Status</div><div>${statusBadge(req.status)}</div></div>
      <div><div class="detail-label">Type</div><div>${typeChip(type)}</div></div>
      <div><div class="detail-label">Submitted</div><div class="detail-value">${fmtDate(req.created_at)}</div></div>
    </div>
    <div class="detail-label" style="margin-bottom:8px">Uploaded Files (${files.length})</div>
    ${fileCards}
    ${notesSection}${rejSection}`;

  const footer = document.getElementById('viewReqFooter');
  footer.innerHTML = `<button class="btn btn-ghost" onclick="closeModal('viewReqModal')">Close</button>`;

  if (req.status !== 'approved') {
    footer.innerHTML += `
      <button class="btn btn-green" onclick="closeModal('viewReqModal');approveRequest(${req.id})">
        <i class="fas fa-check" style="margin-right:4px;"></i>
        ${req.status === 'rejected' ? 'Re-Approve' : 'Approve'}
      </button>`;
  }
  if (req.status !== 'rejected') {
    footer.innerHTML += `
      <button class="btn btn-danger" onclick="closeModal('viewReqModal');openRejectModal(${req.id})">
        ${req.status === 'approved' ? 'Re-Reject' : 'Reject'}
      </button>`;
  }
  if (req.status !== 'pending') {
    footer.innerHTML += `
      <button class="btn btn-ghost" onclick="closeModal('viewReqModal');setPendingRequest(${req.id})">
        <i class="fas fa-clock" style="margin-right:4px;"></i>
        Set Pending
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
let _currentFeatures = [];   // [{ key, en, ar, enabled }]
let _isCreateMode    = false; // true = New Plan modal, false = Edit Plan modal
 
// ── Data Loading ────────────────────────────────────────────────
async function loadPlans(forceRefetch = false) {
  // 1. Show cached version instantly
  if (!forceRefetch) {
    const cachedRaw = localStorage.getItem('admin_plans_data');
    if (cachedRaw) {
      try {
        _plans = JSON.parse(cachedRaw);
        renderPlansAdmin(_plans);
        syncPlanCounters();
        populatePlanDropdown();
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
    populatePlanDropdown();
  } catch (e) {
    if (!_plans.length) {
      document.getElementById('plansAdminGrid').innerHTML =
        `<div style="color:var(--text-3);font-size:.84rem;padding:12px">Could not load plans.</div>`;
      toast('Could not load plans', 'error');
    }
  }
}
 
function syncPlanCounters() {
  const total       = _plans.length;
  const withDetails = _plans.filter(p => {
    const d = p.plan_details;
    if (Array.isArray(d)) return d.length > 0;
    return d && Object.keys(d).length > 0;
  }).length;
  const elPlans = document.getElementById('statPlans');
  if (elPlans) elPlans.textContent = total;
  document.getElementById('plansCount').textContent          = `${total} plan${total !== 1 ? 's' : ''}`;
  document.getElementById('planStatTotal').textContent       = total;
  document.getElementById('planStatWithDetails').textContent = withDetails;
}
 
// ── Plan Card Rendering ─────────────────────────────────────────
function renderPlansAdmin(plans) {
  const grid = document.getElementById('plansAdminGrid');
  if (!plans.length) {
    grid.innerHTML = `<div style="color:var(--text-3);font-size:.84rem;padding:12px">No plans configured.</div>`;
    return;
  }
  grid.innerHTML = plans.map(plan => {
    const d = plan.plan_details;
    let detailItems = '';
    let moreKeys    = 0;
 
    if (Array.isArray(d) && d.length) {
      // Array format: [{key, en, ar, enabled, price?}, ...]
      const shown = d.slice(0, 6);
      moreKeys    = d.length - shown.length;
      detailItems = shown.map(feature => {
        const nameEn      = (feature.en || feature.key || '').replace(/_/g, ' ');
        const isEnabled   = feature.enabled !== false;
        const statusClass = isEnabled ? 'feat-on' : 'feat-off';
        const statusText  = isEnabled ? 'Enabled' : 'Disabled';
        const priceSegment = (feature.price != null && feature.price !== '')
          ? `<span style="color:var(--text-2)">${feature.price} KWD</span><span style="color:var(--border);margin:0 3px">·</span>`
          : '';
        return `<li style="list-style:none;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;align-items:center;gap:6px;font-size:.75rem">
          <div class="feat-dot ${statusClass}"></div>
          <span style="font-weight:600;color:var(--text)">${nameEn}</span>
          <span style="color:var(--border);margin:0 1px">·</span>
          ${priceSegment}<span style="color:var(--text-3)">${statusText}</span>
        </li>`;
      }).join('');
 
    } else if (d && typeof d === 'object' && !Array.isArray(d)) {
        // Use our parsing utility to safely sort by the internal order attribute
        const sortedFeatures = _parsePlanDetailsToFeatures(d);
        const shown = sortedFeatures.slice(0, 6);
        moreKeys   = sortedFeatures.length - shown.length;
        
        detailItems = shown.map(f => {
          const nameEn      = (f.en || f.key || '').replace(/_/g, ' ');
          const statusClass = f.enabled ? 'feat-on' : 'feat-off';
          const statusText  = f.enabled ? 'Enabled' : 'Disabled';
          return `<li style="list-style:none;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;align-items:center;gap:6px;font-size:.75rem">
            <div class="feat-dot ${statusClass}"></div>
            <span style="font-weight:600;color:var(--text);text-transform:capitalize">${nameEn}</span>
            <span style="color:var(--border);margin:0 1px">·</span>
            <span style="color:var(--text-3)">${statusText}</span>
          </li>`;
        }).join('');
      }
 
    return `<div class="plan-admin-card${plan.name === 'Pro' ? ' featured' : ''}">
      <div class="plan-card-top">
        <div>
          <div class="plan-card-name">${plan.name}</div>
          <div class="plan-card-id">ID: ${plan.id}</div>
        </div>
  
      </div>
      <div class="plan-card-body">
        <div class="plan-price-row">
          <div><div class="plan-price-label">Monthly</div><div class="plan-price-val">${Number(plan.price_monthly).toFixed(3)} <span>KWD</span></div></div>
          <div><div class="plan-price-label">Yearly</div><div class="plan-price-val">${Number(plan.price_yearly).toFixed(3)} <span>KWD</span></div></div>
        </div>
        ${detailItems ? `<ul style="list-style:none;padding:0;margin:0">${detailItems}${moreKeys > 0 ? `<li style="font-size:.72rem;color:var(--text-3);padding-top:8px">+ ${moreKeys} more feature${moreKeys !== 1 ? 's' : ''}</li>` : ''}</ul>` : ''}
      </div>
      <div class="plan-card-footer">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openEditPlanById(${plan.id})">
          <i class="fas fa-edit" style="margin-right:4px;"></i>
          Edit
        </button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeletePlan(${plan.id},'${plan.name.replace(/'/g, "\\'")}')">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
}
 
// ── Plan Modal helpers ──────────────────────────────────────────
 
// Resets every form field and feature state to a blank slate.
function _clearPlanForm() {
  ['editPlanId', 'editPlanName', 'editPlanMonthly', 'editPlanYearly'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['errPlanName', 'errPlanMonthly'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  const enEl = document.getElementById('fbInputEn');
  const arEl = document.getElementById('fbInputAr');
  if (enEl) enEl.value = '';
  if (arEl) arEl.value = '';
  const tog = document.getElementById('fbInputEnabledToggle');
  if (tog) tog.classList.add('checked');
  const errFb = document.getElementById('errFbInput');
  if (errFb) { errFb.style.display = 'none'; errFb.textContent = ''; }
  _currentFeatures = [];
  _renderFeaturesList();
}
 
// ── Open: New Plan ──────────────────────────────────────────────
function openNewPlanModal() {
  _isCreateMode = true;
  _clearPlanForm();
 
  document.getElementById('editPlanModalTitle').textContent = 'New Plan';
  document.getElementById('editPlanModalSub').textContent   = 'Create a new pricing tier';
  document.getElementById('savePlanLabel').textContent      = 'Create Plan';
 
  _syncClearAllVisibility();
  openModal('editPlanModal');
}
 
// ── Open: Edit Existing Plan ────────────────────────────────────
function openEditPlanById(id) {
  const plan = _plans.find(p => String(p.id) === String(id));
  if (plan) openEditPlan(plan);
}
 
function openEditPlan(plan) {
  _isCreateMode = false;
 
  document.getElementById('editPlanId').value      = plan.id;
  document.getElementById('editPlanName').value    = plan.name          || '';
  document.getElementById('editPlanMonthly').value = plan.price_monthly ?? '';
  document.getElementById('editPlanYearly').value  = plan.price_yearly  ?? '';
 
  ['errPlanName', 'errPlanMonthly'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  const enEl = document.getElementById('fbInputEn');
  const arEl = document.getElementById('fbInputAr');
  if (enEl) enEl.value = '';
  if (arEl) arEl.value = '';
  const tog = document.getElementById('fbInputEnabledToggle');
  if (tog) tog.classList.add('checked');
  const errFb = document.getElementById('errFbInput');
  if (errFb) { errFb.style.display = 'none'; errFb.textContent = ''; }
 
  _currentFeatures = _parsePlanDetailsToFeatures(plan.plan_details);
  _renderFeaturesList();
 
  document.getElementById('editPlanModalTitle').textContent = `Edit — ${plan.name}`;
  document.getElementById('editPlanModalSub').textContent   = `Plan ID: ${plan.id}`;
  document.getElementById('savePlanLabel').textContent      = 'Save Changes';
 
  _syncClearAllVisibility();
  openModal('editPlanModal');
}
 
// Show/hide the "Clear All Data" button — only visible in create mode
function _syncClearAllVisibility() {
  const btn = document.getElementById('clearAllPlanDataBtn');
  if (!btn) return;
  btn.style.display = _isCreateMode ? '' : 'none';
}
 
// ── Convert plan_details → _currentFeatures ────────────────────
function _parsePlanDetailsToFeatures(plan_details) {
  if (Array.isArray(plan_details)) {
    // New format: array order IS the canonical order — preserve it as-is
    return plan_details.map((f, i) => ({
      key:     f.key     || `feature_${i}`,
      en:      f.en      || f.name || '',
      ar:      f.ar      || '',
      enabled: f.enabled !== false,
    }));
  }
  // Legacy object format: parse and sort by order field for backwards compat
  if (plan_details && typeof plan_details === 'object') {
    return Object.entries(plan_details).map(([k, v], i) => {
      const isObject = v !== null && typeof v === 'object' && !Array.isArray(v);
      return {
        key:     k,
        en:      isObject ? (v.en  || k) : String(v),
        ar:      isObject ? (v.ar  || '') : '',
        enabled: isObject ? v.enabled !== false : (v !== false && v !== 0 && v !== null),
        order:   isObject ? (v.order ?? i) : i
      };
    }).sort((a, b) => a.order - b.order);
  }
  return [];
}
 
// ── Feature Builder ─────────────────────────────────────────────
 
function _renderFeaturesList() {
  const list = document.getElementById('fbFeaturesList');
  if (!list) return;
 
  if (!_currentFeatures.length) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-3);font-size:.82rem">No features added yet. Use the form above to add one.</div>`;
    return;
  }
 
  list.innerHTML = _currentFeatures.map((f, i) => `
    <div class="fb-feature-item" draggable="true" data-idx="${i}">
      <div class="fb-drag-handle" title="Drag to reorder">
        <i class="fas fa-grip-lines" style="color:var(--text-muted); opacity:0.6"></i>
      </div>
      <div class="fb-feature-text">
        <span class="fb-feature-en">${_esc(f.en)}</span>
        ${f.ar ? `<span class="fb-feature-ar">${_esc(f.ar)}</span>` : ''}
      </div>
      <div class="fb-item-controls">
        <button class="fb-toggle-btn ${f.enabled ? 'enabled' : 'disabled'}" onclick="_toggleFeat(${i})">
          ${f.enabled ? 'On' : 'Off'}
        </button>
        <button class="fb-btn-delete" onclick="_deleteFeat(${i})" title="Remove feature">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>`).join('');
 
  _bindDragDrop();
}
 
function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
 
// Add feature from the input row
function addFeatureFromBuilder() {
  const enEl  = document.getElementById('fbInputEn');
  const arEl  = document.getElementById('fbInputAr');
  const togEl = document.getElementById('fbInputEnabledToggle');
  const errEl = document.getElementById('errFbInput');
 
  const en = (enEl.value || '').trim();
  const ar = (arEl.value || '').trim();
 
  if (!en || !ar) {
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
 
  const enabled = togEl.classList.contains('checked');
  const key = en.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `feature_${Date.now()}`;
 
  _currentFeatures.push({ key, en, ar, enabled });
  enEl.value = '';
  arEl.value = '';
  togEl.classList.add('checked');
 
  _renderFeaturesList();
}
 
// Toggle the input row "Enabled" toggle
function toggleFbInputEnabled() {
  document.getElementById('fbInputEnabledToggle').classList.toggle('checked');
}
 
// Move a feature up/down
function _moveFeat(idx, dir) {
  const next = idx + dir;
  if (next < 0 || next >= _currentFeatures.length) return;
  [_currentFeatures[idx], _currentFeatures[next]] = [_currentFeatures[next], _currentFeatures[idx]];
  _renderFeaturesList();
}
 
// Toggle enabled state of a feature row
function _toggleFeat(idx) {
  _currentFeatures[idx].enabled = !_currentFeatures[idx].enabled;
  _renderFeaturesList();
}
 
// Delete a feature row
function _deleteFeat(idx) {
  _currentFeatures.splice(idx, 1);
  _renderFeaturesList();
}
 
// ── "Clear All Data" — Create Mode Only ────────────────────────
function confirmClearAllPlanForm() {
  if (!_isCreateMode) return;
  const hasData = document.getElementById('editPlanName').value.trim() ||
                  document.getElementById('editPlanMonthly').value ||
                  document.getElementById('editPlanYearly').value ||
                  _currentFeatures.length;
  if (!hasData) return;
  confirmAction('Clear all data?', 'This will remove the plan name, prices, and all features.', () => {
    _clearPlanForm();
  });
}
 
// ── Drag & Drop (mouse + touch) ─────────────────────────────────
let _dragSrcIdx = null;
 
function _bindDragDrop() {
  const list = document.getElementById('fbFeaturesList');
  if (!list) return;
 
  list.querySelectorAll('.fb-feature-item').forEach(row => {
    row.addEventListener('dragstart', e => {
      _dragSrcIdx = parseInt(row.dataset.idx);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      list.querySelectorAll('.fb-feature-item').forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.fb-feature-item').forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
    
      const targetIdx = parseInt(row.dataset.idx, 10);
    
      if (
        _dragSrcIdx !== null &&
        _dragSrcIdx !== targetIdx &&
        targetIdx >= 0
      ) {
        const movedFeature = _currentFeatures.splice(_dragSrcIdx, 1)[0];
    
        _currentFeatures.splice(targetIdx, 0, movedFeature);
    
        _renderFeaturesList();
      }
    
      _dragSrcIdx = null;
    });
    

    // Touch drag (only initiates from the grab handle to allow normal list scrolling elsewhere)
    row.addEventListener('touchstart', e => {
      const handle = e.target.closest('.fb-drag-handle');
      if (!handle) return; // Allow normal scrolling if they didn't touch the handle

      e.preventDefault(); // Prevent page/container scrolling during drag
      row.classList.add('dragging');

      const touchMoveHandler = ev => {
        ev.preventDefault();
        const touchY = ev.touches[0].clientY;

        let swapped = true;
        while (swapped) {
          swapped = false;
          const prev = row.previousElementSibling;
          if (prev && prev.classList.contains('fb-feature-item')) {
            const prevRect = prev.getBoundingClientRect();
            if (touchY < prevRect.top + prevRect.height / 2) {
              row.parentNode.insertBefore(row, prev);
              swapped = true;
              continue;
            }
          }
          const next = row.nextElementSibling;
          if (next && next.classList.contains('fb-feature-item')) {
            const nextRect = next.getBoundingClientRect();
            if (touchY > nextRect.top + nextRect.height / 2) {
              row.parentNode.insertBefore(row, next.nextElementSibling);
              swapped = true;
              continue;
            }
          }
        }
      };

      const touchEndHandler = () => {
        row.classList.remove('dragging');
        document.removeEventListener('touchmove', touchMoveHandler);
        document.removeEventListener('touchend', touchEndHandler);
        document.removeEventListener('touchcancel', touchEndHandler);

        // Rebuild features array from current DOM order
        const newFeatures = [];
        list.querySelectorAll('.fb-feature-item').forEach(item => {
          const idx = parseInt(item.dataset.idx, 10);
          newFeatures.push(_currentFeatures[idx]);
        });
        _currentFeatures = newFeatures;
        _renderFeaturesList(); // Re-render to refresh indexes and bind handlers
      };

      document.addEventListener('touchmove', touchMoveHandler, { passive: false });
      document.addEventListener('touchend', touchEndHandler, { passive: false });
      document.addEventListener('touchcancel', touchEndHandler, { passive: false });
    }, { passive: false });
 

  });
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
 
  return ok;
}
 
function _buildPlanPayload() {
  const planDetailsArray = _currentFeatures.map((feature) => ({
    en: feature.en || '',
    ar: feature.ar || '',
    enabled: feature.enabled !== false
  }));

  return {
    name: document.getElementById('editPlanName').value.trim(),
    price_monthly: parseFloat(document.getElementById('editPlanMonthly').value) || 0,
    price_yearly: parseFloat(document.getElementById('editPlanYearly').value) || 0,
    plan_details: planDetailsArray
  };
}

// ── Save (Create or Edit) ───────────────────────────────────────
async function savePlan() {
  if (!_validatePlanForm()) return;

  const btn = document.getElementById('savePlanBtn');
  const label = document.getElementById('savePlanLabel');

  btn.disabled = true;
  label.innerHTML =
    '<span class="pagination-spinner" style="display:inline-block;width:13px;height:13px;border:2px solid rgba(0,0,0,.2);border-top-color:currentColor;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:5px"></span>Saving…';

  try {
    const id = document.getElementById('editPlanId').value;
    const payload = _buildPlanPayload();

    let saved;

    if (id) {
      saved = await apiFetch(
        `/api/v1/admin/plans/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }
      );

      const idx = _plans.findIndex(
        p => String(p.id) === String(id)
      );

      if (idx >= 0) {
        _plans[idx] = saved;
      }

      toast(`Plan "${saved.name}" updated`, 'success');
    } else {
      saved = await apiFetch(
        '/api/v1/admin/plans',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );

      _plans.push(saved);

      toast(`Plan "${saved.name}" created`, 'success');
    }

    await loadPlans(true);
    closeModal('editPlanModal');
  } catch (e) {
    toast(`Failed to save plan: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = _isCreateMode
      ? 'Create Plan'
      : 'Save Changes';
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
    await apiFetch(`/api/v1/admin/plans/${planId}`, { method: 'DELETE' });
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
    `<i class="${i < r ? 'fas':'far'} fa-star review-star-${i < r ? 'filled':'empty'}"></i>`
  ).join('');
}

function renderReviews(reviews) {
  const grid = document.getElementById('reviewsCardsGrid');
  if (!reviews.length) {
    grid.innerHTML = `<div class="item-row"><div class="item-row-body"><div class="empty-state"><div class="empty-state-icon"><i class="fas fa-comments" style="font-size:2rem;color:var(--text-muted)"></i></div><h3>No reviews found</h3><p>Try adjusting your filters</p></div></div></div>`;
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
          <i class="fas fa-check" style="margin-right:4px;"></i>
          Approve
        </button>` : `<button class="act-btn" style="color:var(--text-2);" onclick="pendingReview(${rev.id})">
          <i class="fas fa-clock" style="margin-right:4px;"></i>
          Set Pending
        </button>`}
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" onclick="confirmDeleteReview(${rev.id})">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
          Delete
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
      filterReviews();
    }
    updateReviewStats();
    toast('Review accepted and published', 'success');
  } catch (e) {
    toast('Failed to accept review', 'error');
  }
}

async function pendingReview(revId) {
  try {
    await apiFetch(`/api/v1/admin/reviews/${revId}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ is_published: false }),
    });
    const idx = _reviews.findIndex(r => r.id === revId);
    if (idx >= 0) {
      _reviews[idx] = { ..._reviews[idx], is_published: false, status: 'pending' };
      filterReviews();
    }
    updateReviewStats();
    toast('Review set to pending', 'info');
  } catch (e) {
    toast('Failed to update review', 'error');
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
      if (name.toLowerCase() === 'none') return '#64748b';
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      return DASHBOARD_COLORS[Math.abs(hash) % DASHBOARD_COLORS.length];
    }

    // Build SVG pie chart
    const R = 90, CX = 110, CY = 100;
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
      return { name, count, pct, x1, y1, x2, y2, large, color, midA, angle };
    });

    const labelSlices = slices.filter(s => s.pct >= 4);
    const svgLabels = labelSlices.map(s => {
      const alpha = s.angle / 2;
      const d = alpha === 0 ? 0 : (2 / 3) * R * Math.sin(alpha) / alpha;
      const lx = CX + d * Math.cos(s.midA);
      const ly = CY + d * Math.sin(s.midA);
      return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
        fill="#fff" font-size="11" font-weight="700" font-family="'Geist', sans-serif" style="pointer-events:none">${s.pct}%</text>`;
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
      `<div class="pie-legend-item">
        <span class="pie-legend-dot" style="background:${s.color}"></span>
        <span class="pie-legend-name">${s.name}</span>
        <span class="pie-legend-value">${s.count}</span>
      </div>`
    ).join('');

    distEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;width:100%">
        <svg width="100%" height="200" viewBox="0 0 220 200" style="flex-shrink:0;overflow:visible;display:block">
          ${svgPaths}
          ${svgLabels}
        </svg>
        <div class="pie-legend-container">${legend}</div>
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
              <i class="fas fa-eye" style="margin-right:4px;"></i>
              View
            </button>
          </div>
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:24px 0;color:var(--text-3)">
        <i class="fas fa-check" style="font-size:1.5rem;color:var(--green);margin-bottom:8px;display:block"></i>
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
  await Promise.allSettled([loadUsers(_userPage), loadPlans(true), loadRequests(_reqPage), loadReviews(_revPage), loadStorageUsage(), loadPlanDistribution(), loadEmailsThisMonth(), loadPaymentsTelemetry()]);
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
  localStorage.removeItem('access_token');
  window.location.href = 'index.html';
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('settingsApiBase').value = API;

  // Restore section from URL hash (e.g. admin.html#plans survives F5)
  const hash = (location.hash || '').replace('#', '').trim();
  const validPages = ['dashboard','requests','users','plans','reviews','payments','settings'];
  if (hash && validPages.includes(hash)) {
    showPage(hash);
  }

  // Keyboard: Esc closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
      closeStatusModal();
      closeCreateConfirm();
    }
    // Ctrl/Cmd + Enter saves plan modal if open
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.getElementById('editPlanModal').classList.contains('open')) savePlan();
    }
  });

  // Flatpickr initialization
  if (typeof flatpickr !== 'undefined') {
    const startContainer = document.getElementById('start-date-container');
    const startEl = document.getElementById('sub-start');
    if (startEl && !startEl.value) {
      startEl.value = new Date().toISOString().split('T')[0];
    }
    if (startContainer) {
      flatpickr(startContainer, {
        wrap: true,
        allowInput: true,
        clickOpens: false,
        dateFormat: 'Y-m-d',
        onChange: function() {
          autoFillPlanAmount();
        }
      });
    }
    const endContainer = document.getElementById('end-date-container');
    if (endContainer) {
      flatpickr(endContainer, {
        wrap: true,
        allowInput: true,
        clickOpens: false,
        dateFormat: 'Y-m-d'
      });
    }
    const editStartContainer = document.getElementById('edit-payment-start-container');
    if (editStartContainer) {
      flatpickr(editStartContainer, {
        wrap: true,
        allowInput: true,
        clickOpens: false,
        dateFormat: 'Y-m-d'
      });
    }
    const editEndContainer = document.getElementById('edit-payment-end-container');
    if (editEndContainer) {
      flatpickr(editEndContainer, {
        wrap: true,
        allowInput: true,
        clickOpens: false,
        dateFormat: 'Y-m-d'
      });
    }
  }

  // Modal Backdrop Click Listeners
  document.getElementById('statusModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeStatusModal();
  });
  document.getElementById('createConfirmModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeCreateConfirm();
  });

  // Init
  window.addEventListener('load', () => {
    setTimeout(loadAll, 0);
  });
});

async function loadPaymentsTelemetry() {
  try {
    const data = await apiFetch('/api/v1/admin/payments');
    
    const items = data && Array.isArray(data.items) ? data.items : [];
    _payments = items;

    const metrics = data.metrics || {};
    
    const finalTotalPayments = metrics.total_payments ?? items.length;
    const finalPaidPayments = metrics.paid_payments ?? items.filter(p => p.status === 'paid').length;
    const finalCanceledPayments = metrics.canceled_payments ?? items.filter(p => p.status === 'canceled').length;
    const finalRejectedPayments = metrics.rejected_payments ?? items.filter(p => p.status === 'rejected').length;
    const finalMonthlyCycle = metrics.monthly_payments ?? items.filter(p => p.billing_cycle === 'monthly').length;
    const finalYearlyCycle = metrics.yearly_payments ?? items.filter(p => p.billing_cycle === 'yearly').length;
    
    const now = new Date();
    const currentMonthItems = items.filter(p => {
      const pDate = new Date(p.created_at);
      return pDate.getFullYear() === now.getFullYear() && pDate.getMonth() === now.getMonth();
    });
    
    const finalPaymentsThisMonth = metrics.payments_this_month ?? currentMonthItems.length;

    const totalRevenue = metrics.total_revenue ?? items.filter(p => p.status === 'paid' || p.status === 'canceled').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const revenueThisMonth = metrics.revenue_this_month ?? currentMonthItems.filter(p => p.status === 'paid' || p.status === 'canceled').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const setElText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElText('payStatTotal', finalTotalPayments);
    setElText('payStatActive', finalPaidPayments);
    setElText('payStatCanceled', finalCanceledPayments);
    setElText('payStatRejected', finalRejectedPayments);
    setElText('payStatThisMonth', finalPaymentsThisMonth);
    setElText('payStatMonthlyCycle', finalMonthlyCycle);
    setElText('payStatYearlyCycle', finalYearlyCycle);
    
    // Main Dashboard Total Revenue
    const mainRevEl = document.getElementById('statRevenueVal');
    if (mainRevEl) {
      mainRevEl.innerHTML = `${Number(totalRevenue).toFixed(3)} <span style="font-size:13px;font-weight:400">KWD</span>`;
    }
    
    // Payments Page Revenue This Month
    const revMonthEl = document.getElementById('payStatRevenueThisMonth');
    if (revMonthEl) {
      revMonthEl.innerHTML = `${Number(revenueThisMonth).toFixed(3)} <span style="font-size:13px;font-weight:400">KWD</span>`;
    }
    
    const activeEl = document.getElementById('statActive');
    if (activeEl) {
      activeEl.textContent = finalPaidPayments;
    }
    
    renderPaymentsTable(items);
  } catch(e) {
    const totalEl = document.getElementById('payStatTotal');
    if (totalEl) totalEl.textContent = '—';
    console.error('Failed to load payments telemetry:', e);
  }
}

let _lookupTimeout = null;
let _selectedUserId = null;
let _currentStatusPaymentId = null;

function lookupUserByEmail(email) {
  clearTimeout(_lookupTimeout);
  const resultEl = document.getElementById('payUserLookupResult');
  const createBtn = document.getElementById('createPaymentBtn');
  
  if (!email || !email.includes('@')) {
    if (resultEl) {
      resultEl.innerHTML = '';
      resultEl.style.color = '';
    }
    if (createBtn) createBtn.disabled = true;
    _selectedUserId = null;
    return;
  }
  
  if (resultEl) {
    resultEl.textContent = 'Searching user...';
    resultEl.style.color = 'var(--text-muted)';
  }
  
  _lookupTimeout = setTimeout(async () => {
    try {
      const user = await apiFetch(`/api/v1/admin/user?email=${encodeURIComponent(email.trim())}`);
      if (user && user.id) {
        _selectedUserId = user.id;
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.company_name || 'No Name';
        if (resultEl) {
          resultEl.innerHTML = `<span style="color:var(--green)">✓ User found: ${name} (ID: ${user.id})</span>`;
        }
        if (createBtn) createBtn.disabled = false;
        
        autoFillPlanAmount();
      } else {
        _selectedUserId = null;
        if (resultEl) {
          resultEl.innerHTML = '<span style="color:var(--red)">✗ User not found</span>';
        }
        if (createBtn) createBtn.disabled = true;
      }
    } catch(e) {
      _selectedUserId = null;
      if (resultEl) {
        resultEl.innerHTML = '<span style="color:var(--red)">✗ User not found</span>';
      }
      if (createBtn) createBtn.disabled = true;
    }
  }, 400);
}

function populatePlanDropdown() {
  const select = document.getElementById('sub-plan');
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Select…</option>';
  _plans.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

function autoFillPlanAmount() {
  const planId = document.getElementById('sub-plan').value;
  const cycle = document.getElementById('sub-cycle').value;
  const amountInput = document.getElementById('sub-amount');
  const startDateInput = document.getElementById('sub-start');
  const endDateInput = document.getElementById('sub-end');
  
  if (startDateInput && !startDateInput.value) {
    const today = new Date();
    startDateInput.value = today.toISOString().split('T')[0];
  }
  if (endDateInput && startDateInput.value) {
    const start = new Date(startDateInput.value);
    let end;
    if (cycle === 'yearly') {
      end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
    }
    endDateInput.value = end.toISOString().split('T')[0];
    const fp = endDateInput._flatpickr || document.getElementById('end-date-container')?._flatpickr;
    if (fp) {
      fp.setDate(endDateInput.value);
    }
  }
  
  if (!planId) return;
  const plan = _plans.find(p => String(p.id) === String(planId));
  if (!plan) return;
  
  const planName = (plan.name || '').toLowerCase();
  let monthlyPrice = plan.price_monthly ?? plan.monthly_price ?? 0;
  let yearlyPrice = plan.price_yearly ?? plan.yearly_price ?? (monthlyPrice * 12);
  
  if (planName.includes('starter')) {
    monthlyPrice = 49;
    yearlyPrice = 490;
  } else if (planName.includes('growth')) {
    monthlyPrice = 99;
    yearlyPrice = 990;
  } else if (planName.includes('enterprise')) {
    monthlyPrice = 199;
    yearlyPrice = 1990;
  }
  
  if (amountInput) {
    amountInput.value = cycle === 'yearly' ? yearlyPrice : monthlyPrice;
  }
}

function showCreateConfirm() {
  const email  = document.getElementById('sub-email').value.trim();
  const planId = document.getElementById('sub-plan').value;
  const amount = document.getElementById('sub-amount').value;
  const cycle  = document.getElementById('sub-cycle').value;
  const start  = document.getElementById('sub-start').value;
  const end    = document.getElementById('sub-end').value;

  if (!_selectedUserId) {
    toast('Please search and select a valid user first', 'error');
    return;
  }
  if (!planId) {
    toast('Please select a plan', 'error');
    return;
  }
  const parseFloatAmount = parseFloat(amount);
  if (isNaN(parseFloatAmount) || parseFloatAmount < 0) {
    toast('Please enter a valid amount', 'error');
    return;
  }
  if (!start || !end) {
    toast('Please fill all required fields', 'error');
    return;
  }

  const plan = _plans.find(p => String(p.id) === String(planId));
  const planName = plan ? plan.name : 'Unknown';

  document.getElementById('confirmEmail').textContent  = email;
  document.getElementById('confirmPlan').textContent   = planName;
  document.getElementById('confirmAmount').textContent = parseFloatAmount.toFixed(3) + ' KWD';
  document.getElementById('confirmCycle').textContent  = cycle.charAt(0).toUpperCase() + cycle.slice(1);
  document.getElementById('confirmPeriod').textContent = start + ' → ' + end;

  document.getElementById('createConfirmModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCreateConfirm() {
  document.getElementById('createConfirmModal').classList.remove('open');
  document.body.style.overflow = '';
}

async function submitSubscription() {
  const planId = document.getElementById('sub-plan').value;
  const amount = parseFloat(document.getElementById('sub-amount').value);
  const cycle  = document.getElementById('sub-cycle').value;
  const start  = document.getElementById('sub-start').value;
  const end    = document.getElementById('sub-end').value;

  const payload = {
    user_id: _selectedUserId,
    plan_id: parseInt(planId),
    amount: amount,
    billing_cycle: cycle,
    status: {
      status: "paid"
    },
    start_date: start ? new Date(start).toISOString() : new Date().toISOString(),
    end_date: end ? new Date(end).toISOString() : new Date(Date.now() + 30*24*60*60*1000).toISOString()
  };

  const btn = document.getElementById('createPaymentBtn');
  const originalText = btn ? btn.textContent : 'Create subscription';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creating...';
  }

  closeCreateConfirm();

  try {
    await apiFetch('/api/v1/admin/payments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    toast('Payment / Plan Subscription created successfully', 'success');

    document.getElementById('sub-email').value = '';
    document.getElementById('sub-plan').value = '';
    document.getElementById('sub-amount').value = '';
    const resultEl = document.getElementById('payUserLookupResult');
    if (resultEl) resultEl.innerHTML = '';
    _selectedUserId = null;

    await loadPaymentsTelemetry();
  } catch (e) {
    toast(`Failed to create payment: ${e.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

function renderPaymentsTable(items) {
  const grid = document.getElementById('paymentsListGrid');
  const countEl = document.getElementById('paymentsListCount');
  if (!grid) return;
  
  if (countEl) {
    countEl.textContent = `${items.length} payment${items.length !== 1 ? 's' : ''}`;
  }
  
  if (!items.length) {
    grid.innerHTML = `<div style="text-align:center;padding:32px 0;color:var(--text-muted)"><h3>No payments found</h3></div>`;
    return;
  }
  
  grid.innerHTML = items.map(p => {
    // Fallback lookup: if nested user or plan objects are missing, fetch them from our caches
    let u = p.user;
    if (!u && p.user_id) {
      u = _users.find(usr => usr.id === p.user_id);
    }
    u = u || {};

    let plan = p.plan;
    if (!plan && p.plan_id) {
      plan = _plans.find(pln => pln.id === p.plan_id);
    }
    plan = plan || {};

    const name = p.name || p.user_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.company_name || '—';
    const email = p.email || p.user_email || u.email || '—';
    const status = p.status || 'pending';
    const initials = name !== '—' ? name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() : (email[0]||'?').toUpperCase();
    
    let statusClass = 'pending';
    if (status === 'paid') statusClass = 'paid';
    if (status === 'canceled' || status === 'rejected') statusClass = 'rejected';
    
    const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
    
    return `<div class="payment-card">
      <div class="payment-avatar">${initials}</div>
      <div class="payment-main">
        <div class="payment-top">
          <div class="payment-name">${name}</div>
          <span class="status-badge ${statusClass}"><span class="status-dot"></span>${formattedStatus}</span>
        </div>
        <div class="payment-email">${email}</div>
        <div class="payment-meta">
          <div class="meta-item"><div class="meta-label">ID</div><div class="meta-value">#${p.id}</div></div>
          <div class="meta-item"><div class="meta-label">Plan</div><div class="meta-value">${plan.name || '—'}</div></div>
          <div class="meta-item"><div class="meta-label">Amount</div><div class="meta-value amount">${p.amount} KWD</div></div>
          <div class="meta-item"><div class="meta-label">Cycle</div><div class="meta-value">${p.billing_cycle || '—'}</div></div>
          <div class="meta-item"><div class="meta-label">Period</div><div class="meta-value">${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}</div></div>
          <div class="meta-item"><div class="meta-label">Created</div><div class="meta-value">${fmtDate(p.created_at)}</div></div>
        </div>
      </div>
      <div class="payment-actions" style="display:flex; gap:8px;">
        <button class="btn-update" onclick="openStatusModal(${p.id}, '${status}')" style="flex:1;">
          <i class="fas fa-sync-alt" style="font-size:12px; margin-right:4px;"></i>
          Status
        </button>
        <button class="btn-update" onclick="openEditPaymentModal(${p.id})" style="flex:1; background:var(--accent-dim); color:var(--accent);">
          <i class="fas fa-edit" style="font-size:12px; margin-right:4px;"></i>
          Edit
        </button>
      </div>
    </div>`;
  }).join('');
}

function filterPayments() {
  const q = (document.getElementById('paySearch').value || '').toLowerCase().trim();
  const status = document.getElementById('payStatusFilter').value;
  const sort = document.getElementById('paySortFilter').value;

  let filtered = _payments.filter(p => {
    const u = p.user || {};
    const plan = p.plan || {};
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.company_name || '';
    const email = u.email || '';
    
    const matchQ = !q ||
      email.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      (plan.name || '').toLowerCase().includes(q) ||
      String(p.id).includes(q) ||
      String(p.plan_id).includes(q);
      
    const matchStatus = !status || p.status === status;
    return matchQ && matchStatus;
  });

  filtered.sort((a, b) => {
    const da = new Date(a.created_at || 0), db = new Date(b.created_at || 0);
    return sort === 'oldest' ? da - db : db - da;
  });

  renderPaymentsTable(filtered);
}

function openStatusModal(pid, currentStatus) {
  _currentStatusPaymentId = pid;
  document.getElementById('modalSubtitle').textContent = 'Payment ID: #' + pid;
  const sel = document.getElementById('newStatusSelect');
  if (sel) {
    sel.value = currentStatus;
  }
  togglePaidNotice();
  document.getElementById('statusModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeStatusModal() {
  document.getElementById('statusModal').classList.remove('open');
  document.body.style.overflow = '';
}

function togglePaidNotice() {
  const sel = document.getElementById('newStatusSelect');
  const notice = document.getElementById('paidEmailNotice');
  const textEl = document.getElementById('statusNoticeText');
  if (sel && notice && textEl) {
    notice.classList.remove('warning', 'danger');
    if (sel.value === 'paid') {
      notice.style.display = 'flex';
      textEl.innerHTML = `Marking as <strong>Paid</strong> will automatically send a payment receipt to the user's email.`;
    } else if (sel.value === 'rejected') {
      notice.style.display = 'flex';
      notice.classList.add('danger');
      textEl.innerHTML = `Marking as <strong>Rejected</strong> will automatically send a rejection notification to the user's email.`;
    } else if (sel.value === 'canceled') {
      notice.style.display = 'flex';
      notice.classList.add('warning');
      textEl.innerHTML = `Marking as <strong>Canceled</strong> will automatically send a cancellation notification to the user's email.`;
    } else {
      notice.style.display = 'none';
    }
  }
}

async function confirmStatusUpdate() {
  const pid = _currentStatusPaymentId;
  const st = document.getElementById('newStatusSelect').value;
  if (!pid) return toast('Please select a payment ID', 'error');

  closeStatusModal();

  try {
    await apiFetch(`/api/v1/admin/payments/${pid}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: { status: st } })
    });
    toast('Payment status updated successfully', 'success');
    loadPaymentsTelemetry();
  } catch (e) {
    toast('Failed to update payment status', 'error');
  }
}

function populateEditPaymentPlanDropdown(selectedPlanId) {
  const select = document.getElementById('editPaymentPlan');
  if (!select) return;
  select.innerHTML = '';
  _plans.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (String(p.id) === String(selectedPlanId)) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function openEditPaymentModal(pid) {
  const payment = _payments.find(p => String(p.id) === String(pid));
  if (!payment) return toast('Payment not found', 'error');

  document.getElementById('editPaymentId').value = pid;
  document.getElementById('editPaymentSubtitle').textContent = `Payment ID: #${pid}`;
  
  populateEditPaymentPlanDropdown(payment.plan_id);
  document.getElementById('editPaymentCycle').value = payment.billing_cycle || 'monthly';
  document.getElementById('editPaymentAmount').value = payment.amount || '';
  
  const formatForInput = (d) => {
    if (!d) return '';
    return new Date(d).toISOString().split('T')[0];
  };
  
  const startEl = document.getElementById('editPaymentStart');
  const endEl = document.getElementById('editPaymentEnd');
  
  startEl.value = formatForInput(payment.start_date);
  endEl.value = formatForInput(payment.end_date);
  
  const startFp = startEl._flatpickr || document.getElementById('edit-payment-start-container')?._flatpickr;
  if (startFp) startFp.setDate(startEl.value);
  
  const endFp = endEl._flatpickr || document.getElementById('edit-payment-end-container')?._flatpickr;
  if (endFp) endFp.setDate(endEl.value);

  document.getElementById('editPaymentStatus').value = payment.status || 'pending';
  toggleEditPaymentPaidNotice();

  openModal('editPaymentModal');
}

function toggleEditPaymentPaidNotice() {
  const sel = document.getElementById('editPaymentStatus');
  const notice = document.getElementById('editPaymentPaidNotice');
  const textEl = document.getElementById('editPaymentNoticeText');
  if (sel && notice && textEl) {
    notice.classList.remove('warning', 'danger');
    if (sel.value === 'paid') {
      notice.style.display = 'flex';
      textEl.innerHTML = `Marking as <strong>Paid</strong> will automatically send a payment receipt to the user's email.`;
    } else if (sel.value === 'rejected') {
      notice.style.display = 'flex';
      notice.classList.add('danger');
      textEl.innerHTML = `Marking as <strong>Rejected</strong> will automatically send a rejection notification to the user's email.`;
    } else if (sel.value === 'canceled') {
      notice.style.display = 'flex';
      notice.classList.add('warning');
      textEl.innerHTML = `Marking as <strong>Canceled</strong> will automatically send a cancellation notification to the user's email.`;
    } else {
      notice.style.display = 'none';
    }
  }
}

async function savePayment() {
  const pid = document.getElementById('editPaymentId').value;
  const planId = document.getElementById('editPaymentPlan').value;
  const cycle = document.getElementById('editPaymentCycle').value;
  const amount = parseFloat(document.getElementById('editPaymentAmount').value);
  const status = document.getElementById('editPaymentStatus').value;
  const start = document.getElementById('editPaymentStart').value;
  const end = document.getElementById('editPaymentEnd').value;

  if (!planId) return toast('Please select a plan', 'error');
  if (isNaN(amount) || amount < 0) return toast('Please enter a valid amount', 'error');
  if (!start || !end) return toast('Start and end dates are required', 'error');

  const payload = {
    plan_id: parseInt(planId),
    billing_cycle: cycle,
    amount: amount,
    status: {
      status: status
    },
    start_date: new Date(start).toISOString(),
    end_date: new Date(end).toISOString()
  };

  const btn = document.getElementById('savePaymentBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await apiFetch(`/api/v1/admin/payments/${pid}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    toast('Payment updated successfully', 'success');
    closeModal('editPaymentModal');
    loadPaymentsTelemetry();
  } catch (e) {
    toast(`Failed to update payment: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

