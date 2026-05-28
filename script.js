// ===== API Base URL =====
const API_BASE = 'http://127.0.0.1:8000';

// ===== Plans State =====
let _cachedPlans = null;
let _currentBilling = 'monthly';

// ===== Language System =====
function initLanguage() {
    const saved = localStorage.getItem('badia_lang') || 'en';
    setLanguage(saved, false);
}

function setLanguage(lang, save = true) {
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    // Layout stays LTR regardless of language

    // Update all elements with data-en / data-ar
    document.querySelectorAll('[data-en][data-ar]').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return; // skip — handled by placeholder
        // Preserve Font Awesome icons inside the element
        const icon = el.querySelector('i');
        const text = el.getAttribute(`data-${lang}`);
        if (icon) {
            // Keep the icon, update only the text node
            el.textContent = '';
            el.appendChild(icon);
            el.append(' ' + text);
        } else {
            el.textContent = text;
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-placeholder-en][data-placeholder-ar]').forEach(el => {
        el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
    });

    // Update toggle button text
    const toggleBtns = document.querySelectorAll('.lang-toggle-text');
    toggleBtns.forEach(btn => {
        btn.textContent = lang === 'en' ? 'عربي' : 'English';
    });

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.content = lang === 'ar'
            ? 'بادية - شريكك الموثوق في الاستشارات التجارية والإدارة التشغيلية ودراسات الجدوى والخدمات المحاسبية في الكويت.'
            : 'BADIA – Your trusted partner in business consulting, operational management, feasibility studies, and accounting services in Kuwait.';
    }

    // Update nav auth link
    updateNavAuthLink();

    // Re-render plans in new language if already loaded
    if (_cachedPlans) renderPlans(_cachedPlans, _currentBilling);

    if (save) localStorage.setItem('badia_lang', lang);
}

function getCurrentLang() {
    return document.documentElement.getAttribute('lang') || 'en';
}

// Wire lang toggle
document.addEventListener('DOMContentLoaded', () => {
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const current = getCurrentLang();
            setLanguage(current === 'en' ? 'ar' : 'en');
        });
    }
    // Also wire the mobile language toggle
    const langToggleMobile = document.getElementById('langToggleMobile');
    if (langToggleMobile) {
        langToggleMobile.addEventListener('click', () => {
            const current = getCurrentLang();
            setLanguage(current === 'en' ? 'ar' : 'en');
        });
    }
    initLanguage();

    // Init animations
    document.querySelectorAll('.service-block, .about-card, .portfolio-item, .testimonial-card, .blog-card, .usp-item, .web-service-card, .plan-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.6s ease-out';
        observer.observe(card);
    });

    // Update nav auth link on load
    updateNavAuthLink();
});

// ===== Nav Auth =====
function updateNavAuthLink() {
    const desktopAuth  = document.getElementById('navAuthDesktop');
    const mobileAuth   = document.getElementById('navMobileAuth');
    const token = localStorage.getItem('access_token');
    const lang  = getCurrentLang();

    if (token) {
        // Logged in → replace both auth zones with a single "My Account" link
        const accountLabelEN = 'My Account';
        const accountLabelAR = 'حسابي';
        const label = lang === 'ar' ? accountLabelAR : accountLabelEN;

        if (desktopAuth) {
            desktopAuth.innerHTML = `<a href="account.html" class="nav-btn-account"
                data-en="${accountLabelEN}" data-ar="${accountLabelAR}"><i class="fa-solid fa-user-gear"></i> ${label}</a>`;
        }
        if (mobileAuth) {
            mobileAuth.innerHTML = `<a href="account.html" class="nav-btn-register" style="flex:1;text-align:center;display:flex;align-items:center;justify-content:center;gap:.4rem"
                data-en="${accountLabelEN}" data-ar="${accountLabelAR}"><i class="fa-solid fa-user-gear"></i> ${label}</a>`;
        }
    } else {
        // Not logged in → show Sign In + Register
        const siEN='Sign In', siAR='تسجيل الدخول', rgEN='Register', rgAR='إنشاء حساب';
        const si = lang==='ar' ? siAR : siEN;
        const rg = lang==='ar' ? rgAR : rgEN;

        if (desktopAuth) {
            desktopAuth.innerHTML = `
                <a href="Signin.html"   class="nav-btn-signin"   id="navSignIn"   data-en="${siEN}" data-ar="${siAR}"><i class="fa-regular fa-user"></i> ${si}</a>
                <a href="Signin.html?tab=register" class="nav-btn-register" id="navRegister" data-en="${rgEN}" data-ar="${rgAR}"><i class="fa-solid fa-user-plus"></i> ${rg}</a>`;
        }
        if (mobileAuth) {
            mobileAuth.innerHTML = `
                <a href="Signin.html"   class="nav-btn-signin"   data-en="${siEN}" data-ar="${siAR}"><i class="fa-regular fa-user"></i> ${si}</a>
                <a href="Signin.html?tab=register" class="nav-btn-register" data-en="${rgEN}" data-ar="${rgAR}"><i class="fa-solid fa-user-plus"></i> ${rg}</a>`;
        }
    }
    // Sync service gates with current auth state
    updateServiceGates();
}

// ===== Smooth Scroll =====
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

document.querySelectorAll('.nav-links a, .footer-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            const el = document.getElementById(href.substring(1));
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            closeMobileMenu();
        }
    });
});

// ===== Mobile Menu Toggle =====
const mobileToggle = document.getElementById('mobileToggle');
const navLinks     = document.getElementById('navLinks');
const navBackdrop  = document.getElementById('navBackdrop');

function closeMobileMenu() {
    navLinks?.classList.remove('open');
    mobileToggle?.classList.remove('open');
    navBackdrop?.classList.remove('visible');
}

if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        mobileToggle.classList.toggle('open', isOpen);
        navBackdrop?.classList.toggle('visible', isOpen);
    });
}
navBackdrop?.addEventListener('click', closeMobileMenu);

// ===== Form Submission =====
document.getElementById('contactForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value,
        service: document.getElementById('contactService').value,
        message: document.getElementById('contactMessage').value
    };

    const lang = getCurrentLang();
    if (!data.name || !data.email || !data.phone || !data.message) {
        showNotification(lang === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required', 'error');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        showNotification(lang === 'ar' ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address', 'error');
        return;
    }

    const btn = document.getElementById('submitBtn');
    const origEN = btn.getAttribute('data-en');
    const origAR = btn.getAttribute('data-ar');
    btn.textContent = lang === 'ar' ? 'جاري الإرسال...' : 'Sending...';
    btn.disabled = true;

    setTimeout(() => {
        showNotification(
            lang === 'ar' ? 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً' : 'Message sent successfully! We will contact you soon',
            'success'
        );
        this.reset();
        btn.textContent = lang === 'ar' ? origAR : origEN;
        btn.disabled = false;
    }, 1500);
});

// ===== Notification =====
function showNotification(msg, type = 'success') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    const isRTL = getCurrentLang() === 'ar';
    Object.assign(el.style, {
        position: 'fixed', top: '20px',
        [isRTL ? 'left' : 'right']: '20px',
        padding: '1rem 1.5rem',
        borderRadius: '8px', fontSize: '1rem', fontWeight: '500', zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,.15)', maxWidth: '400px',
        fontFamily: "'Inter','Tajawal',sans-serif",
        background: type === 'success' ? '#10b981' : '#ef4444', color: 'white',
        animation: 'slideIn .3s ease-out'
    });
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity .3s';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ===== Intersection Observer for Animations =====
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

// ===== Navbar Scroll Effect =====
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ===== Active Nav Link =====
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const links = document.querySelectorAll('.nav-links a[href^="#"]');
    let current = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 200) current = s.id; });
    links.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
});

// ===== Counter Animation =====
const statsBar = document.querySelector('.stats-bar');
if (statsBar) {
    new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                document.querySelectorAll('.stat-item h3').forEach(el => {
                    const target = parseInt(el.dataset.target);
                    const suffix = el.dataset.suffix || '+';
                    let current = 0;
                    const inc = target / 125;
                    const timer = setInterval(() => {
                        current += inc;
                        if (current >= target) { el.textContent = target + suffix; clearInterval(timer); }
                        else el.textContent = Math.floor(current);
                    }, 16);
                });
            }
        });
    }, { threshold: 0.5 }).observe(statsBar);
}

// ===== Service Tabs =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const parent = btn.closest('.service-block');
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab)?.classList.add('active');
    });
});

// ===== Portfolio Filters =====
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.portfolio-item').forEach(item => {
            if (filter === 'all' || item.dataset.category === filter) {
                item.classList.remove('hidden');
                item.style.animation = 'fadeInUp .4s ease';
            } else {
                item.classList.add('hidden');
            }
        });
    });
});

// ===== Inject Notification Keyframes =====
const style = document.createElement('style');
style.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;
document.head.appendChild(style);

// ===== LocalStorage Helpers for User Data & Reviews =====
function getCachedUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

function setCachedUser(user) {
    localStorage.setItem('badia_user', JSON.stringify(user));
}

function clearCachedUser() {
    localStorage.removeItem('badia_user');
    localStorage.removeItem('badia_reviews');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
}

function getCachedReviews() {
    const raw = localStorage.getItem('badia_reviews');
    return raw ? JSON.parse(raw) : null;
}

function setCachedReviews(reviews) {
    localStorage.setItem('badia_reviews', JSON.stringify(reviews));
}

// ===== API Helper =====
async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // If 401, try refreshing the token
    if (res.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
            return fetch(`${API_BASE}${path}`, { ...options, headers });
        } else {
            clearCachedUser();
            window.location.href = 'Signin.html';
            return res;
        }
    }
    return res;
}

async function tryRefreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    try {
        const res = await fetch(`${API_BASE}/api/v1/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('access_token', data.access_token);
            if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

// ===== Testimonial Carousel =====
(function() {
    let current = 0;
    let timer = null;

    function goTo(idx) {
        const slides = document.querySelectorAll('.tq-slide');
        const dots   = document.querySelectorAll('.tq-dot');
        if (!slides.length) return;
        slides[current].classList.remove('active');
        dots[current].classList.remove('active');
        current = (idx + slides.length) % slides.length;
        slides[current].classList.add('active');
        dots[current].classList.add('active');
    }

    function startAuto() {
        timer = setInterval(() => goTo(current + 1), 5000);
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.tq-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                clearInterval(timer);
                goTo(Number(dot.dataset.idx));
                startAuto();
            });
        });
        startAuto();
    });
})();

// ===== Load =====
window.addEventListener('load', () => {
    console.log('✓ BADIA website loaded');
    fetchPlans();
});



// ===== Plans API =====
async function fetchPlans() {
    const grid = document.getElementById('plansGrid');
    if (!grid) return;

    // 1. Instantly render cached plans from localStorage (no flash of empty state)
    const cachedData = localStorage.getItem('plans_data');
    if (cachedData) {
        try {
            _cachedPlans = JSON.parse(cachedData);
            renderPlans(_cachedPlans, _currentBilling);
        } catch (_) {
            // Corrupted cache — clear it and continue to fetch
            localStorage.removeItem('plans_data');
            localStorage.removeItem('plans_etag');
        }
    }

    // 2. Validate with the server using ETag
    try {
        const headers = {};

        const storedEtag = localStorage.getItem('plans_etag');
        if (storedEtag) {
            headers['If-None-Match'] = storedEtag;
        }

        const res = await fetch(`${API_BASE}/api/v1/plans/`, { headers });

        // 3. 304 Not Modified → plans unchanged, cached version is already rendered
        if (res.status === 304) {
            console.log('Plans unchanged (304). Using localStorage cache.');
            return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // 4. 200 OK → backend has new/updated plans
        const data = await res.json();

        // Support both array response or { results: [...] } pagination wrapper
        _cachedPlans = Array.isArray(data) ? data : (data.results || data.plans || []);

        // 5. Persist new data + ETag in localStorage
        localStorage.setItem('plans_data', JSON.stringify(_cachedPlans));

        const newEtag = res.headers.get('ETag');
        if (newEtag) {
            localStorage.setItem('plans_etag', newEtag);
        }

        // 6. Re-render with the fresh data
        renderPlans(_cachedPlans, _currentBilling);

    } catch (err) {
        console.error('Plans fetch error:', err);

        // Offline fallback: if we already rendered from cache above, nothing to do.
        // If there was no cache at all, show the error state.
        if (!_cachedPlans) {
            renderPlansError(grid);
        } else {
            console.log('Network error. Showing previously cached plans.');
        }
    }
}


// ===== Plan Details Decoder =====
// Translates the structured plan_details object into a human-readable feature list.
const FEATURE_LABELS = {
    en: {
        accounts:          'Chart of accounts',
        invoices:          'Invoicing',
        purchasing:        'Purchase orders',
        basic_reports:     'Basic reports',
        advanced_reports:  'Advanced reports',
        inventory:         'Inventory management',
        assets:            'Fixed assets',
        payroll:           'Payroll',
        kpi:               'KPI dashboard',
        api:               'API access',
        multi_branch:      'Multi-branch',
        white_label:       'White label',
        bank_integrations: 'Bank integrations',
    },
    ar: {
        accounts:          'شجرة الحسابات',
        invoices:          'الفواتير',
        purchasing:        'أوامر الشراء',
        basic_reports:     'التقارير الأساسية',
        advanced_reports:  'التقارير المتقدمة',
        inventory:         'إدارة المخزون',
        assets:            'الأصول الثابتة',
        payroll:           'الرواتب',
        kpi:               'لوحة KPI',
        api:               'وصول API',
        multi_branch:      'متعدد الفروع',
        white_label:       'العلامة البيضاء',
        bank_integrations: 'تكاملات بنكية',
    }
};


const SUPPORT_LABELS = {
    en: { email: 'Email support', chat: 'Live chat support', phone: 'Phone support', account_manager: 'Dedicated account manager' },
    ar: { email: 'دعم البريد الإلكتروني', chat: 'دعم المحادثة المباشرة', phone: 'دعم هاتفي', account_manager: 'مدير حساب مخصص' }
};

function decodePlanDetails(plan_details, lang) {
    if (!plan_details || typeof plan_details !== 'object') return [];
    const l = lang === 'ar' ? 'ar' : 'en';
    const lines = [];

    // Limits line
    const limits = plan_details.limits || {};
    const users = limits.users === 'unlimited'
        ? (l === 'ar' ? 'مستخدمون غير محدودون' : 'Unlimited users')
        : limits.users ? `${limits.users} ${l === 'ar' ? (limits.users === 1 ? 'مستخدم' : 'مستخدمين') : (limits.users === 1 ? 'user' : 'users')}` : null;
    if (users) lines.push(users);

    const txn = limits.transactions === 'unlimited'
        ? (l === 'ar' ? 'معاملات غير محدودة' : 'Unlimited transactions')
        : limits.transactions ? `${Number(limits.transactions).toLocaleString()} ${l === 'ar' ? 'معاملة / شهر' : 'transactions/month'}` : null;
    if (txn) lines.push(txn);

    const storage = limits.storage_gb === 'unlimited'
        ? (l === 'ar' ? 'تخزين غير محدود' : 'Unlimited storage')
        : limits.storage_gb ? `${limits.storage_gb} GB ${l === 'ar' ? 'تخزين' : 'storage'}` : null;
    if (storage) lines.push(storage);

    // Enabled features
    const features = plan_details.features || {};
    const featureLabels = FEATURE_LABELS[l];
    Object.entries(features).forEach(([key, val]) => {
        if (val === true && featureLabels[key]) lines.push(featureLabels[key]);
    });

    // Support channels
    const support = plan_details.support || {};
    const supportLabels = SUPPORT_LABELS[l];
    Object.entries(support).forEach(([key, val]) => {
        if (val === true && supportLabels[key]) lines.push(supportLabels[key]);
    });

    // SLA uptime
    const sla = plan_details.sla || {};
    if (sla.uptime) lines.push(`${sla.uptime} ${l === 'ar' ? 'وقت تشغيل' : 'uptime'}`);
    if (sla.backup) {
        const backupMap = { daily: l === 'ar' ? 'نسخ احتياطي يومي' : 'Daily backups', 'real-time': l === 'ar' ? 'نسخ احتياطي فوري' : 'Real-time backups' };
        lines.push(backupMap[sla.backup] || `${sla.backup} ${l === 'ar' ? 'نسخ احتياطي' : 'backup'}`);
    }

    return lines;
}

function renderPlans(plans, billing) {
    const grid = document.getElementById('plansGrid');
    if (!grid) return;

    if (!plans || plans.length === 0) {
        grid.innerHTML = `<div class="plans-error"><p>No plans available at the moment.</p></div>`;
        return;
    }

    const lang = getCurrentLang();
    const isYearly = billing === 'yearly';

    // Mark Pro (idx=2) as featured — it's the mid-tier with most value
    grid.innerHTML = plans.map((plan, idx) => {
        const name          = plan.name || `Plan ${idx + 1}`;
        const monthlyPrice  = plan.price_monthly ?? plan.monthly_price ?? 0;
        const yearlyPrice   = plan.price_yearly  ?? plan.yearly_price  ?? (monthlyPrice * 12);
        const displayPrice  = isYearly ? yearlyPrice : monthlyPrice;
        const isFeatured    = plan.name === 'Pro'; // Pro is the hero plan

        const periodLabel = isYearly
            ? (lang === 'ar' ? 'د.ك / سنة' : 'KWD / year')
            : (lang === 'ar' ? 'د.ك / شهر' : 'KWD / month');

        const badgeText = isFeatured
            ? (lang === 'ar' ? 'الأكثر طلباً' : 'Most Popular')
            : (isYearly ? (lang === 'ar' ? 'سنوي' : 'Annual') : (lang === 'ar' ? 'شهري' : 'Monthly'));

        const subscribeText = lang === 'ar' ? 'اشترك الآن' : 'Subscribe Now';

        const features = decodePlanDetails(plan.plan_details, lang);
        const MAX_VIS = 6;
        const vis = features.slice(0, MAX_VIS);
        const hid = features.slice(MAX_VIS);
        const moreText  = lang === 'ar' ? `+ ${hid.length} ميزة إضافية` : `+ ${hid.length} more`;
        const lessText  = lang === 'ar' ? '↑ عرض أقل' : '↑ Less';
        const featureHTML = vis.length
            ? vis.map(f => `<li>${f}</li>`).join('')
              + hid.map(f => `<li class="plan-feat-extra">${f}</li>`).join('')
              + (hid.length ? `<li class="plan-feat-toggle" data-more="${moreText}" data-less="${lessText}"><span>${moreText}</span></li>` : '')
            : `<li>${lang === 'ar' ? 'تفاصيل عبر الاتصال بنا' : 'Details via consultation'}</li>`;

        // Yearly savings badge
        let savingsHTML = '';
        if (isYearly && monthlyPrice > 0) {
            const saved = Math.round((monthlyPrice * 12) - yearlyPrice);
            if (saved > 0) savingsHTML = `<p class="pricing-save">${lang === 'ar' ? `وفّر ${saved} د.ك` : `Save ${saved} KWD`}</p>`;
        }

        return `
        <div class="plan-card${isFeatured ? ' featured' : ''}">
            <span class="plan-badge">${badgeText}</span>
            <div class="plan-name">${name}</div>
            <div class="plan-price-box">
                <span class="plan-price">${Number(displayPrice).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})}</span>
                <span class="plan-price-period"> ${periodLabel}</span>
            </div>
            ${savingsHTML}
            <ul class="plan-features">${featureHTML}</ul>
            <button class="btn ${isFeatured ? 'btn-primary' : 'btn-outline'}" onclick="scrollToSection('contact')">${subscribeText}</button>
        </div>`;
    }).join('');
}

function renderPlansError(grid) {
    const lang = getCurrentLang();
    grid.innerHTML = `
        <div class="plans-error">
            <p>${lang === 'ar' ? 'تعذّر تحميل الباقات. يرجى المحاولة مرة أخرى.' : 'Could not load plans. Please try again.'}</p>
            <button class="btn btn-outline" onclick="fetchPlans()">${lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>
        </div>`;
}

// ===== Billing Toggle =====
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('billingToggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            _currentBilling = toggle.checked ? 'yearly' : 'monthly';
            if (_cachedPlans) renderPlans(_cachedPlans, _currentBilling);
        });
    }

    // Plan feature expand/collapse (event delegation on the grid)
    document.getElementById('plansGrid')?.addEventListener('click', e => {
        const btn = e.target.closest('.plan-feat-toggle');
        if (!btn) return;
        const card   = btn.closest('.plan-card');
        const extras = card.querySelectorAll('.plan-feat-extra');
        const exp    = btn.dataset.expanded === '1';
        extras.forEach(li => li.style.display = exp ? 'none' : 'block');
        btn.dataset.expanded = exp ? '0' : '1';
        btn.querySelector('span').textContent = exp ? btn.dataset.more : btn.dataset.less;
    });
});

// ===== Service Gate Auth State =====
function updateServiceGates() {
    const token = localStorage.getItem('access_token');
    const isLoggedIn = !!token;
    const lang = getCurrentLang();

    document.querySelectorAll('.service-gate').forEach(gate => {
        const blockId = gate.closest('.service-block')?.id;
        const serviceType = blockId === 'service-operations' ? 'partnership' : 'feasibility';
        const cta = gate.querySelector('.service-gate-cta');
        if (!cta) return;

        if (isLoggedIn) {
            gate.classList.add('gate-open');
            gate.classList.remove('gate-locked');

            const btnEN  = serviceType === 'partnership' ? 'Request Operational Partnership' : 'Request Feasibility Study';
            const btnAR  = serviceType === 'partnership' ? 'اطلب الشراكة التشغيلية'          : 'اطلب دراسة الجدوى';
            const msgEN  = serviceType === 'partnership'
                ? "You're all set. Submit your request and our team will follow up within 24 hours."
                : "You're all set. Submit your request and we'll reach out to start your study.";
            const msgAR  = serviceType === 'partnership'
                ? 'أنت جاهز. أرسل طلبك وسيتواصل معك فريقنا خلال 24 ساعة.'
                : 'أنت جاهز. أرسل طلبك وسنتواصل معك للبدء في دراستك.';
            const labelEN = 'Account Connected';
            const labelAR = 'الحساب متصل';

            cta.innerHTML = `
                <div class="gate-open-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <p class="gate-open-label" data-en="${labelEN}" data-ar="${labelAR}">${lang === 'ar' ? labelAR : labelEN}</p>
                <p class="gate-open-message" data-en="${msgEN}" data-ar="${msgAR}">${lang === 'ar' ? msgAR : msgEN}</p>
                <button class="btn btn-primary service-request-btn"
                    data-en="${btnEN}" data-ar="${btnAR}"
                    onclick="handleServiceRequest('${serviceType}')">
                    ${lang === 'ar' ? btnAR : btnEN}
                </button>`;
        } else {
            gate.classList.remove('gate-open');
            gate.classList.add('gate-locked');

            // Restore original lock CTA if it was replaced
            if (!cta.querySelector('.gate-lock-icon')) {
                const msgEN  = serviceType === 'partnership'
                    ? 'Sign in or create an account to request this service and access your partnership dashboard.'
                    : 'Sign in or create an account to request a feasibility study and track your project through your dashboard.';
                const msgAR  = serviceType === 'partnership'
                    ? 'سجّل دخولك أو أنشئ حساباً لطلب هذه الخدمة والوصول إلى لوحة الشراكة.'
                    : 'سجّل دخولك أو أنشئ حساباً لطلب دراسة الجدوى ومتابعة مشروعك عبر لوحة التحكم.';
                const btnEN  = serviceType === 'partnership' ? 'Request Operational Partnership' : 'Request Feasibility Study';
                const btnAR  = serviceType === 'partnership' ? 'اطلب الشراكة التشغيلية'          : 'اطلب دراسة الجدوى';

                cta.innerHTML = `
                    <div class="gate-lock-icon">
                        <svg fill="none" height="28" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="28"><rect height="11" rx="2" ry="2" width="18" x="3" y="11"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <p class="gate-message" data-en="${msgEN}" data-ar="${msgAR}">${lang === 'ar' ? msgAR : msgEN}</p>
                    <button class="btn btn-primary service-request-btn"
                        data-en="${btnEN}" data-ar="${btnAR}"
                        onclick="handleServiceRequest('${serviceType}')">
                        ${lang === 'ar' ? btnAR : btnEN}
                    </button>`;
            }
        }
    });
}