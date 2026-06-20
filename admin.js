// https://api.badiaprojectmanagement.com

let API = localStorage.getItem('badia_admin_api') || API_BASE;

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
let _totalPayments = 0;

// ── Pagination State (persists across tab switches) ─────────────
let _userPage = 1, _userHasMore = false, _userLoading = false;
let _reqPage  = 1, _reqHasMore  = false, _reqLoading  = false;
let _revPage  = 1, _revHasMore  = false, _revLoading  = false;
let _payPage  = 1, _payHasMore  = false, _payLoading  = false;
const PAGE_LIMIT = 25;

// ── API Helper (with auto token refresh) ───────────────────────
let _refreshing = false;
let _refreshQueue = [];

async function doRefreshToken() {
  const res = await fetch(`${API}/api/v1/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders(),
    },
  });
  if (!res.ok) throw new Error('Refresh failed');
  return true;
}

async function apiFetch(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };

  // CSRF for mutations
  if (!isGet) Object.assign(headers, csrfHeaders());

  const cacheKeyData = `api_cache_data_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const cacheKeyEtag = `api_cache_etag_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

  if (isGet && !opts.forceRefresh) {
    const cachedEtag = localStorage.getItem(cacheKeyEtag);
    if (cachedEtag) headers['If-None-Match'] = cachedEtag;
  }

  let res = await fetch(`${API}${path}`, {
    ...opts,
    headers,
    credentials: 'include',   // ← key change
  });

  if (res.status === 401) {
    if (!_refreshing) {
      _refreshing = true;
      try {
        await doRefreshToken();
        _refreshing = false;
        _refreshQueue.forEach(r => r(true));
        _refreshQueue = [];
        // Retry — cookies updated by refresh endpoint
        const retryHeaders = { ...headers };
        if (!isGet) Object.assign(retryHeaders, csrfHeaders());
        res = await fetch(`${API}${path}`, {
          ...opts,
          headers: retryHeaders,
          credentials: 'include',
        });
      } catch (e) {
        _refreshing = false;
        _refreshQueue.forEach(r => r(false));
        _refreshQueue = [];
        toast('Session expired. Redirecting to sign in…', 'error');
        setTimeout(() => { window.location.href = 'index.html?open_signin=true'; }, 1500);
        throw new Error('Session expired');
      }
    } else {
      const ok = await new Promise(resolve => _refreshQueue.push(resolve));
      if (!ok) throw new Error('Session expired');
      const retryHeaders = { ...headers };
      if (!isGet) Object.assign(retryHeaders, csrfHeaders());
      res = await fetch(`${API}${path}`, {
        ...opts,
        headers: retryHeaders,
        credentials: 'include',
      });
    }
  }

  if (isGet && res.status === 304) {
    const cachedData = localStorage.getItem(cacheKeyData);
    if (cachedData) {
      try { return JSON.parse(cachedData); } catch (_) {}
    }
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  if (isGet) {
    localStorage.setItem(cacheKeyData, JSON.stringify(data));
    const newEtag = res.headers.get('ETag');
    if (newEtag) localStorage.setItem(cacheKeyEtag, newEtag);
    else localStorage.removeItem(cacheKeyEtag);
  }

  return data;
}

// ── SWR Helper ──────────────────────────────────────────────────
async function swrFetch(path, forceRefresh, onData) {
  let cachedStr = null;
  let didRenderCache = false;
  const cacheKey = `api_cache_data_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

  if (!forceRefresh) {
    cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try {
        const parsed = JSON.parse(cachedStr);
        onData(parsed);
        didRenderCache = true;
      } catch (e) {}
    }
  }

  // Defer the network request to ensure the cached UI builds first
  const delay = didRenderCache ? 100 : 0;
  setTimeout(async () => {
    try {
      const freshData = await apiFetch(path, { forceRefresh });
      const freshStr = JSON.stringify(freshData);
      if (freshStr !== cachedStr) {
        onData(freshData);
      }
    } catch (e) {
      console.error(`SWR revalidation failed for ${path}:`, e);
    }
  }, delay);

  return didRenderCache;
}

// ── Page Navigation (with hash persistence) ────────────────────
function showPage(id, skipLoad = false) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${id}`)?.classList.add('active');
  document.querySelector(`[data-page="${id}"]`)?.classList.add('active');
  _currentPage = id;
  const titles = { dashboard:'Dashboard', search:'Search User Data', requests:'Service Requests', users:'Users', plans:'Pricing Plans', reviews:'Reviews', payments:'Payments', settings:'Settings' };
  document.getElementById('topbarTitle').textContent = titles[id] || id;
  // Persist section in URL hash so F5 restores it
  history.replaceState(null, '', '#' + id);
  closeSidebar();

  // Call the specific endpoints when clicking on sections
  if (!skipLoad) {
    if (id === 'users') {
      const searchInput = document.getElementById('userSearch');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
      }
      loadUsers(_userPage, false, false);
    } else if (id === 'requests') {
      const searchInput = document.getElementById('reqSearch');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
      }
      loadRequests(_reqPage, false, false);
    } else if (id === 'plans') {
      loadPlans(false);
    } else if (id === 'reviews') {
      const searchInput = document.getElementById('revSearch');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
      }
      loadReviews(_revPage, false, false);
    } else if (id === 'payments') {
      const searchInput = document.getElementById('paySearch');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
      }
      loadPaymentsTelemetry(false, false);
    } else if (id === 'dashboard') {
      loadDashboardConsolidated(false);
    }
  }
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

// ── XSS Helper ──────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
    const url = data.download_url || data.url || data.presigned_url;

    if (!url) throw new Error('No URL');

    // THIS is what triggers download
    window.location.href = url;

  } catch (e) {
    toast('Failed to get download link', 'error');
  }
}

async function previewFileById(reqId, fileId, filename) {
  if (!fileId) {
    toast('File ID missing', 'error');
    return;
  }

  const newWin = window.open('about:blank', '_blank');

  try {
    const data = await apiFetch(`/api/v1/admin/requests/${reqId}/files/${fileId}`);
    const url = data.url || data.presigned_url;

    if (!url) throw new Error('No URL');

    newWin.location.href = url;

  } catch (e) {
    if (newWin) newWin.close();
    console.error('Preview error:', e);
    toast('Failed to get preview link', 'error');
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

// ── UI Updaters ──────────────────────────────────────────────────
function updatePaymentsUI(data) {
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
}

function updateStorageUI(data) {
  const mb  = data.used_mb  ?? 0;
  const gb  = data.used_gb  ?? 0;
  const pct = data.usage_percent ?? 0;
  const rem = data.remaining_gb ?? 0;
  const files = data.total_files ?? 0;
  const displayVal = gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  
  const valEl = document.getElementById('statStorageVal');
  if (valEl) valEl.textContent = displayVal;
  
  const subEl = document.getElementById('statStorageSub');
  if (subEl) subEl.textContent = `${files} file${files!==1?'s':''} · ${rem.toFixed(2)} GB free`;
  
  const pctEl = document.getElementById('statStoragePct');
  if (pctEl) pctEl.textContent = `${pct.toFixed(1)}%`;
  
  const bar = document.getElementById('statStorageBar');
  if (bar) {
    bar.style.width = `${Math.min(pct, 100)}%`;
    bar.className = 'storage-bar-fill' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');
  }
}

function updateEmailsUI(data) {
  const thisMonth  = data.monthly_count ?? 0;
  const thisDay    = data.daily_count   ?? 0;
  const monthLimit = data.month_limit   ?? null;
  const dayLimit   = data.day_limit     ?? null;

  const valEl = document.getElementById('statEmailsVal');
  if (valEl) valEl.textContent = thisMonth.toLocaleString();

  // Month stats
  const monthPctVal = monthLimit ? Math.min((thisMonth / monthLimit) * 100, 100) : (thisMonth > 0 ? 100 : 0);
  const monthPctText = monthLimit ? `${thisMonth.toLocaleString()} / ${monthLimit.toLocaleString()} (${Math.round(monthPctVal)}%)` : thisMonth.toLocaleString();
  const elMonthPct = document.getElementById('statEmailMonthPct');
  if (elMonthPct) elMonthPct.textContent = monthPctText;

  const monthBar = document.getElementById('statEmailMonthBar');
  if (monthBar) {
    monthBar.style.width = `${monthPctVal}%`;
    monthBar.className = 'storage-bar-fill' + (monthLimit && monthPctVal >= 90 ? ' danger' : monthLimit && monthPctVal >= 70 ? ' warn' : '');
  }

  // Daily stats
  const dayPctVal = dayLimit ? Math.min((thisDay / dayLimit) * 100, 100) : (thisDay > 0 ? 100 : 0);
  const dayPctText = dayLimit ? `${thisDay.toLocaleString()} / ${dayLimit.toLocaleString()} (${Math.round(dayPctVal)}%)` : thisDay.toLocaleString();
  const elDayPct = document.getElementById('statEmailDayPct');
  if (elDayPct) elDayPct.textContent = dayPctText;

  const dayBar = document.getElementById('statEmailDayBar');
  if (dayBar) {
    dayBar.style.width = `${dayPctVal}%`;
    dayBar.className = 'storage-bar-fill' + (dayLimit && dayPctVal >= 90 ? ' danger' : dayLimit && dayPctVal >= 70 ? ' warn' : '');
  }
}

// ── Consolidated Dashboard Loading ──────────────────────────────
async function loadDashboardConsolidated(forceRefresh = false) {
  const path = '/api/v1/admin/dashboard';
  try {
    await swrFetch(path, forceRefresh, (data) => {
      // 1. Populate all states
      if (data.users) {
        _users = data.users.items || (Array.isArray(data.users) ? data.users : []);
        _totalUsers = data.users.metrics?.total_users ?? _users.length;
      }
      if (data.plans) {
        _plans = Array.isArray(data.plans) ? data.plans : [];
      }
      if (data.requests) {
        const reqItems = data.requests.items || (Array.isArray(data.requests) ? data.requests : []);
        _requests = reqItems.map(r => ({ ...r, id: r.request_id || r.id }));
        _totalRequests = data.requests.metrics?.total_requests ?? _requests.length;
      }
      if (data.reviews) {
        _reviews = data.reviews.items || (Array.isArray(data.reviews) ? data.reviews : []);
        _totalReviews = data.reviews.metrics?.total_reviews ?? _reviews.length;
      }
      if (data.payments) {
        _payments = data.payments.items || (Array.isArray(data.payments) ? data.payments : []);
        updatePaymentsUI(data.payments);
      }
      if (data.plans_distribution) {
        _planDistributionData = data.plans_distribution;
      }
      if (data.storage) {
        updateStorageUI(data.storage);
      }
      if (data.emails) {
        updateEmailsUI(data.emails);
      }
      
      // 2. Render and Sync
      renderDashboard();
      updateUserCount();
      updateRequestStats();
      updateReviewStats();
      populatePlanFilter();
      populatePlanDropdown();

      // Render details metrics directly from consolidated response metrics
      renderDashboardMetrics(data);
      
      // If we are currently on a page other than dashboard, make sure to render its table as well
      if (_currentPage === 'users') renderUsersTable(_users);
      else if (_currentPage === 'requests') renderRequests(_requests);
      else if (_currentPage === 'plans') renderPlansAdmin(_plans);
      else if (_currentPage === 'reviews') renderReviews(_reviews);
      else if (_currentPage === 'payments') renderPaymentsTable(_payments);
    });
  } catch (e) {
    console.error('Failed to load consolidated dashboard data:', e);
  }
}

function renderDashboardMetrics(data) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // 1. Users Metrics
  if (data.users && data.users.metrics) {
    const m = data.users.metrics;
    setVal('statUsers', m.total_users ?? '—');
    setVal('sidebarUserCount', m.total_users ?? '—');
    setVal('statUsersActive', m.active_users ?? '—');
    setVal('statUsersInactive', m.inactive_users ?? '—');
    setVal('statUsersVerified', m.verified_users ?? '—');
    setVal('statUsersUnverified', m.unverified_users ?? '—');

    const usersSubEl = document.getElementById('statUsersSub');
    if (usersSubEl) {
      usersSubEl.innerHTML = `${m.active_users ?? 0} active &middot; ${m.verified_users ?? 0} verified`;
    }
    const usersBar = document.getElementById('statUsersBar');
    if (usersBar) {
      const activeUsersPct = m.total_users ? Math.min(((m.active_users || 0) / m.total_users) * 100, 100) : 0;
      usersBar.style.width = `${activeUsersPct}%`;
    }
  }

  // 2. Payments / Plans Metrics
  if (data.payments && data.payments.metrics) {
    const m = data.payments.metrics;
    setVal('statActive', m.paid_payments ?? '—');
    setVal('statPlansMonthly', m.monthly_payments ?? '—');
    setVal('statPlansYearly', m.yearly_payments ?? '—');
    setVal('statPlansTotalPayments', m.total_payments ?? '—');
    setVal('statPlansRejected', m.rejected_payments ?? '—');
    
    // Revenue Card Sub-details
    if (m.revenue_this_month !== undefined) {
      setVal('statRevMonth', typeof m.revenue_this_month === 'number' ? m.revenue_this_month.toFixed(3) : m.revenue_this_month);
    }
    setVal('statPayThisMonth', m.payments_this_month ?? '—');

    const plansSubEl = document.getElementById('statPlansSub');
    if (plansSubEl) {
      plansSubEl.innerHTML = `${m.monthly_payments ?? 0} monthly &middot; ${m.yearly_payments ?? 0} yearly`;
    }
    const plansBar = document.getElementById('statActiveBar');
    if (plansBar) {
      const paidPlansPct = m.total_payments ? Math.min(((m.paid_payments || 0) / m.total_payments) * 100, 100) : 0;
      plansBar.style.width = `${paidPlansPct}%`;
    }
  }

  // 3. Requests Metrics
  if (data.requests && data.requests.metrics) {
    const m = data.requests.metrics;
    setVal('statRequests', m.total_requests ?? '—');
    setVal('statPending', m.pending_requests ?? '—');
    setVal('statApproved', m.approved_requests ?? '—');
    setVal('statReqApprovedSub', m.approved_requests ?? '—');
    setVal('statReqPendingSub', m.pending_requests ?? '—');
    setVal('statReqRejectedSub', m.rejected_requests ?? '—');

    // Sync sidebar badge
    setVal('sidebarPendingCount', m.pending_requests || '—');
  }

  // 4. Reviews Metrics
  if (data.reviews && data.reviews.metrics) {
    const m = data.reviews.metrics;
    setVal('statReviewsVal', m.total_reviews ?? '—');
    setVal('statReviewsPublished', m.published_reviews ?? '—');
    setVal('statReviewsPending', m.pending_reviews ?? '—');

    // Sync sidebar badge
    setVal('sidebarReviewsCount', m.pending_reviews || '—');
  }
}

// ── Legacy small endpoints fallback logic ──────────────────────
async function loadPlanDistribution() {
  try {
    const data = await apiFetch('/api/v1/admin/users/plan-distribution');
    if (Array.isArray(data)) {
      _planDistributionData = data;
    } else if (data && typeof data === 'object') {
      _planDistributionData = Object.entries(data).map(([name, count]) => ({ name, count }));
    }
  } catch (e) {}
}

async function loadEmailsThisMonth() {
  try {
    const data = await apiFetch('/api/v1/admin/emails/sent-this-month');
    updateEmailsUI(data);
  } catch (e) {
    document.getElementById('statEmailsVal').textContent = '—';
  }
}

async function loadStorageUsage() {
  try {
    const data = await apiFetch('/api/v1/admin/storage/usage');
    updateStorageUI(data);
  } catch (e) {
    document.getElementById('statStorageVal').textContent = '—';
  }
}

async function loadAll() {
  // On initial load, call the consolidated dashboard endpoint
  // if the dashboard is not already loaded as the initial page.
  if (_currentPage !== 'dashboard') {
    await loadDashboardConsolidated(false);
  }
}


// ── USERS ────────────────────────────────────────────────────────
async function loadUsers(page, silent = false, forceRefresh = false) {
  if (_userLoading) return;
  _userLoading = true;
  _userPage = page || 1;
  
  const planEl = document.getElementById('planFilter');
  const statusEl = document.getElementById('statusFilter');
  const planVal = planEl ? planEl.value : '';
  const statusVal = statusEl ? statusEl.value : '';
  
  let path = `/api/v1/admin/users?page=${_userPage}`;
  if (planVal) {
    path += `&plan=${encodeURIComponent(planVal)}`;
  }
  if (statusVal) {
    path += `&status=${encodeURIComponent(statusVal)}`;
  }

  if (!silent) setUserPaginationLoading(true);
  try {
    const didRenderCache = await swrFetch(path, forceRefresh, (data) => {
      _users = data && Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : (data.results || data.users || []));
      _userHasMore = data && data.has_next !== undefined ? !!data.has_next : (_users.length === PAGE_LIMIT);
      _totalUsers = data?.metrics?.total_users ?? _users.length;
      renderUsersTable(_users);
      updateUserCount();
      populatePlanFilter();
      updateUserPagination();
    });
    if (didRenderCache) silent = true;
  } catch (e) {
    if (!silent) {
      _users = [];
      _totalUsers = 0;
      renderUsersTable([]);
    }
    toast('Could not load users — API not yet available', 'error');
  }
  _userLoading = false;
  if (!silent) setUserPaginationLoading(false);
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
    const namesFromUsers = _users.map(u => u.plan_name || u.plan || '').filter(Boolean);
    const namesFromPlans = _plans.map(p => p.name).filter(Boolean);
    const names = [...new Set([...namesFromUsers, ...namesFromPlans])];
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
    const name    = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '\u2014';
    const email   = u.email || '\u2014';
    const phone   = u.phone || u.phone_number || '\u2014';
    const userPlanObj = _plans.find(p => p.id === (u.current_plan_id || u.plan_id));
    const plan    = userPlanObj ? userPlanObj.name : (u.plan_name || u.plan || 'None');
    const status  = u.is_active === false ? 'inactive' : 'active';
    const joined  = fmtDate(u.date_joined || u.created_at);
    const uid     = u.id || u.user_id || '';
    const initials = name !== '\u2014' ? name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() : (email[0]||'?').toUpperCase();
    return `<div class="item-row">
      <div class="item-row-body">
        <div class="item-info-header">
          <div class="recent-avatar" style="width:42px;height:42px;font-size:.84rem;border-radius:10px;flex-shrink:0">${escapeHtml(initials)}</div>
          <div style="flex:1;min-width:0">
            <div class="item-info-title">${escapeHtml(name)}</div>
            <div class="item-info-sub">${escapeHtml(email)}</div>
          </div>
          <div>${statusBadge(status)}</div>
        </div>
        <div class="item-info-grid">
          <div class="item-info-field">
            <span class="item-info-label">User ID</span>
            <span class="item-info-value td-mono">#${escapeHtml(uid)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Phone</span>
            <span class="item-info-value">${escapeHtml(phone)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Plan</span>
            <span class="item-info-value">${escapeHtml(plan)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Joined</span>
            <span class="item-info-value">${escapeHtml(joined)}</span>
          </div>
        </div>
      </div>
      <div class="item-row-actions">
        <button class="act-btn act-btn-edit" data-uid="${escapeHtml(String(uid))}" data-action="edit-user">
          <i class="fas fa-user-edit" style="margin-right:4px;"></i>
          Edit User
        </button>
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" data-uid="${escapeHtml(String(uid))}" data-email="${escapeHtml(email)}" data-action="delete-user">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
          Delete User
        </button>
      </div>
    </div>`;
  }).join('');
  // Attach delegated click handlers (safe — no inline onclick)
  grid.querySelectorAll('[data-action="edit-user"]').forEach(btn => {
    btn.addEventListener('click', () => openEditUserById(btn.dataset.uid));
  });
  grid.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.uid, btn.dataset.email));
  });
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
    if (idx >= 0) { 
      _users[idx] = { ..._users[idx], ...payload }; 
      if (payload.current_plan_id) {
        const planObj = _plans.find(p => p.id === payload.current_plan_id);
        if (planObj) _users[idx].plan_name = planObj.name;
      }
      filterUsers(); // update table based on current filters
    }
    closeModal('editUserModal');
    toast('User updated successfully', 'success');
    loadPlanDistribution();
    loadUsers(_userPage, true, true);
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
    _totalUsers = Math.max(0, _totalUsers - 1);
    filterUsers();
    updateUserCount();
    toast('User deleted', 'info');
    loadPlanDistribution();
    loadStorageUsage();
    loadUsers(_userPage, true, true);
  } catch (e) {
    toast('Failed to delete user', 'error');
  }
}

// ── REQUESTS ─────────────────────────────────────────────────────
async function loadRequests(page, silent = false, forceRefresh = false) {
  if (_reqLoading) return;
  _reqLoading = true;
  _reqPage = page || 1;
  const path = `/api/v1/admin/requests?page=${_reqPage}`;
  if (!silent) setReqPaginationLoading(true);
  try {
    const didRenderCache = await swrFetch(path, forceRefresh, (data) => {
      _requests = data && Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : (data.results || data.requests || []));
      _requests = _requests.map(r => ({ ...r, id: r.request_id || r.id }));
      _reqHasMore = data && data.has_next !== undefined ? !!data.has_next : (_requests.length === PAGE_LIMIT);
      _totalRequests = data?.metrics?.total ?? _requests.length;
      renderRequests(_requests);
      updateRequestStats();
      updateReqPagination();
    });
    if (didRenderCache) silent = true;
  } catch (e) {
    if (!silent) {
      _requests = [];
      _totalRequests = 0;
      renderRequests(_requests);
      updateRequestStats();
    }
  }
  _reqLoading = false;
  if (!silent) setReqPaginationLoading(false);
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
    const name      = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || '\u2014';
    const firstName = user.first_name || '\u2014';
    const lastName  = user.last_name  || '\u2014';
    const phone     = user.phone || user.phone_number || '\u2014';
    const company   = user.company_name || user.company || req.company_name || '\u2014';
    const initials  = (name !== '\u2014' ? name : (user.email||'?')).split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();

    // File chips: use data-* attributes; onclick added via addEventListener after render
    const fileChips = files.map((f, fi) => {
      const fname  = f.filename || f.name || 'file.pdf';
      const sz     = fmtSize(f.size || 0);
      const fileId = f.file_id || f.id || '';
      const displayName = fname.length > 18 ? fname.slice(0,15)+'\u2026' : fname;
      return `<span class="file-chip" data-req-id="${escapeHtml(String(req.id))}" data-file-id="${escapeHtml(String(fileId))}" data-fname="${escapeHtml(fname)}" data-chip-index="${fi}" title="${escapeHtml(fname)}">
        <i class="fas fa-paperclip" style="margin-right:4px;"></i>
        ${escapeHtml(displayName)}
        ${sz ? `<span class="file-size">${escapeHtml(sz)}</span>` : ''}
      </span>`;
    }).join('');

    return `<div class="item-row" data-req-id="${escapeHtml(String(req.id))}">
      <div class="item-row-body">
        <div class="item-info-header">
          <div class="recent-avatar" style="width:42px;height:42px;font-size:.84rem;border-radius:10px;flex-shrink:0">${escapeHtml(initials)}</div>
          <div style="flex:1;min-width:0">
            <div class="item-info-title">${escapeHtml(name)}</div>
            <div class="item-info-sub">${escapeHtml(user.email||'\u2014')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">${typeChip(type)}${statusBadge(req.status)}</div>
        </div>
        <div class="item-info-grid">
          <div class="item-info-field">
            <span class="item-info-label">First Name</span>
            <span class="item-info-value strong">${escapeHtml(firstName)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Last Name</span>
            <span class="item-info-value strong">${escapeHtml(lastName)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Phone</span>
            <span class="item-info-value">${escapeHtml(phone)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Company</span>
            <span class="item-info-value">${escapeHtml(company)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Plan</span>
            <span class="item-info-value">${escapeHtml(plan)}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Request ID</span>
            <span class="item-info-value td-mono">#${escapeHtml(String(req.id))}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Submitted</span>
            <span class="item-info-value">${escapeHtml(fmtDate(req.created_at))}</span>
          </div>
        </div>
        ${files.length ? `<div class="item-info-files">
          <div class="item-info-files-label">Attached Files (${files.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${fileChips}</div>
        </div>` : ''}
      </div>
      <div class="item-row-actions">
        <button class="act-btn act-btn-view" data-req-id="${escapeHtml(String(req.id))}" data-action="view-req">
          <i class="fas fa-eye" style="margin-right:4px;"></i>
          View Details
        </button>
        ${req.status !== 'approved' ? `
        <button class="act-btn act-btn-approve" data-req-id="${escapeHtml(String(req.id))}" data-action="approve-req">
          <i class="fas fa-check" style="margin-right:4px;"></i>
          ${req.status === 'rejected' ? 'Re-Approve' : 'Approve'}
        </button>` : ''}
        ${req.status !== 'rejected' ? `
        <button class="act-btn act-btn-reject" data-req-id="${escapeHtml(String(req.id))}" data-action="reject-req">
          <i class="fas fa-ban" style="margin-right:4px;"></i>
          ${req.status === 'approved' ? 'Re-Reject' : 'Reject'}
        </button>` : ''}
        ${req.status !== 'pending' ? `
        <button class="act-btn act-btn-pending" data-req-id="${escapeHtml(String(req.id))}" data-action="pending-req">
          <i class="fas fa-clock" style="margin-right:4px;"></i>
          Set Pending
        </button>` : ''}
        ${files.length ? `<button class="act-btn act-btn-download" data-req-id="${escapeHtml(String(req.id))}" data-action="download-all-req">
          <i class="fas fa-download" style="margin-right:4px;"></i>
          Download All (${files.length})
        </button>` : ''}
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" data-req-id="${escapeHtml(String(req.id))}" data-action="delete-req">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
  // Bind request card events safely via addEventListener
  grid.querySelectorAll('[data-action="view-req"]').forEach(b => b.addEventListener('click', () => viewRequest(Number(b.dataset.reqId))));
  grid.querySelectorAll('[data-action="approve-req"]').forEach(b => b.addEventListener('click', () => approveRequest(Number(b.dataset.reqId))));
  grid.querySelectorAll('[data-action="reject-req"]').forEach(b => b.addEventListener('click', () => openRejectModal(Number(b.dataset.reqId))));
  grid.querySelectorAll('[data-action="pending-req"]').forEach(b => b.addEventListener('click', () => setPendingRequest(Number(b.dataset.reqId))));
  grid.querySelectorAll('[data-action="download-all-req"]').forEach(b => b.addEventListener('click', () => downloadAllFiles(Number(b.dataset.reqId))));
  grid.querySelectorAll('[data-action="delete-req"]').forEach(b => b.addEventListener('click', () => confirmDeleteRequest(Number(b.dataset.reqId))));
  grid.querySelectorAll('.file-chip[data-chip-index]').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      previewFileById(Number(chip.dataset.reqId), chip.dataset.fileId, chip.dataset.fname);
    });
  });
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
      loadRequests(_reqPage, true, true);
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
      loadRequests(_reqPage, true, true);
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
      loadRequests(_reqPage, true, true);
    } catch (e) {
      toast('Failed to reject request', 'error');
    }
  });
}

function viewRequest(reqId) {
  const req = _requests.find(r => String(r.id) === String(reqId));
  if (!req) return;
  const user  = req.user || {};
  const type  = req.request_type || req.type || 'unknown';
  const files = req.files || [];
  const name  = user.full_name || [user.first_name,user.last_name].filter(Boolean).join(' ') || user.email || '—';

  document.getElementById('viewReqTitle').textContent = `Request #${req.id}`;
  document.getElementById('viewReqSubtitle').textContent = `${type === 'partnership' ? 'Operational Partnership' : 'Feasibility Study'} — ${fmtDate(req.created_at)}`;

  // Build file cards using data-* so fname never touches an onclick string
  const fileCardElements = files.map((f, fi) => {
    const fname  = f.filename || f.name || 'file.pdf';
    const fsize  = fmtSize(f.size||0);
    const fdate  = fmtDate(f.uploaded_at||f.upload_date);
    const fileId = f.file_id || f.id || '';
    return `<div style="background:var(--bg2);border:1.5px solid var(--border);border-radius:9px;padding:10px 12px;display:flex;align-items:center;gap:9px;min-width:200px;flex:1">
          <div style="width:34px;height:34px;border-radius:8px;background:var(--red-dim);color:var(--red);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer" data-action="preview-file" data-req-id="${escapeHtml(String(req.id))}" data-file-id="${escapeHtml(String(fileId))}" data-fname="${escapeHtml(fname)}" title="${escapeHtml(fname)}">
            <i class="fas fa-file-pdf"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.81rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(fname)}</div>
            <div style="font-size:.72rem;color:var(--text-3)">${escapeHtml([fsize,fdate].filter(Boolean).join(' \u00b7 '))}</div>
          </div>
          <button class="btn-icon download btn-xs" data-action="download-file" data-req-id="${escapeHtml(String(req.id))}" data-file-id="${escapeHtml(String(fileId))}" data-fname="${escapeHtml(fname)}" title="${escapeHtml(fname)}">
            <i class="fas fa-download"></i>
          </button>
        </div>`;
  });
  const fileCards = files.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${fileCardElements.join('')}</div>`
    : '<p style="font-size:.83rem;color:var(--text-3)">No files attached to this request.</p>';

  const notesSection = req.admin_notes
    ? `<div style="margin-top:14px"><div class="detail-label" style="margin-bottom:5px">Admin Notes</div><div class="notes-box">${escapeHtml(req.admin_notes)}</div></div>` : '';
  const rejSection = req.rejection_reason
    ? `<div style="margin-top:10px"><div class="detail-label" style="margin-bottom:5px">Rejection Reason</div><div class="notes-box rejection-note">${escapeHtml(req.rejection_reason)}</div></div>` : '';

  document.getElementById('viewReqBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:18px">
      <div><div class="detail-label">User</div><div class="detail-value">${escapeHtml(name)}</div></div>
      <div><div class="detail-label">Email</div><div class="detail-value">${escapeHtml(user.email||'\u2014')}</div></div>
  
      <div><div class="detail-label">Status</div><div>${statusBadge(req.status)}</div></div>
      <div><div class="detail-label">Type</div><div>${typeChip(type)}</div></div>
      <div><div class="detail-label">Submitted</div><div class="detail-value">${escapeHtml(fmtDate(req.created_at))}</div></div>
    </div>
    <div class="detail-label" style="margin-bottom:8px">Uploaded Files (${files.length})</div>
    ${fileCards}
    ${notesSection}${rejSection}`;

  // Bind file card events safely after innerHTML is set
  document.querySelectorAll('#viewReqBody [data-action="preview-file"]').forEach(el => {
    el.addEventListener('click', () => previewFileById(Number(el.dataset.reqId), el.dataset.fileId, el.dataset.fname));
  });
  document.querySelectorAll('#viewReqBody [data-action="download-file"]').forEach(el => {
    el.addEventListener('click', () => downloadFileById(Number(el.dataset.reqId), el.dataset.fileId, el.dataset.fname));
  });

  const footer = document.getElementById('viewReqFooter');
  footer.innerHTML = '';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => closeModal('viewReqModal'));
  footer.appendChild(closeBtn);

  if (req.status !== 'approved') {
    const approveBtn = document.createElement('button');
    approveBtn.className = 'btn btn-green';
    approveBtn.innerHTML = '<i class="fas fa-check" style="margin-right:4px;"></i>' + (req.status === 'rejected' ? 'Re-Approve' : 'Approve');
    approveBtn.addEventListener('click', () => { closeModal('viewReqModal'); approveRequest(req.id); });
    footer.appendChild(approveBtn);
  }
  if (req.status !== 'rejected') {
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn btn-danger';
    rejectBtn.textContent = req.status === 'approved' ? 'Re-Reject' : 'Reject';
    rejectBtn.addEventListener('click', () => { closeModal('viewReqModal'); openRejectModal(req.id); });
    footer.appendChild(rejectBtn);
  }
  if (req.status !== 'pending') {
    const pendingBtn = document.createElement('button');
    pendingBtn.className = 'btn btn-ghost';
    pendingBtn.innerHTML = '<i class="fas fa-clock" style="margin-right:4px;"></i>Set Pending';
    pendingBtn.addEventListener('click', () => { closeModal('viewReqModal'); setPendingRequest(req.id); });
    footer.appendChild(pendingBtn);
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
    loadStorageUsage();
    loadRequests(_reqPage, true, true);
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
  const path = '/api/v1/plans/';
  try {
    await swrFetch(path, forceRefetch, (data) => {
      _plans = Array.isArray(data) ? data : (data.items || data.results || data.plans || []);
      renderPlansAdmin(_plans);
      syncPlanCounters();
      populatePlanDropdown();
    });
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
          ? `<span style="color:var(--text-2)">${escapeHtml(String(feature.price))} KWD</span><span style="color:var(--border);margin:0 3px">\u00b7</span>`
          : '';
        return `<li style="list-style:none;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;align-items:center;gap:6px;font-size:.75rem">
          <div class="feat-dot ${statusClass}" style="flex-shrink:0"></div>
          <span style="font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(nameEn)}</span>
          <span style="color:var(--border);margin:0 1px;flex-shrink:0">\u00b7</span>
          <span style="display:inline-flex;align-items:center;flex-shrink:0">${priceSegment}<span style="color:var(--text-3)">${statusText}</span></span>
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
            <div class="feat-dot ${statusClass}" style="flex-shrink:0"></div>
            <span style="font-weight:600;color:var(--text);text-transform:capitalize;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(nameEn)}</span>
            <span style="color:var(--border);margin:0 1px;flex-shrink:0">\u00b7</span>
            <span style="color:var(--text-3);flex-shrink:0">${statusText}</span>
          </li>`;
        }).join('');
      }
 
    return `<div class="plan-admin-card${plan.name === 'Pro' ? ' featured' : ''}">
      <div class="plan-card-top">
        <div>
          <div class="plan-card-name">${escapeHtml(plan.name)}</div>
          <div class="plan-card-id">ID: ${escapeHtml(String(plan.id))}</div>
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
        <button class="btn btn-ghost btn-sm" style="flex:1" data-action="edit-plan" data-plan-id="${escapeHtml(String(plan.id))}">
          <i class="fas fa-edit" style="margin-right:4px;"></i>
          Edit
        </button>
        <button class="btn btn-danger btn-sm" data-action="delete-plan" data-plan-id="${escapeHtml(String(plan.id))}" data-plan-name="${escapeHtml(plan.name)}">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-action="edit-plan"]').forEach(b => {
    b.addEventListener('click', () => openEditPlanById(Number(b.dataset.planId)));
  });
  grid.querySelectorAll('[data-action="delete-plan"]').forEach(b => {
    b.addEventListener('click', () => confirmDeletePlan(Number(b.dataset.planId), b.dataset.planName));
  });
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
async function loadReviews(page, silent = false, forceRefresh = false) {
  if (_revLoading) return;
  _revLoading = true;
  _revPage = page || 1;
  const path = `/api/v1/admin/reviews?page=${_revPage}`;
  if (!silent) setRevPaginationLoading(true);
  try {
    const didRenderCache = await swrFetch(path, forceRefresh, (data) => {
      const rawReviews = data && Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : (data.results || data.reviews || []));
      _reviews = rawReviews;
      _revHasMore = data && data.has_next !== undefined ? !!data.has_next : (rawReviews.length === PAGE_LIMIT);
      _totalReviews = data && data.metrics && data.metrics.total_reviews !== undefined ? data.metrics.total_reviews : (data && data.total !== undefined ? data.total : _reviews.length);
      _filterReviewsNow();
      updateReviewStats();
      updateRevPagination();
    });
    if (didRenderCache) silent = true;
  } catch (e) {
    if (!silent) {
      _reviews = [];
      _totalReviews = 0;
      renderReviews(_reviews);
      updateReviewStats();
    }
  }
  _revLoading = false;
  if (!silent) setRevPaginationLoading(false);
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
    const name       = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '\u2014';
    const email      = user.email || '\u2014';
    const status     = rev.status || (rev.is_published ? 'accepted' : 'pending');
    const rating     = rev.stars || rev.rating || 0;
    const reviewText = rev.review_text || rev.text || rev.comment || rev.body || '\u2014';
    const initials   = name !== '\u2014' ? name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() : (email[0]||'?').toUpperCase();
    const badgeHtml  = status === 'accepted'
      ? '<span class="badge badge-green"><span class="badge-dot"></span>Accepted</span>'
      : '<span class="badge badge-yellow"><span class="badge-dot"></span>Pending</span>';
    return `<div class="item-row" id="rev-row-${escapeHtml(String(rev.id))}">
      <div class="item-row-body">
        <div class="item-info-header">
          <div class="recent-avatar" style="width:42px;height:42px;font-size:.84rem;border-radius:10px;flex-shrink:0">${escapeHtml(initials)}</div>
          <div style="flex:1;min-width:0">
            <div class="item-info-title">${escapeHtml(name)}</div>
            <div class="item-info-sub">${escapeHtml(email)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="review-stars">${starRating(rating)}<span style="margin-left:5px;font-size:.8rem;font-weight:600;color:var(--text-2)">${escapeHtml(String(rating))}/5</span></div>
            ${badgeHtml}
          </div>
        </div>
        <div class="item-info-grid" style="margin-bottom:10px">
          <div class="item-info-field">
            <span class="item-info-label">Review ID</span>
            <span class="item-info-value td-mono">#${escapeHtml(String(rev.id))}</span>
          </div>
          <div class="item-info-field">
            <span class="item-info-label">Submitted</span>
            <span class="item-info-value">${escapeHtml(fmtDate(rev.created_at))}</span>
          </div>
        </div>
        <div class="item-review-text">${escapeHtml(reviewText)}</div>
      </div>
      <div class="item-row-actions">
        ${status !== 'accepted' ? `<button class="act-btn act-btn-accept" data-rev-id="${escapeHtml(String(rev.id))}" data-action="accept-rev">
          <i class="fas fa-check" style="margin-right:4px;"></i>
          Approve
        </button>` : `<button class="act-btn" style="color:var(--text-2);" data-rev-id="${escapeHtml(String(rev.id))}" data-action="pending-rev">
          <i class="fas fa-clock" style="margin-right:4px;"></i>
          Set Pending
        </button>`}
        <div class="spacer"></div>
        <button class="act-btn act-btn-delete" data-rev-id="${escapeHtml(String(rev.id))}" data-action="delete-rev">
          <i class="fas fa-trash-alt" style="margin-right:4px;"></i>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-action="accept-rev"]').forEach(b => b.addEventListener('click', () => acceptReview(Number(b.dataset.revId))));
  grid.querySelectorAll('[data-action="pending-rev"]').forEach(b => b.addEventListener('click', () => pendingReview(Number(b.dataset.revId))));
  grid.querySelectorAll('[data-action="delete-rev"]').forEach(b => b.addEventListener('click', () => confirmDeleteReview(Number(b.dataset.revId))));
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
    loadReviews(_revPage, true, true);
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
    loadReviews(_revPage, true, true);
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
    loadReviews(_revPage, true, true);
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
    const DASHBOARD_COLORS = ['#A9802F', '#3F7A5C', '#7A6BAE', '#D8D2C4', '#b8862e', '#a8503f'];
    function getColor(name) {
      if (name.toLowerCase() === 'none' || name.toLowerCase() === 'no plan') return '#D8D2C4';
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      return DASHBOARD_COLORS[Math.abs(hash) % DASHBOARD_COLORS.length];
    }

    const C = 2 * Math.PI * 46; // Circumference of radius 46 ~ 289.0265
    let accumulated = 0;
    
    const slices = entries.map(([name, count]) => {
      const pct = Math.round(count / total * 100);
      const len = (count / total) * C;
      const offset = -accumulated;
      accumulated += len;
      const color = getColor(name);
      return { name, count, pct, len, offset, color };
    });

    const circlesHtml = slices.map(s => {
      return `<circle cx="60" cy="60" r="46" fill="none" stroke="${s.color}" stroke-width="16"
                stroke-dasharray="${s.len.toFixed(1)} ${(C - s.len).toFixed(1)}"
                stroke-dashoffset="${s.offset.toFixed(1)}"
                transform="rotate(-90 60 60)" style="transition: stroke-dashoffset 0.3s ease;">
                <title>${escapeHtml(s.name)}: ${s.count} user${s.count!==1?'s':''} (${s.pct}%)</title>
              </circle>`;
    }).join('');

    const legend = slices.map(s =>
      `<div class="legend-item">
        <span class="sw" style="background:${escapeHtml(s.color)}"></span>
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="pct">${s.pct}%</span>
      </div>`
    ).join('');

    distEl.innerHTML = `
      <div class="donut-wrap">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="46" fill="none" stroke="#EFEAE0" stroke-width="16"/>
          ${circlesHtml}
          <text x="60" y="64" text-anchor="middle" font-family="Cormorant Garamond" font-weight="600" font-size="20" fill="var(--text)">${total}</text>
        </svg>
        <div class="legend">
          ${legend}
        </div>
      </div>`;
  }

  // Recent signups
  const sorted = [..._users].sort((a,b) => new Date(b.date_joined||b.created_at||0)-new Date(a.date_joined||a.created_at||0)).slice(0,5);
  const recentEl = document.getElementById('recentSignups');
  if (recentEl) {
    recentEl.innerHTML = sorted.length
      ? sorted.map(u => {
          const n = [u.first_name,u.last_name].filter(Boolean).join(' ') || (u.email||'?');
          const initials = n !== '?' ? n.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() : (u.email ? u.email[0].toUpperCase() : '?');
          return `<div class="row-item">
            <div class="sq-avatar" style="background:#1C1A17">${escapeHtml(initials)}</div>
            <div class="row-meta">
              <div class="row-name">${escapeHtml(u.email || n)}</div>
              <div class="row-sub">Joined ${escapeHtml(fmtDate(u.date_joined||u.created_at))}</div>
            </div>
          </div>`;
        }).join('')
      : '<p style="color:var(--text-3);font-size:.82rem;padding:16px 0;text-align:center">No users yet</p>';
  }

  // Pending requests widget
  const pending = _requests.filter(r => r.status === 'pending').slice(0, 5);
  const pendEl = document.getElementById('dashPendingList');
  if (pendEl) {
    function getRequestColor(type) {
      if (type === 'partnership') return '#3F7A5C';
      return '#A9802F';
    }
    pendEl.innerHTML = pending.length
      ? pending.map(req => {
          const user = req.user || {};
          const type = req.request_type || req.type || 'unknown';
          const name = user.email || user.full_name || `User #${escapeHtml(String(user.id))}`;
          const initials = (name[0] || '?').toUpperCase() + (name[1] || '').toUpperCase();
          const typeLabel = type==='partnership'?'Operational Partnership':'Feasibility Study';
          const color = getRequestColor(type);
          return `<div class="row-item">
            <div class="sq-avatar" style="background:${color}">${escapeHtml(initials)}</div>
            <div class="row-meta">
              <div class="row-name">${escapeHtml(name)}</div>
              <div class="row-sub">${escapeHtml(typeLabel)} &middot; ${escapeHtml(fmtDate(req.created_at))}</div>
            </div>
            <div class="badge view" data-req-id="${escapeHtml(String(req.id))}" data-action="dash-view-req">View</div>
          </div>`;
        }).join('')
      : `<div style="text-align:center;padding:24px 0;color:var(--text-3)">
          <i class="fas fa-check" style="font-size:1.5rem;color:var(--green);margin-bottom:8px;display:block"></i>
          <p style="font-size:.82rem">All caught up — no pending requests</p>
        </div>`;
    // Bind dashboard pending-list view buttons
    pendEl.querySelectorAll('[data-action="dash-view-req"]').forEach(b => {
      b.addEventListener('click', async () => {
        const reqId = isNaN(b.dataset.reqId) ? b.dataset.reqId : Number(b.dataset.reqId);
        const reqObj = pending.find(r => String(r.id) === String(reqId));
        const email = reqObj && reqObj.user ? reqObj.user.email : '';
        if (email) {
          showPage('requests', true);
          const searchInput = document.getElementById('reqSearch');
          if (searchInput) searchInput.value = email;
          await executeSectionSearch(email, 'request');
          viewRequest(reqId);
        } else {
          showPage('requests');
          setTimeout(() => viewRequest(reqId), 150);
        }
      });
    });
  }

  // Pending reviews widget
  const pendingReviews = _reviews.filter(r => r.status === 'pending' || !r.is_published).slice(0, 5);
  const pendRevEl = document.getElementById('dashPendingReviewsList');
  if (pendRevEl) {
    pendRevEl.innerHTML = pendingReviews.length
      ? pendingReviews.map(rev => {
          const user = rev.user || {};
          const name = user.email || `User #${escapeHtml(String(rev.user_id))}`;
          const text = rev.review_text || '';
          const initials = (name[0] || '?').toUpperCase();
          const starsHtml = starRating(rev.stars);
          return `<div class="row-item">
            <div class="sq-avatar" style="background:#A8503F">${escapeHtml(initials)}</div>
            <div class="row-meta">
              <div class="row-name">${escapeHtml(name)}</div>
              <div class="row-sub">${starsHtml} "${escapeHtml(text.slice(0, 36))}${text.length > 36 ? '...' : ''}"</div>
            </div>
            <div class="badge view" data-rev-id="${escapeHtml(String(rev.id))}" data-action="dash-view-rev">View</div>
          </div>`;
        }).join('')
      : `<div style="text-align:center;padding:24px 0;color:var(--text-3)">
          <i class="fas fa-check" style="font-size:1.5rem;color:var(--green);margin-bottom:8px;display:block"></i>
          <p style="font-size:.82rem">All caught up — no pending reviews</p>
        </div>`;
    // Bind dashboard pending-reviews-list view buttons
    pendRevEl.querySelectorAll('[data-action="dash-view-rev"]').forEach(b => {
      b.addEventListener('click', async () => {
        const revId = isNaN(b.dataset.revId) ? b.dataset.revId : Number(b.dataset.revId);
        const revObj = pendingReviews.find(r => String(r.id) === String(revId));
        const email = revObj && revObj.user ? revObj.user.email : '';
        if (email) {
          showPage('reviews', true);
          const searchInput = document.getElementById('revSearch');
          if (searchInput) searchInput.value = email;
          await executeSectionSearch(email, 'review');
        } else {
          showPage('reviews');
        }
      });
    });
  }

}

// ── Refresh ──────────────────────────────────────────────────────
// ── Refresh ──────────────────────────────────────────────────────
async function refreshAll() {
  toast('Refreshing data…', 'info');
  try {
    if (_currentPage === 'dashboard') {
      await loadDashboardConsolidated(true);
    } else if (_currentPage === 'users') {
      await loadUsers(_userPage, false, true);
    } else if (_currentPage === 'requests') {
      await loadRequests(_reqPage, false, true);
    } else if (_currentPage === 'plans') {
      await loadPlans(true);
    } else if (_currentPage === 'reviews') {
      await loadReviews(_revPage, false, true);
    } else if (_currentPage === 'payments') {
      await loadPaymentsTelemetry(false, true);
    } else {
      await loadAll();
    }
    toast('Data refreshed successfully', 'success');
  } catch (err) {
    console.error('Refresh error:', err);
    toast('Failed to refresh data', 'error');
  }
}

// ── Settings ─────────────────────────────────────────────────────
function saveSettings() {
  API = document.getElementById('settingsApiBase').value.trim().replace(/\/$/, '');
  localStorage.setItem('badia_admin_api', API);
  toast('Settings saved', 'success');
}

// ── Logout ───────────────────────────────────────────────────────
async function handleLogout() {
  try {
    await fetch(`${API}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    });
  } catch (e) {
    // Even if the request fails, still redirect
  }
  clearUserDataCache();
  window.location.href = 'index.html';
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('settingsApiBase').value = API;

  // Restore section from URL hash (e.g. admin.html#plans survives F5)
  const hash = (location.hash || '').replace('#', '').trim();
  const validPages = ['dashboard','search','requests','users','plans','reviews','payments','settings'];
  const initialPage = (hash && validPages.includes(hash)) ? hash : 'dashboard';
  showPage(initialPage);

  // Keyboard: Esc closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
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
  document.getElementById('createConfirmModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeCreateConfirm();
  });

  // Keypress listener for section search inputs
  ['userSearch', 'reqSearch', 'revSearch', 'paySearch'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const type = id === 'userSearch' ? 'user' : (id === 'reqSearch' ? 'request' : (id === 'revSearch' ? 'review' : 'payment'));
        executeSectionSearch(input.value.trim(), type);
      }
    });
  });

  // Init
  window.addEventListener('load', () => {
    setTimeout(loadAll, 0);
  });
});

async function loadPaymentsTelemetry(silent = false, forceRefresh = false) {
  if (_payLoading) return;
  _payLoading = true;
  const path = `/api/v1/admin/payments?page=${_payPage}`;
  if (!silent) setPayPaginationLoading(true);
  try {
    const didRenderCache = await swrFetch(path, forceRefresh, (data) => {
      const items = data && Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : (data.results || data.payments || []));
      _payments = items;
      _payHasMore = data && data.has_next !== undefined ? !!data.has_next : (_payments.length === PAGE_LIMIT);
      
      const metrics = data.metrics || {};
      _totalPayments = metrics.total_payments ?? (data.total ?? _payments.length);

      updatePaymentsUI(data);
      updatePayPagination();
    });
    if (didRenderCache) silent = true;
  } catch(e) {
    const totalEl = document.getElementById('payStatTotal');
    if (totalEl) totalEl.textContent = '—';
    console.error('Failed to load payments telemetry:', e);
  } finally {
    _payLoading = false;
    if (!silent) setPayPaginationLoading(false);
    updatePayPagination();
  }
}

function updatePayPagination() {
  const pageNumEl = document.getElementById('payPageNum');
  const infoEl = document.getElementById('payPaginationInfo');
  const prevBtn = document.getElementById('payPrevBtn');
  const nextBtn = document.getElementById('payNextBtn');

  if (pageNumEl) pageNumEl.textContent = _payPage;
  if (infoEl) {
    const total = _totalPayments !== undefined ? _totalPayments : _payments.length;
    infoEl.textContent = `Page ${_payPage} · ${_payments.length} of ${total} shown`;
  }
  if (prevBtn) prevBtn.disabled = _payPage <= 1;
  if (nextBtn) nextBtn.disabled = !_payHasMore;
}

function setPayPaginationLoading(on) {
  const info = document.getElementById('payPaginationInfo');
  if (on && info) {
    info.innerHTML = '<span class="pagination-loading"><span class="pagination-spinner"></span>Loading…</span>';
  }
}

async function changePayPage(page) {
  if (page < 1 || _payLoading) return;
  if (page > _payPage && !_payHasMore) return;
  _payPage = page;
  await loadPaymentsTelemetry(false, false);
  document.getElementById('page-payments').scrollIntoView({ behavior:'smooth', block:'start' });
}

let _lookupTimeout = null;
let _selectedUserId = null;

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
          resultEl.textContent = `\u2713 User found: ${name} (ID: ${user.id})`;
          resultEl.style.color = 'var(--green)';
        }
        if (createBtn) createBtn.disabled = false;
        
        autoFillPlanAmount();
      } else {
        _selectedUserId = null;
        if (resultEl) {
          resultEl.textContent = '\u2717 User not found';
          resultEl.style.color = 'var(--red)';
        }
        if (createBtn) createBtn.disabled = true;
      }
    } catch(e) {
      _selectedUserId = null;
      if (resultEl) {
        resultEl.textContent = '\u2717 User not found';
        resultEl.style.color = 'var(--red)';
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
  
  const monthlyPrice = parseFloat(plan.price_monthly ?? plan.monthly_price ?? 0);
  const yearlyPrice = parseFloat(plan.price_yearly ?? plan.yearly_price ?? 0);
  
  const selectedPrice = cycle === 'yearly' ? yearlyPrice : monthlyPrice;
  
  if (amountInput) {
    amountInput.value = selectedPrice;
  }
}

function checkDuplicatePaidPayment(email, excludePaymentId = null) {
  if (!email) return false;
  return _payments.some(p => {
    if (excludePaymentId && String(p.id) === String(excludePaymentId)) return false;
    let pEmail = p.user_email;
    if (!pEmail && p.user) pEmail = p.user.email;
    if (!pEmail && p.user_id) {
      const u = _users.find(usr => String(usr.id) === String(p.user_id));
      if (u) pEmail = u.email;
    }
    return pEmail && pEmail.toLowerCase() === email.toLowerCase() && p.status === 'paid';
  });
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
  if (!start || !end) {
    toast('Please fill all required fields', 'error');
    return;
  }

  if (checkDuplicatePaidPayment(email)) {
    toast('User already has an active paid payment', 'error');
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
    let planName = plan.name || '—';
    if (p.plan_id && !_plans.some(pln => pln.id === p.plan_id)) {
      planName = `[Deleted Plan #${p.plan_id}]`;
    }

    const name = p.name || p.user_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.company_name || '—';
    const email = p.email || p.user_email || u.email || '—';
    const status = p.status || 'pending';
    const initials = name !== '—' ? name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() : (email[0]||'?').toUpperCase();
    
    let statusClass = 'pending';
    if (status === 'paid') statusClass = 'paid';
    if (status === 'canceled' || status === 'rejected') statusClass = 'rejected';
    
    const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);

    // Build inline status action buttons using data-* (no onclick interpolation)
    let statusActions = '';
    if (status !== 'paid') {
      statusActions += `<button class="act-btn act-btn-approve" data-pay-id="${escapeHtml(String(p.id))}" data-new-status="paid" data-action="change-pay-status">
        <i class="fas fa-check" style="margin-right:4px;"></i>
        Mark Paid
      </button>`;
    }
    if (status !== 'rejected') {
      statusActions += `<button class="act-btn act-btn-reject" data-pay-id="${escapeHtml(String(p.id))}" data-new-status="rejected" data-action="change-pay-status">
        <i class="fas fa-ban" style="margin-right:4px;"></i>
        Reject
      </button>`;
    }
    if (status !== 'canceled') {
      statusActions += `<button class="act-btn act-btn-pending" data-pay-id="${escapeHtml(String(p.id))}" data-new-status="canceled" data-action="change-pay-status">
        <i class="fas fa-times-circle" style="margin-right:4px;"></i>
        Cancel
      </button>`;
    }

    return `<div class="payment-card">
      <div class="payment-card-header">
        <div class="payment-avatar">${escapeHtml(initials)}</div>
        <div class="payment-main" style="flex:1;min-width:0;">
          <div class="payment-top">
            <div class="payment-name">${escapeHtml(name)}</div>
            <span class="status-badge ${escapeHtml(statusClass)}"><span class="status-dot"></span>${escapeHtml(formattedStatus)}</span>
          </div>
          <div class="payment-email">${escapeHtml(email)}</div>
        </div>
      </div>
      <div class="payment-card-body">
        <div class="payment-meta">
          <div class="meta-item"><div class="meta-label">ID</div><div class="meta-value">#${escapeHtml(String(p.id))}</div></div>
          <div class="meta-item"><div class="meta-label">Plan</div><div class="meta-value">${escapeHtml(planName)}</div></div>
          <div class="meta-item"><div class="meta-label">Amount</div><div class="meta-value amount">${escapeHtml(String(p.amount))} KWD</div></div>
          <div class="meta-item"><div class="meta-label">Cycle</div><div class="meta-value">${escapeHtml(p.billing_cycle || '\u2014')}</div></div>
          <div class="meta-item"><div class="meta-label">Period</div><div class="meta-value">${escapeHtml(fmtDate(p.start_date))} \u2013 ${escapeHtml(fmtDate(p.end_date))}</div></div>
          <div class="meta-item"><div class="meta-label">Created</div><div class="meta-value">${escapeHtml(fmtDate(p.created_at))}</div></div>
        </div>
        <div class="payment-email-notice">
          <i class="fas fa-envelope"></i>
          <p><strong>Status changes send emails.</strong> Changing this payment's status will automatically notify the user via email.</p>
        </div>
      </div>
      <div class="payment-card-actions">
        ${statusActions}
        <button class="act-btn act-btn-view" data-pay-id="${escapeHtml(String(p.id))}" data-action="edit-payment">
          <i class="fas fa-edit" style="margin-right:4px;"></i>
          Edit
        </button>
        <div class="spacer"></div>
      </div>
    </div>`;
  }).join('');
  // Bind payment card events
  grid.querySelectorAll('[data-action="edit-payment"]').forEach(b => b.addEventListener('click', () => openEditPaymentModal(Number(b.dataset.payId))));
  grid.querySelectorAll('[data-action="change-pay-status"]').forEach(b => b.addEventListener('click', () => changePaymentStatus(Number(b.dataset.payId), b.dataset.newStatus)));
}

let _paySearchTimer = null;
function filterPayments() {
  clearTimeout(_paySearchTimer);
  _paySearchTimer = setTimeout(_filterPaymentsNow, 250);
}

function _filterPaymentsNow() {
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

async function changePaymentStatus(pid, newStatus) {
  const payment = _payments.find(p => String(p.id) === String(pid));
  if (payment) {
    const planId = payment.plan_id || (payment.plan && payment.plan.id);
    const planExists = _plans.some(pl => String(pl.id) === String(planId));
    if (!planExists) {
      toast("This plan has been deleted. Please create a new subscription instead.", "error");
      return;
    }
  }

  const statusLabels = { paid: 'Paid', rejected: 'Rejected', canceled: 'Canceled' };
  const emailMessages = {
    paid: 'A payment receipt email will be sent to the user.',
    rejected: 'A rejection notification email will be sent to the user.',
    canceled: 'A cancellation notification email will be sent to the user.'
  };
  
  confirmAction(
    `Mark as ${statusLabels[newStatus]}?`,
    `${emailMessages[newStatus]} Are you sure you want to proceed?`,
    async () => {
      if (newStatus === 'paid') {
        const payment = _payments.find(p => String(p.id) === String(pid));
        if (payment) {
          let email = payment.user_email;
          if (!email && payment.user) email = payment.user.email;
          if (!email && payment.user_id) {
            const u = _users.find(usr => String(usr.id) === String(payment.user_id));
            if (u) email = u.email;
          }
          if (checkDuplicatePaidPayment(email, pid)) {
            toast('User already has an active paid payment', 'error');
            return;
          }
        }
      }

      try {
        await apiFetch(`/api/v1/admin/payments/${pid}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: { status: newStatus } })
        });
        // Optimistic update
        const payment = _payments.find(p => String(p.id) === String(pid));
        if (payment) payment.status = newStatus;
        filterPayments();
        toast(`Payment status updated to ${statusLabels[newStatus]}`, 'success');
        loadPaymentsTelemetry(true, true);
      } catch (e) {
        toast('Failed to update payment status', 'error');
      }
    }
  );
}

function populateEditPaymentPlanDropdown(selectedPlanId) {
  const select = document.getElementById('editPaymentPlan');
  if (!select) return;
  select.innerHTML = '';
  
  const hasPlan = _plans.some(p => String(p.id) === String(selectedPlanId));
  if (selectedPlanId && !hasPlan) {
    const opt = document.createElement('option');
    opt.value = selectedPlanId;
    opt.textContent = `[Deleted Plan #${selectedPlanId}]`;
    opt.selected = true;
    opt.disabled = true;
    select.appendChild(opt);
  }
  
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
  const planExists = _plans.some(pl => String(pl.id) === String(planId));
  if (!planExists) return toast('This plan has been deleted. Please select an active plan instead.', 'error');
  if (isNaN(amount) || amount < 0) return toast('Please enter a valid amount', 'error');
  if (!start || !end) return toast('Start and end dates are required', 'error');

  if (status === 'paid') {
    const payment = _payments.find(p => String(p.id) === String(pid));
    if (payment) {
      let email = payment.user_email;
      if (!email && payment.user) email = payment.user.email;
      if (!email && payment.user_id) {
        const u = _users.find(usr => String(usr.id) === String(payment.user_id));
        if (u) email = u.email;
      }
      if (checkDuplicatePaidPayment(email, pid)) {
        toast('User already has an active paid payment', 'error');
        return;
      }
    }
  }

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
    loadPaymentsTelemetry(true, true);
  } catch (e) {
    toast(`Failed to update payment: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}


// ── Autocomplete and Section-Specific User Search ───────────────────
let _sectionAutocompleteTimeout = null;

async function handleSectionAutocomplete(val, type) {
  clearTimeout(_sectionAutocompleteTimeout);
  
  const dropdownId = type === 'user' ? 'userSearchDropdown' :
                     type === 'request' ? 'requestSearchDropdown' :
                     type === 'review' ? 'reviewSearchDropdown' :
                     type === 'payment' ? 'paymentSearchDropdown' :
                     'createSubSearchDropdown';
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const query = (val || '').trim();
  if (!query) {
    dropdown.innerHTML = '';
    dropdown.style.display = 'none';
    if (type === 'user') {
      loadUsers(_userPage, false, false);
    } else if (type === 'request') {
      loadRequests(_reqPage, false, false);
    } else if (type === 'review') {
      loadReviews(_revPage, false, false);
    } else if (type === 'payment') {
      filterPayments();
    }
    return;
  }

  // Also trigger local filtering / standard filtering instantly as fallback
  if (type === 'user') {
    filterUsers(val);
  } else if (type === 'request') {
    filterRequests();
  } else if (type === 'review') {
    filterReviews();
  } else if (type === 'payment') {
    filterPayments();
  }

  _sectionAutocompleteTimeout = setTimeout(async () => {
    try {
      const response = await apiFetch(`/api/v1/admin/users/search/autocomplete?q=${encodeURIComponent(query)}`);
      const emails = Array.isArray(response) ? response : [];
      
      if (emails.length === 0) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
        return;
      }

      dropdown.innerHTML = emails.map(email => {
        return `<div class="autofill-item" data-email="${escapeHtml(email)}" data-type="${escapeHtml(type)}">${escapeHtml(email)}</div>`;
      }).join('');
      // Bind click via addEventListener — never put email into onclick string
      dropdown.querySelectorAll('.autofill-item').forEach(item => {
        item.addEventListener('click', () => selectSectionEmail(item.dataset.email, item.dataset.type));
      });
      dropdown.style.display = 'block';
    } catch (e) {
      console.error('Autocomplete error:', e);
      dropdown.style.display = 'none';
    }
  }, 150);
}

function selectSectionEmail(email, type) {
  const inputId = type === 'user' ? 'userSearch' :
                  type === 'request' ? 'reqSearch' :
                  type === 'review' ? 'revSearch' :
                  type === 'payment' ? 'paySearch' :
                  'sub-email';
                  
  const dropdownId = type === 'user' ? 'userSearchDropdown' :
                     type === 'request' ? 'requestSearchDropdown' :
                     type === 'review' ? 'reviewSearchDropdown' :
                     type === 'payment' ? 'paymentSearchDropdown' :
                     'createSubSearchDropdown';
  
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  
  if (input) input.value = email;
  if (dropdown) {
    dropdown.innerHTML = '';
    dropdown.style.display = 'none';
  }
  
  if (type === 'create-sub') {
    lookupUserByEmail(email);
  } else {
    executeSectionSearch(email, type);
  }
}

document.addEventListener('click', (e) => {
  ['userSearchDropdown', 'requestSearchDropdown', 'reviewSearchDropdown', 'paymentSearchDropdown', 'createSubSearchDropdown'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.parentNode.contains(e.target)) {
      el.style.display = 'none';
    }
  });
});

async function executeSectionSearch(email, type) {
  if (!email) {
    toast('Please enter a user email to search', 'warning');
    return;
  }

  try {
    let data;
    if (type === 'user') {
      data = await apiFetch(`/api/v1/admin/users/by-email?email=${encodeURIComponent(email)}`);
    } else if (type === 'request') {
      data = await apiFetch(`/api/v1/admin/requests/by-email?email=${encodeURIComponent(email)}`);
    } else if (type === 'review') {
      data = await apiFetch(`/api/v1/admin/reviews/by-email?email=${encodeURIComponent(email)}`);
    } else if (type === 'payment') {
      data = await apiFetch(`/api/v1/admin/payments/by-email?email=${encodeURIComponent(email)}`);
    }

    if (!data) throw new Error('No data found');
    
    if (type === 'user') {
      _users = [data];
      _totalUsers = 1;
      _userHasMore = false;
      renderUsersTable(_users);
      
      document.getElementById('userPageNum').textContent = '1';
      document.getElementById('userPaginationInfo').textContent = `Search results for "${email}"`;
      document.getElementById('userPrevBtn').disabled = true;
      document.getElementById('userNextBtn').disabled = true;
      document.getElementById('userCount').textContent = `1 user`;
    } else if (type === 'request') {
      _requests = data || [];
      _requests = _requests.map(r => ({ ...r, id: r.request_id || r.id }));
      _totalRequests = _requests.length;
      _reqHasMore = false;
      renderRequests(_requests);
      
      const pending  = _requests.filter(r => r.status === 'pending').length;
      const approved = _requests.filter(r => r.status === 'approved').length;
      const rejected = _requests.filter(r => r.status === 'rejected').length;
      document.getElementById('reqStatTotal').textContent    = _totalRequests;
      document.getElementById('reqStatPending').textContent  = pending;
      document.getElementById('reqStatApproved').textContent = approved;
      document.getElementById('reqStatRejected').textContent = rejected;
      document.getElementById('reqCount').textContent = `${_totalRequests} request${_totalRequests!==1?'s':''}`;
      
      document.getElementById('reqPageNum').textContent = '1';
      document.getElementById('reqPaginationInfo').textContent = `Search results for "${email}"`;
      document.getElementById('reqPrevBtn').disabled = true;
      document.getElementById('reqNextBtn').disabled = true;
    } else if (type === 'review') {
      _reviews = data || [];
      _totalReviews = _reviews.length;
      _revHasMore = false;
      renderReviews(_reviews);
      
      const pending  = _reviews.filter(r => (r.status || (r.is_published ? 'accepted' : 'pending')) === 'pending').length;
      const accepted = _reviews.filter(r => (r.status || (r.is_published ? 'accepted' : 'pending')) === 'accepted').length;
      document.getElementById('revStatTotal').textContent    = _totalReviews;
      document.getElementById('revStatPending').textContent  = pending;
      document.getElementById('revStatAccepted').textContent = accepted;
      document.getElementById('revCount').textContent = `${_totalReviews} review${_totalReviews!==1?'s':''}`;
      
      document.getElementById('revPageNum').textContent = '1';
      document.getElementById('revPaginationInfo').textContent = `Search results for "${email}"`;
      document.getElementById('revPrevBtn').disabled = true;
      document.getElementById('revNextBtn').disabled = true;
    } else if (type === 'payment') {
      _payments = data || [];
      updatePaymentsUI({ items: _payments, metrics: {} });
      
      document.getElementById('payPageNum').textContent = '1';
      document.getElementById('payPaginationInfo').textContent = `Search results for "${email}"`;
      document.getElementById('payPrevBtn').disabled = true;
      document.getElementById('payNextBtn').disabled = true;
    }
    toast('Search completed successfully', 'success');
  } catch(e) {
    console.error('Section search failed:', e);
    toast('No user or records found matching this email', 'error');
  }
}

function triggerMobileSearch(inputId, type) {
  const input = document.getElementById(inputId);
  if (!input) return;
  executeSectionSearch(input.value.trim(), type);
}

