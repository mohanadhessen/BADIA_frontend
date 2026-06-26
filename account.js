// ===== Account Page State =====
let currentUser = null;
let currentReviews = null;
let currentRequests = null;
let selectedRating = 0;
let editingReviewId = null;
let modalSelectedRating = 0;
let editingRequestId = null;
let accountFormsInitialized = false;

// ===== Helper to format error details (including FastAPI 422 list) =====
function getErrorMessage(err, defaultMsg) {
    if (err && err.detail) {
        if (typeof err.detail === 'string') {
            return err.detail;
        } else if (Array.isArray(err.detail)) {
            return err.detail.map(e => {
                const fieldName = e.loc[e.loc.length - 1];
                return `${fieldName}: ${e.msg}`;
            }).join(', ');
        }
    }
    return defaultMsg;
}

// ===== Auth Guard =====
(function () {
    // isLoggedIn() checks the non-httpOnly badia_role cookie (UX check only)
    // The real auth check happens when fetchUserProfile() calls GET /users/me
    if (!isLoggedIn()) {
        window.location.href = 'index.html?open_signin=true';
        return;
    }
    initAccountPage();
})();

// ===== Language for account page =====
function initAccountLang() {
    const saved = localStorage.getItem('badia_lang') || 'en';
    setAccountLang(saved, false);
}

function setAccountLang(lang, save = true) {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', 'ltr');

    document.querySelectorAll('[data-en][data-ar]').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
        const val = el.getAttribute(`data-${lang}`);
        if (val.includes('<') && el.children.length > 0) {
            el.innerHTML = val;
        } else {
            el.textContent = val;
        }
    });

    document.querySelectorAll('[data-placeholder-en][data-placeholder-ar]').forEach(el => {
        el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
    });

    document.querySelectorAll('[data-title-en][data-title-ar]').forEach(el => {
        el.title = el.getAttribute(`data-title-${lang}`);
    });

    document.querySelectorAll('.lang-toggle-text').forEach(el => {
        el.textContent = lang === 'en' ? 'عربي' : 'English';
    });

    if (save) localStorage.setItem('badia_lang', lang);

    // Re-render reviews with correct lang
    if (currentReviews) renderReviews(currentReviews);
}

function toggleAccountLang() {
    const current = document.documentElement.getAttribute('lang') || 'en';
    setAccountLang(current === 'en' ? 'ar' : 'en');
}

function getLang() {
    return document.documentElement.getAttribute('lang') || 'en';
}

// ===== Section Navigation =====
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const hamburger = document.getElementById('hamburger');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('visible');
    if (hamburger) hamburger.classList.toggle('open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const hamburger = document.getElementById('hamburger');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (hamburger) hamburger.classList.remove('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
            closeSidebar();
        }
    }
});

function showSection(sectionId, linkEl) {
    if (linkEl) linkEl.preventDefault && linkEl.preventDefault();
    document.querySelectorAll('.account-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));

    const section = document.getElementById('section-' + sectionId);
    if (section) section.classList.add('active');

    // Highlight matching sidebar link (works even when called programmatically)
    if (linkEl) {
        linkEl.classList.add('active');
    } else {
        const matchingLink = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
        if (matchingLink) matchingLink.classList.add('active');
    }

    // Close mobile sidebar on navigation
    closeSidebar();

    // Update URL hash so direct links work (account.html#partnership)
    history.replaceState(null, '', '#' + sectionId);

    // Update topbar title
    const titleMap = {
        'profile': { en: 'Profile', ar: 'الملف الشخصي' },
        'edit-profile': { en: 'Edit Profile', ar: 'تعديل الملف الشخصي' },
        'change-password': { en: 'Change Password', ar: 'تغيير كلمة المرور' },
        'partnership': { en: 'Operational Partnership', ar: 'الشراكة التشغيلية' },
        'feasibility': { en: 'Feasibility Study', ar: 'دراسة الجدوى' },
        'requests': { en: 'My Requests', ar: 'طلباتي' },
        'reviews': { en: 'Reviews', ar: 'التقييمات' },
        'delete-account': { en: 'Delete Account', ar: 'حذف الحساب' }
    };
    const lang = getLang();
    const title = document.getElementById('sectionTitle');
    if (title && titleMap[sectionId]) {
        title.textContent = titleMap[sectionId][lang];
        title.setAttribute('data-en', titleMap[sectionId].en);
        title.setAttribute('data-ar', titleMap[sectionId].ar);
    }

    // Lazy load data based on section viewed
    if (sectionId === 'requests' || sectionId === 'partnership' || sectionId === 'feasibility') {
        fetchRequests();
    } else if (sectionId === 'reviews') {
        fetchReviews();
    }

    return false;
}


// ===== Delete Account Modal =====
function openDeleteModal() {
    const overlay = document.getElementById('deleteAccountModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Reset fields
        document.getElementById('deleteConfirmEmail').value = '';
        const btn = document.getElementById('deleteAccountBtn');
        btn.disabled = true;
        btn.classList.remove('enabled');
    }
}

function closeDeleteModal() {
    const overlay = document.getElementById('deleteAccountModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function initAccountForms() {
    if (accountFormsInitialized) return;
    const editProfileForm = document.getElementById('editProfileForm');
    if (!editProfileForm) return;
    accountFormsInitialized = true;

    editProfileForm.addEventListener('submit', onEditProfileSubmit);

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', onChangePasswordSubmit);

    const partnershipForm = document.getElementById('partnershipForm');
    if (partnershipForm) partnershipForm.addEventListener('submit', onPartnershipSubmit);

    const feasibilityForm = document.getElementById('feasibilityForm');
    if (feasibilityForm) feasibilityForm.addEventListener('submit', onFeasibilitySubmit);

    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) reviewForm.addEventListener('submit', onReviewSubmit);
}

// ===== Initialize Account Page =====
async function initAccountPage() {
    initAccountLang();
    initAccountForms();

    // Try cached user first
    const cached = getCachedUser();
    if (cached) {
        if (cached.role === 'admin') {
            document.cookie = `badia_role=admin; path=/; max-age=2592000; samesite=lax`;
            window.location.replace('admin.html');
            return;
        }
        currentUser = cached;
        renderProfile(cached);
        populateEditForm(cached);
        checkVerificationGate(cached);
    }

    // Try cached reviews
    const cachedRevs = getCachedReviews();
    if (cachedRevs) {
        currentReviews = cachedRevs;
        renderReviews(cachedRevs);
    }

    // Try cached requests
    const cachedReqs = getCachedRequests();
    if (cachedReqs) {
        currentRequests = cachedReqs;
        renderRequests(cachedReqs);
    }

    // ── Direct-link hash routing ──────────────────────────────────────
    // Supports: account.html#partnership  account.html#feasibility  etc.
    const validSections = ['profile', 'edit-profile', 'change-password', 'partnership', 'feasibility', 'requests', 'reviews', 'delete-account'];
    const hash = window.location.hash.replace('#', '');
    if (hash && validSections.includes(hash)) {
        showSection(hash, null);
    }

    // Fetch everything in background (non-blocking)
    const runOnLoad = async () => {
        const profilePromise = fetchUserProfile();
        const paramsPromise = handleAccountURLParams();
        await Promise.allSettled([profilePromise, paramsPromise]);
    };

    if (document.readyState === 'complete') {
        setTimeout(runOnLoad, 0);
    } else {
        window.addEventListener('load', () => {
            setTimeout(runOnLoad, 0);
        });
    }
}

// ===== Handle URL Params on Account Page =====
async function handleAccountURLParams() {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token');
    if (verifyToken) {
        const lang = getLang();
        showNotification(lang === 'ar' ? 'جاري التحقق من بريدك الإلكتروني...' : 'Verifying your email...', 'success');
        try {
            const res = await fetch(`${API_BASE}/api/v1/auth/verify-email`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
                body: JSON.stringify({ token: verifyToken })
            });
            if (res.ok) {
                showNotification(lang === 'ar' ? 'تم تفعيل البريد الإلكتروني بنجاح!' : 'Email verified successfully!', 'success');
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                // Force refresh user profile to update verification badge & forms lock state
                await fetchUserProfile();
            } else {
                const err = await res.json();
                showNotification(err.detail || (lang === 'ar' ? 'فشل تفعيل البريد الإلكتروني' : 'Email verification failed'), 'error');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch {
            showNotification(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

// ===== Fetch User Profile =====
async function fetchUserProfile(forceRefresh = false) {
    try {
        const headers = {};
        if (!forceRefresh) {
            const storedEtag = localStorage.getItem('me_etag');
            if (storedEtag) {
                headers['If-None-Match'] = storedEtag;
            }
        }

        const res = await apiFetch('/api/v1/users/me', { headers });

        if (res.status === 304) {
            console.log('User profile unchanged (304). Using cache.');
            const cached = getCachedUser();
            if (cached) {
                currentUser = cached;
                if (currentUser && currentUser.role === 'admin') {
                    document.cookie = `badia_role=admin; path=/; max-age=2592000; samesite=lax`;
                    window.location.replace('admin.html');
                    return;
                }
                renderProfile(cached);
                populateEditForm(cached);
                checkVerificationGate(cached);
            }
            return;
        }

        if (res.ok) {
            const data = await res.json();
            currentUser = data.user_info;
            if (currentUser && currentUser.role === 'admin') {
                document.cookie = `badia_role=admin; path=/; max-age=2592000; samesite=lax`;
                window.location.replace('admin.html');
                return;
            }
            setCachedUser(currentUser);
            renderProfile(currentUser);
            populateEditForm(currentUser);
            checkVerificationGate(currentUser);

            const newEtag = res.headers.get('ETag');
            if (newEtag) {
                localStorage.setItem('me_etag', newEtag);
            } else {
                localStorage.removeItem('me_etag');
            }
        } else {
            const lang = getLang();
            showNotification(lang === 'ar' ? 'فشل في تحميل بيانات الملف الشخصي' : 'Failed to load profile', 'error');
        }
    } catch (err) {
        console.error('Profile fetch error:', err);
        const lang = getLang();
        showNotification(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Connection error', 'error');
    }
}

// ===== Render Profile =====
function renderProfile(user) {
    const lang = getLang();

    // Helper to set textContent if different
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== val) {
            el.textContent = val;
        }
    };

    // Sidebar — overwrite text and clear stale data-* values so setAccountLang doesn't clobber it
    const sidebarNameEl = document.getElementById('sidebarName');
    if (sidebarNameEl) {
        const fullName = `${user.first_name} ${user.last_name}`;
        if (sidebarNameEl.textContent !== fullName) {
            sidebarNameEl.textContent = fullName;
        }
        sidebarNameEl.removeAttribute('data-en');
        sidebarNameEl.removeAttribute('data-ar');
    }
    const sidebarEmailEl = document.getElementById('sidebarEmail');
    if (sidebarEmailEl && sidebarEmailEl.textContent !== user.email) {
        sidebarEmailEl.textContent = user.email;
    }

    const sidebarAvatarEl = document.getElementById('sidebarAvatar');
    if (user.avatar_url) {
        if (sidebarAvatarEl) {
            const avatarHTML = `<img src="${user.avatar_url}" class="sidebar-avatar" alt="avatar">`;
            if (sidebarAvatarEl.innerHTML !== avatarHTML) {
                sidebarAvatarEl.innerHTML = avatarHTML;
            }
            if (sidebarAvatarEl.className !== '') {
                sidebarAvatarEl.className = '';
            }
        }
        const profileAvatarLg = document.getElementById('profileAvatarLg');
        if (profileAvatarLg) {
            const avatarHTML = `<img src="${user.avatar_url}" class="profile-avatar-lg" alt="avatar">`;
            if (profileAvatarLg.innerHTML !== avatarHTML) {
                profileAvatarLg.innerHTML = avatarHTML;
            }
            if (profileAvatarLg.className !== '') {
                profileAvatarLg.className = '';
            }
        }
    }

    // Profile section
    setTxt('profileFullName', `${user.first_name} ${user.last_name}`);
    setTxt('profileRole', user.role || 'user');
    setTxt('profileFirstName', user.first_name || '—');
    setTxt('profileLastName', user.last_name || '—');
    setTxt('profileCompany', user.company_name || '—');
    setTxt('profileEmail', user.email || '—');
    setTxt('profilePhone', user.phone || '—');
    setTxt('profileProvider', user.auth_provider || 'local');

    const formattedDate = user.created_at ? new Date(user.created_at).toLocaleDateString(lang === 'ar' ? 'ar-KW' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    setTxt('profileCreatedAt', formattedDate);

    // Verification status
    const verifiedEl = document.getElementById('profileVerified');
    if (verifiedEl) {
        const verifiedHTML = user.is_email_verified
            ? `<span class="verified-badge">✓ ${lang === 'ar' ? 'مفعّل' : 'Verified'}</span>`
            : `<span style="color:#dc2626;font-weight:600;">✕ ${lang === 'ar' ? 'غير مفعّل' : 'Not Verified'}</span>`;
        if (verifiedEl.innerHTML !== verifiedHTML) {
            verifiedEl.innerHTML = verifiedHTML;
        }
    }

    // Delete section
    setTxt('deleteEmailDisplay', user.email);
}

// ===== Populate Edit Form =====
function populateEditForm(user) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && el.value !== val) {
            el.value = val;
        }
    };
    setVal('editFirstName', user.first_name || '');
    setVal('editLastName', user.last_name || '');
    setVal('editCompany', user.company_name || '');
    setVal('editPhone', user.phone || '');
    setVal('editAvatar', user.avatar_url || '');
}

// ===== Verification Gate =====
function checkVerificationGate(user) {
    const verificationBanner = document.getElementById('verificationBanner');
    const profileBanner = document.getElementById('profileCompletionBanner');
    const partnershipCard = document.getElementById('partnershipCard');
    const feasibilityCard = document.getElementById('feasibilityCard');

    const isEmailVerified = user.is_email_verified;
    const isProfileComplete = !!(user.phone && user.company_name);

    if (!isEmailVerified) {
        if (verificationBanner) verificationBanner.style.display = 'flex';
        if (profileBanner) profileBanner.style.display = 'none';
        if (partnershipCard) partnershipCard.classList.add('form-locked');
        if (feasibilityCard) feasibilityCard.classList.add('form-locked');
    } else if (!isProfileComplete) {
        if (verificationBanner) verificationBanner.style.display = 'none';
        if (profileBanner) profileBanner.style.display = 'flex';
        if (partnershipCard) partnershipCard.classList.add('form-locked');
        if (feasibilityCard) feasibilityCard.classList.add('form-locked');
    } else {
        if (verificationBanner) verificationBanner.style.display = 'none';
        if (profileBanner) profileBanner.style.display = 'none';
        if (partnershipCard) partnershipCard.classList.remove('form-locked');
        if (feasibilityCard) feasibilityCard.classList.remove('form-locked');
    }
}

// ===== Resend Verification =====
async function resendVerification() {
    const lang = getLang();
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/api/v1/auth/request-verification`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
            body: JSON.stringify({ email: currentUser.email })
        });
        if (res.ok) {
            showNotification(
                lang === 'ar'
                    ? 'تم إرسال رابط التفعيل! يرجى التحقق من بريدك الإلكتروني ومجلد البريد العشوائي (Spam) أو المهملات.'
                    : 'Verification link sent! Please check your email and spam/delete folder.',
                'success'
            );
        } else {
            const data = await res.json().catch(() => ({}));
            showNotification(
                data.detail || (lang === 'ar' ? 'فشل إرسال رابط التفعيل' : 'Failed to send verification link'),
                'error'
            );
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
}

// ===== Edit Profile Submit =====
async function onEditProfileSubmit(e) {
    e.preventDefault();
    const lang = getLang();

    // Build only changed fields
    const updates = {};
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName = document.getElementById('editLastName').value.trim();
    const company = document.getElementById('editCompany').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const avatar = document.getElementById('editAvatar').value.trim();

    if (firstName && firstName !== currentUser.first_name) updates.first_name = firstName;
    if (lastName && lastName !== currentUser.last_name) updates.last_name = lastName;
    if (company && company !== currentUser.company_name) updates.company_name = company;
    if (phone !== (currentUser.phone || '')) updates.phone = phone || null;
    if (avatar !== (currentUser.avatar_url || '')) updates.avatar_url = avatar || null;

    if (Object.keys(updates).length === 0) {
        showNotification(lang === 'ar' ? 'لا توجد تغييرات لحفظها' : 'No changes to save', 'error');
        return;
    }

    const btn = this.querySelector('.btn-save');
    btn.disabled = true;
    btn.textContent = lang === 'ar' ? 'جاري الحفظ...' : 'Saving...';

    try {
        const res = await apiFetch('/api/v1/users/me', {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
        if (res.ok) {
            const data = await res.json();
            currentUser = { ...currentUser, ...data.user_info };
            setCachedUser(currentUser);
            renderProfile(currentUser);
            populateEditForm(currentUser);
            checkVerificationGate(currentUser);

            // Fetch fresh profile immediately after PATCH to update the cached ETag
            await fetchUserProfile(true);

            showNotification(lang === 'ar' ? 'تم تحديث الملف الشخصي بنجاح' : 'Profile updated successfully', 'success');
        } else {
            const err = await res.json();
            showNotification(err.detail || (lang === 'ar' ? 'فشل التحديث' : 'Update failed'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
    btn.disabled = false;
    btn.textContent = lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes';
}

// ===== Change Password Submit =====
async function onChangePasswordSubmit(e) {
    e.preventDefault();
    const lang = getLang();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (newPassword.length < 8) {
        showNotification(lang === 'ar' ? 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' : 'New password must be at least 8 characters', 'error');
        return;
    }

    const btn = this.querySelector('.btn-save');
    btn.disabled = true;
    btn.textContent = lang === 'ar' ? 'جاري التحديث...' : 'Updating...';

    try {
        const res = await apiFetch('/api/v1/users/me/password', {
            method: 'POST',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        if (res.ok) {
            showNotification(lang === 'ar' ? 'تم تحديث كلمة المرور بنجاح!' : 'Password updated successfully!', 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
        } else {
            const err = await res.json();
            showNotification(err.detail || (lang === 'ar' ? 'فشل تحديث كلمة المرور' : 'Failed to update password'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
    btn.disabled = false;
    btn.textContent = lang === 'ar' ? 'تحديث كلمة المرور' : 'Update Password';
}



// ===== Delete Account =====
function checkDeleteConfirmation() {
    const input = document.getElementById('deleteConfirmEmail').value.trim();
    const userEmail = currentUser ? currentUser.email : '';
    const btn = document.getElementById('deleteAccountBtn');
    if (input === userEmail) {
        btn.classList.add('enabled');
        btn.disabled = false;
    } else {
        btn.classList.remove('enabled');
        btn.disabled = true;
    }
}

async function deleteAccount() {
    const lang = getLang();
    const btn = document.getElementById('deleteAccountBtn');
    if (!btn.classList.contains('enabled')) return;

    btn.disabled = true;
    btn.textContent = lang === 'ar' ? 'جاري الحذف...' : 'Deleting...';

    try {
        const res = await apiFetch('/api/v1/users/me', { method: 'DELETE' });
        if (res.ok) {
            clearCachedUser();
            showNotification(lang === 'ar' ? 'تم حذف الحساب بنجاح' : 'Account deleted successfully', 'success');
            closeDeleteModal();
            setTimeout(() => window.location.href = 'index.html', 2000);
        } else {
            const err = await res.json();
            showNotification(err.detail || (lang === 'ar' ? 'فشل حذف الحساب' : 'Delete failed'), 'error');
            btn.disabled = false;
            btn.textContent = lang === 'ar' ? 'حذف حسابي نهائياً' : 'Permanently Delete My Account';
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
        btn.disabled = false;
        btn.textContent = lang === 'ar' ? 'حذف حسابي نهائياً' : 'Permanently Delete My Account';
    }
}

// ===== File Upload Handler =====
function handleFileSelect(input, filenameId, zoneId) {
    const lang = getLang();
    const file = input.files[0];
    const filenameEl = document.getElementById(filenameId);
    const zoneEl = document.getElementById(zoneId);

    if (file) {
        if (file.type !== 'application/pdf') {
            showNotification(lang === 'ar' ? 'يجب أن يكون الملف بصيغة PDF' : 'File must be PDF format', 'error');
            input.value = '';
            filenameEl.textContent = '';
            zoneEl.classList.remove('has-file');
            return;
        }
        filenameEl.textContent = file.name;
        zoneEl.classList.add('has-file');
    } else {
        filenameEl.textContent = '';
        zoneEl.classList.remove('has-file');
    }
}

// ===== Partnership Form Submit =====
async function onPartnershipSubmit(e) {
    e.preventDefault();
    const lang = getLang();

    if (!currentUser || !currentUser.is_email_verified) {
        showNotification(lang === 'ar' ? 'يجب تفعيل بريدك الإلكتروني أولاً' : 'You must verify your email first', 'error');
        return;
    }

    if (!currentUser.phone || !currentUser.company_name) {
        showNotification(lang === 'ar' ? 'يرجى استكمال بيانات الملف الشخصي (رقم الهاتف واسم الشركة) أولاً' : 'Please complete your profile (Phone and Company Name) first', 'error');
        showSection('edit-profile', null);
        return;
    }

    // Validate all files uploaded
    const fileInputs = this.querySelectorAll('input[type="file"]');
    let allFilled = true;
    const missingFields = [];
    fileInputs.forEach(inp => {
        if (!inp.files || inp.files.length === 0) {
            allFilled = false;
            const zone = inp.closest('.upload-zone');
            const label = zone.querySelector('.upload-label');
            missingFields.push(label.textContent);
        }
    });

    if (!allFilled) {
        showNotification(
            lang === 'ar'
                ? `يرجى رفع جميع المستندات المطلوبة`
                : `Please upload all required documents`,
            'error'
        );
        return;
    }

    const btn = this.querySelector('.btn-save');
    btn.disabled = true;
    btn.textContent = lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...';

    try {
        const formData = new FormData();
        fileInputs.forEach(inp => {
            if (inp.files && inp.files[0]) {
                formData.append('files', inp.files[0]);
            }
        });

        const res = await fetch(`${API_BASE}/api/v1/users/me/requests/partnership/submit`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...csrfHeaders() },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            showNotification(
                lang === 'ar' ? 'تم إرسال طلب الشراكة التشغيلية بنجاح!' : 'Operational Partnership application submitted successfully!',
                'success'
            );
            // Reset all upload zones
            fileInputs.forEach(inp => {
                const zoneId = inp.closest('.upload-zone').id;
                const filenameId = zoneId.replace('zone-', 'file-');
                inp.value = '';
                const filenameEl = document.getElementById(filenameId);
                if (filenameEl) filenameEl.textContent = '';
                inp.closest('.upload-zone').classList.remove('has-file');
            });
            showSection('requests', null);
            fetchRequests();
        } else {
            const err = await res.json();
            showNotification(getErrorMessage(err, lang === 'ar' ? 'فشل إرسال الطلب' : 'Submission failed'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Connection error', 'error');
    }

    btn.disabled = false;
    btn.textContent = lang === 'ar' ? 'إرسال الطلب' : 'Submit Application';
}

// ===== Feasibility Form Submit =====
async function onFeasibilitySubmit(e) {
    e.preventDefault();
    const lang = getLang();

    if (!currentUser || !currentUser.is_email_verified) {
        showNotification(lang === 'ar' ? 'يجب تفعيل بريدك الإلكتروني أولاً' : 'You must verify your email first', 'error');
        return;
    }

    if (!currentUser.phone || !currentUser.company_name) {
        showNotification(lang === 'ar' ? 'يرجى استكمال بيانات الملف الشخصي (رقم الهاتف واسم الشركة) أولاً' : 'Please complete your profile (Phone and Company Name) first', 'error');
        showSection('edit-profile', null);
        return;
    }

    const desc = document.getElementById('feasProjectDesc').value.trim();
    const cost = document.getElementById('feasEstCost').value.trim();
    const funding = document.getElementById('feasFunding').value.trim();

    if (!desc || !cost || !funding) {
        showNotification(lang === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required', 'error');
        return;
    }

    if (desc.length < 5) {
        showNotification(lang === 'ar' ? 'يجب أن يكون وصف المشروع 5 أحرف على الأقل' : 'Project description must be at least 5 characters', 'error');
        return;
    }

    const btn = this.querySelector('.btn-save');
    btn.disabled = true;
    btn.textContent = lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...';

    try {
        const res = await apiFetch('/api/v1/users/me/requests/feasibility/submit', {
            method: 'POST',
            body: JSON.stringify({
                project_description: desc,
                estimated_cost: parseFloat(cost.replace(/,/g, '')) || 0,
                funding_source: funding
            })
        });

        if (res.ok) {
            showNotification(
                lang === 'ar' ? 'تم إرسال طلب دراسة الجدوى بنجاح!' : 'Feasibility Study request submitted successfully!',
                'success'
            );
            // Reset form
            document.getElementById('feasProjectDesc').value = '';
            document.getElementById('feasEstCost').value = '';
            document.getElementById('feasFunding').value = '';
            showSection('requests', null);
            fetchRequests();
        } else {
            const err = await res.json();
            showNotification(getErrorMessage(err, lang === 'ar' ? 'فشل إرسال الطلب' : 'Submission failed'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Connection error', 'error');
    }

    btn.disabled = false;
    btn.textContent = lang === 'ar' ? 'إرسال طلب الدراسة' : 'Submit Study Request';
}

// ===== Requests =====
async function fetchRequests(forceRefresh = false) {
    try {
        const headers = {};
        if (!forceRefresh) {
            const storedEtag = localStorage.getItem('requests_etag');
            if (storedEtag) {
                headers['If-None-Match'] = storedEtag;
            }
        }

        const res = await apiFetch('/api/v1/users/me/requests', { headers });

        if (res.status === 304) {
            console.log('Requests unchanged (304). Using cache.');
            const cachedReqs = getCachedRequests();
            if (cachedReqs) {
                currentRequests = cachedReqs;
                renderRequests(cachedReqs);
            }
            return;
        }

        if (res.ok) {
            const data = await res.json();
            currentRequests = data.requests || data || [];
            setCachedRequests(currentRequests);
            renderRequests(currentRequests);

            const newEtag = res.headers.get('ETag');
            if (newEtag) {
                localStorage.setItem('requests_etag', newEtag);
            } else {
                localStorage.removeItem('requests_etag');
            }
        }
    } catch (err) {
        console.error('Requests fetch error:', err);
    }
}

function renderRequests(requests) {
    const lang = getLang();

    const typeLabels = {
        operational_partnership: { en: 'Operational Partnership', ar: 'الشراكة التشغيلية' },
        partnership: { en: 'Operational Partnership', ar: 'الشراكة التشغيلية' },
        feasibility: { en: 'Feasibility Study', ar: 'دراسة الجدوى' },
        feasibility_study: { en: 'Feasibility Study', ar: 'دراسة الجدوى' },
    };

    const statusColors = {
        pending: 'var(--gold)',
        approved: '#10b981',
        rejected: '#dc2626',
        reviewing: '#6366f1',
    };

    const createRequestHTML = (r) => {
        const typeKey = (r.service_type || r.request_type || r.type || '').toLowerCase();
        const label = (typeLabels[typeKey] || {})[lang] || typeKey;
        const status = r.status || 'pending';
        const statusColor = statusColors[status] || 'var(--muted)';
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString(lang === 'ar' ? 'ar-KW' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

        let summary = '';
        if (r.project_description) summary = r.project_description.slice(0, 100) + (r.project_description.length > 100 ? '…' : '');
        else if (r.description) summary = r.description.slice(0, 100) + (r.description.length > 100 ? '…' : '');

        const files = r.files || [];
        const fileChipsHTML = files.length > 0 ? `
                <div class="request-files-section">
                    <div class="request-files-label">${lang === 'ar' ? 'الملفات المرفقة' : 'Attached Files'} (${files.length})</div>
                    <div class="request-files-list">
                        ${files.map(f => {
            const fname = f.filename || f.name || 'file.pdf';
            const fileId = f.file_id || f.id || '';
            const fsize = f.size ? (f.size < 1048576 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / 1048576).toFixed(1)} MB`) : '';
            return `<div class="request-file-chip" onclick="previewMyFile(${r.id},'${fileId}')" style="cursor:pointer" title="${lang === 'ar' ? 'عرض' : 'Preview'}">
                                <span class="request-file-icon">📄</span>
                                <span class="request-file-name">${fname.length > 25 ? fname.slice(0, 22) + '…' : fname}</span>
                                ${fsize ? `<span class="request-file-size">${fsize}</span>` : ''}
                                <button class="request-file-download" onclick="event.stopPropagation();downloadMyFile(${r.id},'${fileId}','${fname}')" title="${lang === 'ar' ? 'تحميل' : 'Download'}">
                                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                            </div>`;
        }).join('')}
                    </div>
                </div>` : '';

        return `
            <div class="request-item" data-request-id="${r.id}">
                <div class="request-item-header">
                    <div class="request-type-badge">${label}</div>
                    <span class="request-status" style="color:${statusColor};">● ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>
                ${summary ? `<p class="request-summary">${summary}</p>` : ''}
                ${fileChipsHTML}
                <div class="request-item-footer">
                    <span class="request-date">${lang === 'ar' ? 'تاريخ' : 'Submitted'}: ${date}</span>
                    <div class="request-actions">
                        <button class="btn-request-edit" onclick="openRequestEditModal(${r.id})">${lang === 'ar' ? 'تعديل' : 'Edit'}</button>
                        <button class="btn-request-delete" onclick="deleteMyRequest(${r.id})">${lang === 'ar' ? 'حذف' : 'Delete'}</button>
                    </div>
                </div>
            </div>`;
    };

    const pContainer = document.getElementById('partnershipRequestContainer');
    const pForm = document.getElementById('partnershipFormContainer');
    const fContainer = document.getElementById('feasibilityRequestContainer');
    const fForm = document.getElementById('feasibilityFormContainer');

    let hasPartnership = false;
    let hasFeasibility = false;

    (requests || []).forEach(r => {
        const typeKey = (r.service_type || r.request_type || r.type || '').toLowerCase();
        if (typeKey === 'operational_partnership' || typeKey === 'partnership') {
            if (pContainer) pContainer.innerHTML = createRequestHTML(r);
            hasPartnership = true;
        } else if (typeKey === 'feasibility' || typeKey === 'feasibility_study') {
            if (fContainer) fContainer.innerHTML = createRequestHTML(r);
            hasFeasibility = true;
        }
    });

    if (pContainer && pForm) {
        pContainer.style.display = hasPartnership ? 'block' : 'none';
        pForm.style.display = hasPartnership ? 'none' : 'block';
    }
    if (fContainer && fForm) {
        fContainer.style.display = hasFeasibility ? 'block' : 'none';
        fForm.style.display = hasFeasibility ? 'none' : 'block';
    }
}

// ===== Download user's own file =====
async function downloadMyFile(requestId, fileId, filename) {
    const lang = getLang();
    if (!fileId) {
        showNotification(lang === 'ar' ? 'معرف الملف غير موجود' : 'File ID missing', 'error');
        return;
    }
    try {
        // Fetch the presigned URL using the exact pattern from the admin dashboard
        // Make sure to use the correct endpoint path without '/me/'
        const res = await apiFetch(`/api/v1/users/me/requests/${requestId}/files/${fileId}`);
        if (!res.ok) throw new Error('API Error');

        const data = await res.json();
        const url = data.download_url || data.url || data.presigned_url;

        if (url) {
            window.location.href = url;
        } else {
            throw new Error('No download URL returned');
        }
    } catch (err) {
        console.error('Download error:', err);
        showNotification(lang === 'ar' ? 'فشل تحميل الملف' : 'Failed to download file', 'error');
    }
}

// ===== Preview user's own file =====
async function previewMyFile(requestId, fileId) {
    const lang = getLang();
    if (!fileId) {
        showNotification(lang === 'ar' ? 'معرف الملف غير موجود' : 'File ID missing', 'error');
        return;
    }

    const newWin = window.open('about:blank', '_blank');

    try {
        const res = await apiFetch(`/api/v1/users/me/requests/${requestId}/files/${fileId}`);
        if (!res.ok) throw new Error('API Error');

        const data = await res.json();
        const url = data.url || data.presigned_url;

        if (url) {
            newWin.location.href = url;
        } else {
            throw new Error('No preview URL returned');
        }
    } catch (err) {
        if (newWin) newWin.close();
        console.error('Preview error:', err);
        showNotification(lang === 'ar' ? 'فشل عرض الملف' : 'Failed to preview file', 'error');
    }
}

// ===== Delete user's own request =====
async function deleteMyRequest(requestId) {
    const lang = getLang();
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟ سيتم حذف جميع الملفات المرتبطة.' : 'Are you sure you want to delete this request? All associated files will be deleted.')) return;

    try {
        const res = await apiFetch(`/api/v1/users/me/requests/${requestId}`, { method: 'DELETE' });
        if (res.ok) {
            currentRequests = currentRequests.filter(r => r.id !== requestId);
            renderRequests(currentRequests);
            showNotification(lang === 'ar' ? 'تم حذف الطلب بنجاح' : 'Request deleted successfully', 'success');
        } else {
            const err = await res.json();
            showNotification(err.detail || (lang === 'ar' ? 'فشل حذف الطلب' : 'Delete failed'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
}

function openRequestEditModal(id) {
    const request = currentRequests.find(r => r.id === id);
    if (!request) return;
    const lang = getLang();
    editingRequestId = id;

    const typeKey = request.service_type || request.request_type || request.type || '';
    const isFeasibility = typeKey === 'feasibility' || typeKey === 'feasibility_study';

    const title = isFeasibility
        ? (lang === 'ar' ? 'تعديل طلب دراسة الجدوى' : 'Edit Feasibility Study Request')
        : (lang === 'ar' ? 'تعديل طلب الشراكة التشغيلية' : 'Edit Operational Partnership Request');

    document.getElementById('editModalTitle').textContent = title;

    let bodyHTML = '';
    if (isFeasibility) {
        // Feasibility: Get the file_id from the first file, then update via PUT with JSON
        const files = request.files || [];
        const fileId = files.length > 0 ? (files[0].file_id || files[0].id || '') : '';

        bodyHTML = `
            <div class="edit-modal-pdf-note">
                <span class="pdf-note-icon">📄</span>
                <span>${lang === 'ar' ? 'سيتم تحويل هذا النص إلى ملف PDF بعد الحفظ.' : 'This content will be generated as a PDF after saving.'}</span>
            </div>
            <input type="hidden" id="modalFeasFileId" value="${fileId}">
            <div class="form-group">
                <label>${lang === 'ar' ? 'وصف المشروع التفصيلي' : 'Detailed Project Description'}</label>
                <textarea id="modalFeasDesc" rows="6" class="edit-modal-textarea">${request.project_description || request.description || ''}</textarea>
            </div>
            <div class="edit-modal-form-row">
                <div class="form-group">
                    <label>${lang === 'ar' ? 'التكلفة التقديرية (د.ك)' : 'Estimated Cost (KWD)'}</label>
                    <input type="text" id="modalFeasCost" class="edit-modal-input" value="${request.estimated_cost || ''}">
                </div>
                <div class="form-group">
                    <label>${lang === 'ar' ? 'مصدر التمويل' : 'Funding Source'}</label>
                    <input type="text" id="modalFeasFunding" class="edit-modal-input" value="${request.funding_source || ''}">
                </div>
            </div>
            <div class="edit-modal-footer">
                <button class="btn-modal-cancel" onclick="closeEditModal()">${lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                <button class="btn-modal-save" onclick="submitRequestEdit('feasibility')">${lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</button>
            </div>`;
    } else {
        // Operational Partnership — per-file re-upload
        const files = request.files || [];
        const fileListHTML = files.length > 0
            ? files.map((f, i) => {
                const fname = f.filename || f.name || f.file_name || 'file.pdf';
                const fileId = f.file_id || f.id || '';
                const fsize = f.size ? (f.size < 1048576 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / 1048576).toFixed(1)} MB`) : '';
                const fdate = f.created_at ? new Date(f.created_at).toLocaleDateString(lang === 'ar' ? 'ar-KW' : 'en-US', { month: 'short', day: 'numeric' }) : '';
                return `
                    <div class="modal-reupload-item" id="modal-file-${i}" data-file-id="${fileId}">
                        <div class="modal-reupload-info">
                            <span class="modal-file-icon">📄</span>
                            <div class="modal-reupload-details">
                                <span class="modal-file-name">${fname}</span>
                                <span class="modal-file-meta">${[fsize, fdate].filter(Boolean).join(' · ')}</span>
                            </div>
                        </div>
                        <div class="modal-reupload-actions">
                            <label class="btn-reupload" title="${lang === 'ar' ? 'استبدال هذا الملف' : 'Replace this file'}">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                <span>${lang === 'ar' ? 'استبدال' : 'Replace'}</span>
                                <input type="file" accept="application/pdf" onchange="handlePerFileReupload(this, ${i}, '${fileId}')" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
                            </label>
                        </div>
                        <div class="modal-reupload-status" id="reupload-status-${i}"></div>
                    </div>`;
            }).join('')
            : `<p class="modal-no-files">${lang === 'ar' ? 'لا توجد ملفات مرفوعة.' : 'No files uploaded.'}</p>`;

        bodyHTML = `
            <div class="edit-modal-pdf-note">
                <span class="pdf-note-icon">🔄</span>
                <span>${lang === 'ar' ? 'اختر ملفاً لاستبداله بملف PDF جديد. كل ملف يُحدَّث على حدة.' : 'Select a file to replace it with a new PDF. Each file is updated individually.'}</span>
            </div>
            <div class="form-group">
                <label>${lang === 'ar' ? 'ملفاتك المرفوعة' : 'Your Uploaded Files'} (${files.length})</label>
                <div class="modal-files-list" id="modalFilesList">${fileListHTML}</div>
            </div>
            <div class="edit-modal-footer">
                <button class="btn-modal-cancel" onclick="closeEditModal()">${lang === 'ar' ? 'إغلاق' : 'Close'}</button>
            </div>`;
    }

    document.getElementById('editModalBody').innerHTML = bodyHTML;
    openEditModal();
}

// ===== Per-file re-upload for Operational Partnership =====
async function handlePerFileReupload(input, index, fileId) {
    const lang = getLang();
    const file = input.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        showNotification(lang === 'ar' ? 'يجب أن يكون الملف بصيغة PDF' : 'File must be PDF format', 'error');
        input.value = '';
        return;
    }

    const statusEl = document.getElementById(`reupload-status-${index}`);
    const itemEl = document.getElementById(`modal-file-${index}`);
    if (statusEl) {
        statusEl.innerHTML = `<span class="reupload-loading">${lang === 'ar' ? 'جاري الرفع...' : 'Uploading...'}</span>`;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/api/v1/users/me/requests/partnership/files/${fileId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { ...csrfHeaders() },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            if (statusEl) {
                statusEl.innerHTML = `<span class="reupload-success">✓ ${lang === 'ar' ? 'تم الاستبدال' : 'Replaced'}</span>`;
            }
            // Update the filename display
            const nameEl = itemEl?.querySelector('.modal-file-name');
            if (nameEl) nameEl.textContent = data.filename || file.name;
            const metaEl = itemEl?.querySelector('.modal-file-meta');
            if (metaEl) {
                const newSize = data.size ? (data.size < 1048576 ? `${(data.size / 1024).toFixed(0)} KB` : `${(data.size / 1048576).toFixed(1)} MB`) : '';
                metaEl.textContent = newSize;
            }
            showNotification(lang === 'ar' ? `تم استبدال الملف بنجاح` : `File replaced successfully`, 'success');
            // Refresh requests list in background
            fetchRequests();
        } else {
            const err = await res.json();
            if (statusEl) {
                statusEl.innerHTML = `<span class="reupload-error">✕ ${err.detail || (lang === 'ar' ? 'فشل' : 'Failed')}</span>`;
            }
            showNotification(err.detail || (lang === 'ar' ? 'فشل استبدال الملف' : 'File replacement failed'), 'error');
        }
    } catch {
        if (statusEl) {
            statusEl.innerHTML = `<span class="reupload-error">✕ ${lang === 'ar' ? 'خطأ اتصال' : 'Connection error'}</span>`;
        }
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
    input.value = '';
}

async function submitRequestEdit(type) {
    const lang = getLang();
    const saveBtn = document.querySelector('#editModal .btn-modal-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = lang === 'ar' ? 'جاري الحفظ...' : 'Saving...'; }

    try {
        if (type === 'feasibility') {
            const desc = document.getElementById('modalFeasDesc').value.trim();
            const cost = document.getElementById('modalFeasCost').value.trim();
            const funding = document.getElementById('modalFeasFunding').value.trim();
            const fileId = document.getElementById('modalFeasFileId').value;

            if (!desc || !cost || !funding) {
                showNotification(lang === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required', 'error');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'; }
                return;
            }

            if (desc.length < 5) {
                showNotification(lang === 'ar' ? 'يجب أن يكون وصف المشروع 5 أحرف على الأقل' : 'Project description must be at least 5 characters', 'error');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'; }
                return;
            }

            if (!fileId) {
                showNotification(lang === 'ar' ? 'معرف الملف غير موجود' : 'File ID not found for this request', 'error');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'; }
                return;
            }

            // PUT /api/v1/users/me/requests/feasibility/files/{file_id} with JSON body
            const res = await apiFetch(`/api/v1/users/me/requests/feasibility/files/${fileId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    project_description: desc,
                    estimated_cost: parseFloat(cost.replace(/,/g, '')) || 0,
                    funding_source: funding
                })
            });

            if (res.ok) {
                showNotification(lang === 'ar' ? 'تم تحديث الطلب بنجاح' : 'Request updated successfully', 'success');
                closeEditModal();
                // Refresh requests
                await fetchRequests();
            } else {
                const err = await res.json();
                showNotification(err.detail || (lang === 'ar' ? 'فشل التحديث' : 'Update failed'), 'error');
            }
        }
        // Partnership per-file re-upload is handled by handlePerFileReupload() directly
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'; }
}

function openEditModal() {
    const overlay = document.getElementById('editModalOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Trap Escape key
    document._editModalEscHandler = (e) => { if (e.key === 'Escape') closeEditModal(); };
    document.addEventListener('keydown', document._editModalEscHandler);
}

function closeEditModal() {
    const overlay = document.getElementById('editModalOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    editingRequestId = null;
    if (document._editModalEscHandler) {
        document.removeEventListener('keydown', document._editModalEscHandler);
    }
}

// ===== Reviews =====
function setStarRating(n) {
    selectedRating = n;
    document.querySelectorAll('#reviewStars .star').forEach((s, i) => {
        s.classList.toggle('active', i < n);
    });
}

// ===== Fetch Reviews from API =====
async function fetchReviews(forceRefresh = false) {
    try {
        const headers = {};
        if (!forceRefresh) {
            const storedEtag = localStorage.getItem('reviews_etag');
            if (storedEtag) {
                headers['If-None-Match'] = storedEtag;
            }
        }

        const res = await apiFetch('/api/v1/users/me/reviews', { headers });

        if (res.status === 304) {
            console.log('Reviews unchanged (304). Using cache.');
            const cachedRevs = getCachedReviews();
            if (cachedRevs) {
                currentReviews = cachedRevs;
                renderReviews(cachedRevs);
            }
            return;
        }

        if (res.ok) {
            const data = await res.json();
            currentReviews = data.reviews || data.items || data || [];
            setCachedReviews(currentReviews);
            renderReviews(currentReviews);

            const newEtag = res.headers.get('ETag');
            if (newEtag) {
                localStorage.setItem('reviews_etag', newEtag);
            } else {
                localStorage.removeItem('reviews_etag');
            }
        }
    } catch (err) {
        console.error('Reviews fetch error:', err);
    }
}

function renderReviews(reviews) {
    const lang = getLang();
    const list = document.getElementById('reviewsList');

    if (!reviews || reviews.length === 0) {
        list.innerHTML = `<p style="color:var(--gray-500);text-align:center;">${lang === 'ar' ? 'لا توجد تقييمات بعد.' : 'No reviews yet.'}</p>`;
        return;
    }

    list.innerHTML = reviews.map(r => `
            <div class="review-item" data-review-id="${r.id}">
                <div class="review-body">
                    <div class="stars-display">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
                    <p>${r.review_text}</p>
                    <div class="review-meta">
                        ${lang === 'ar' ? 'تاريخ' : 'Date'}: ${new Date(r.created_at).toLocaleDateString(lang === 'ar' ? 'ar-KW' : 'en-US')}
                        ${!r.is_published ? `<span style="color:var(--accent);margin-inline-start:0.5rem;">(${lang === 'ar' ? 'قيد المراجعة' : 'Pending'})</span>` : ''}
                    </div>
                </div>
                <div class="review-actions">
                    <button onclick="startEditReview(${r.id})" data-en="Edit" data-ar="تعديل">${lang === 'ar' ? 'تعديل' : 'Edit'}</button>
                    <button class="btn-delete-review" onclick="deleteReview(${r.id})" data-en="Delete" data-ar="حذف">${lang === 'ar' ? 'حذف' : 'Delete'}</button>
                </div>
            </div>
        `).join('');
}

// Submit review
async function onReviewSubmit(e) {
    e.preventDefault();
    const lang = getLang();
    const text = document.getElementById('reviewText').value.trim();

    if (!selectedRating || selectedRating < 1) {
        showNotification(lang === 'ar' ? 'يرجى اختيار تقييم بالنجوم' : 'Please select a star rating', 'error');
        return;
    }
    if (!text) {
        showNotification(lang === 'ar' ? 'يرجى كتابة نص التقييم' : 'Please write review text', 'error');
        return;
    }

    const btn = this.querySelector('.btn-save');
    btn.disabled = true;

    try {
        // Create new review only — editing is handled by the edit modal
        const res = await apiFetch('/api/v1/users/me/reviews', {
            method: 'POST',
            body: JSON.stringify({ stars: selectedRating, review_text: text })
        });

        if (res.ok) {
            const review = await res.json();
            if (!currentReviews) currentReviews = [];
            currentReviews.unshift(review);
            showNotification(lang === 'ar' ? 'تم إرسال التقييم بنجاح' : 'Review submitted', 'success');
            setCachedReviews(currentReviews);
            renderReviews(currentReviews);
            fetchReviews(true);

            // Reset form
            document.getElementById('reviewText').value = '';
            selectedRating = 0;
            document.querySelectorAll('#reviewStars .star').forEach(s => s.classList.remove('active'));
        } else {
            const err = await res.json();
            showNotification(err.detail || (lang === 'ar' ? 'فشل الإرسال' : 'Submit failed'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
    btn.disabled = false;
}

function startEditReview(id) {
    const review = currentReviews.find(r => r.id === id);
    if (!review) return;
    const lang = getLang();

    editingReviewId = id;
    // Pre-fill modal
    setModalStarRating(review.stars);
    document.getElementById('reviewModalText').value = review.review_text;
    document.getElementById('reviewModalTitle').textContent = lang === 'ar' ? 'تعديل التقييم' : 'Edit Review';
    document.getElementById('reviewModalSaveBtn').textContent = lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes';

    // Open review modal
    const overlay = document.getElementById('reviewModalOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    document._reviewModalEscHandler = (e) => { if (e.key === 'Escape') closeReviewModal(); };
    document.addEventListener('keydown', document._reviewModalEscHandler);
}

function closeReviewModal() {
    const overlay = document.getElementById('reviewModalOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    editingReviewId = null;
    modalSelectedRating = 0;
    if (document._reviewModalEscHandler) {
        document.removeEventListener('keydown', document._reviewModalEscHandler);
    }
}

function setModalStarRating(n) {
    modalSelectedRating = n;
    document.querySelectorAll('#reviewModalStars .star').forEach((s, i) => {
        s.classList.toggle('active', i < n);
    });
}

async function submitReviewModal() {
    const lang = getLang();
    const text = document.getElementById('reviewModalText').value.trim();
    if (!modalSelectedRating || modalSelectedRating < 1) {
        showNotification(lang === 'ar' ? 'يرجى اختيار تقييم بالنجوم' : 'Please select a star rating', 'error');
        return;
    }
    if (!text) {
        showNotification(lang === 'ar' ? 'يرجى كتابة نص التقييم' : 'Please write review text', 'error');
        return;
    }

    const btn = document.getElementById('reviewModalSaveBtn');
    btn.disabled = true;
    btn.textContent = lang === 'ar' ? 'جاري الحفظ...' : 'Saving...';

    try {
        const res = await apiFetch(`/api/v1/users/me/reviews/${editingReviewId}`, {
            method: 'PATCH',
            body: JSON.stringify({ stars: modalSelectedRating, review_text: text })
        });
        if (res.ok) {
            const review = await res.json();
            const idx = currentReviews.findIndex(r => r.id === editingReviewId);
            if (idx >= 0) currentReviews[idx] = review;
            setCachedReviews(currentReviews);
            renderReviews(currentReviews);
            showNotification(lang === 'ar' ? 'تم تحديث التقييم' : 'Review updated', 'success');
            closeReviewModal();
            fetchReviews(true);
        } else {
            const err = await res.json();
            showNotification(err.detail || (lang === 'ar' ? 'فشل التحديث' : 'Update failed'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
    btn.disabled = false;
    btn.textContent = lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes';
}

async function deleteReview(id) {
    const lang = getLang();
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا التقييم؟' : 'Are you sure you want to delete this review?')) return;

    try {
        const res = await apiFetch(`/api/v1/users/me/reviews/${id}`, { method: 'DELETE' });
        if (res.ok) {
            currentReviews = currentReviews.filter(r => r.id !== id);
            setCachedReviews(currentReviews);
            renderReviews(currentReviews);
            showNotification(lang === 'ar' ? 'تم حذف التقييم' : 'Review deleted', 'success');
            fetchReviews(true);
        } else {
            const err = await res.json();
            showNotification(err.detail || (lang === 'ar' ? 'فشل الحذف' : 'Delete failed'), 'error');
        }
    } catch {
        showNotification(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
}

// ===== Logout =====
async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/v1/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        });
    } catch (e) { }
    clearCachedUser();
    window.location.href = 'index.html';
}
