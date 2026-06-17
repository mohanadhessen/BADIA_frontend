// 

// 

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

// ===== Nav Auth & Service Gates moved to auth_logic.js =====

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
const navLinks = document.getElementById('navLinks');
const navBackdrop = document.getElementById('navBackdrop');

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
document.getElementById('contactForm')?.addEventListener('submit', function (e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value,
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
    const origEN = btn.getAttribute('data-en') || 'Send Message';
    const origAR = btn.getAttribute('data-ar') || 'أرسل الرسالة';
    btn.textContent = lang === 'ar' ? 'جاري الإرسال...' : 'Sending...';
    btn.disabled = true;

    fetch(`${API_BASE}/api/v1/contact`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(async (res) => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        showNotification(
            lang === 'ar' ? 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً' : 'Message sent successfully! We will contact you soon',
            'success'
        );
        this.reset();
    })
    .catch((err) => {
        console.error('Contact submission error:', err);
        showNotification(
            lang === 'ar' ? 'فشل إرسال الرسالة. يرجى المحاولة مرة أخرى لاحقاً.' : 'Failed to send message. Please try again later.',
            'error'
        );
    })
    .finally(() => {
        btn.textContent = lang === 'ar' ? origAR : origEN;
        btn.disabled = false;
    });
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

// ===== LocalStorage Helpers for User Data, Reviews & Requests =====
function getCachedUser() {
    const user = localStorage.getItem('badia_user');
    return user ? JSON.parse(user) : null;
}

function setCachedUser(user) {
    localStorage.setItem('badia_user', JSON.stringify(user));
}

function clearUserDataCache() {
    localStorage.removeItem('badia_user');
    localStorage.removeItem('badia_reviews');
    localStorage.removeItem('badia_requests');
    localStorage.removeItem('requests_etag');
    localStorage.removeItem('reviews_etag');
    
    // Clear all admin SWR cache keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('api_cache_')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}

function clearCachedUser() {
    clearUserDataCache();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
}

function getCachedReviews() {
    const raw = localStorage.getItem('badia_reviews');
    return raw ? JSON.parse(raw) : null;
}

function setCachedReviews(reviews) {
    localStorage.setItem('badia_reviews', JSON.stringify(reviews));
}

function getCachedRequests() {
    const raw = localStorage.getItem('badia_requests');
    return raw ? JSON.parse(raw) : null;
}

function setCachedRequests(requests) {
    localStorage.setItem('badia_requests', JSON.stringify(requests));
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
            if (typeof openAuthModal === 'function') {
                openAuthModal('login');
            }
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
(function () {
    let current = 0;
    let timer = null;

    function goTo(idx) {
        const slides = document.querySelectorAll('.tq-slide');
        const dots = document.querySelectorAll('.tq-dot');
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
    setTimeout(fetchPlans, 0);
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
        accounts: 'Chart of accounts',
        invoices: 'Invoicing',
        purchasing: 'Purchase orders',
        basic_reports: 'Basic reports',
        advanced_reports: 'Advanced reports',
        inventory: 'Inventory management',
        assets: 'Fixed assets',
        payroll: 'Payroll',
        kpi: 'KPI dashboard',
        api: 'API access',
        multi_branch: 'Multi-branch',
        white_label: 'White label',
        bank_integrations: 'Bank integrations',
    },
    ar: {
        accounts: 'شجرة الحسابات',
        invoices: 'الفواتير',
        purchasing: 'أوامر الشراء',
        basic_reports: 'التقارير الأساسية',
        advanced_reports: 'التقارير المتقدمة',
        inventory: 'إدارة المخزون',
        assets: 'الأصول الثابتة',
        payroll: 'الرواتب',
        kpi: 'لوحة KPI',
        api: 'وصول API',
        multi_branch: 'متعدد الفروع',
        white_label: 'العلامة البيضاء',
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

    // Parse the new API format and append only enabled features
    Object.values(plan_details).forEach(feature => {
        if (feature && feature.enabled) {
            lines.push(feature[l]);
        }
    });

    return lines;
}


// Replace existing openPlanModal
function openPlanModal(planIdx) {
    if (!_cachedPlans) return;
    const plan = _cachedPlans[planIdx];
    if (!plan) return;

    const lang = getCurrentLang();
    const isYearly = _currentBilling === 'yearly';
    const name = plan.name || `Plan ${planIdx + 1}`;
    const monthlyPrice = plan.price_monthly ?? plan.monthly_price ?? 0;
    const yearlyPrice = plan.price_yearly ?? plan.yearly_price ?? (monthlyPrice * 12);
    const displayPrice = isYearly ? yearlyPrice : monthlyPrice;
    const periodLabel = isYearly
        ? (lang === 'ar' ? 'د.ك / سنة' : 'KWD / year')
        : (lang === 'ar' ? 'د.ك / شهر' : 'KWD / month');

    const features = decodePlanDetails(plan.plan_details, lang);
    const featureListHTML = features.length
        ? features.map(f => `<li class="modal-feat-item">${f}</li>`).join('')
        : `<li>${lang === 'ar' ? 'تفاصيل عبر الاتصال بنا' : 'Details via consultation'}</li>`;

    const showAllBtn = '';

    let savingsHTML = '';
    if (isYearly && monthlyPrice > 0) {
        const saved = Math.round((monthlyPrice * 12) - yearlyPrice);
        if (saved > 0) savingsHTML = `<p class="modal-savings">${lang === 'ar' ? `وفّر ${saved} د.ك` : `Save ${saved} KWD`}</p>`;
    }

    const isFeatured = plan.name === 'Pro';

    const modalHTML = `
    <div class="plan-modal-overlay" id="planModalOverlay" onclick="closePlanModalOnBackdrop(event)">
        <div class="plan-modal" role="dialog" aria-modal="true">
            <button class="plan-modal-close" onclick="closePlanModal()" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            ${isFeatured ? `<span class="modal-badge">${lang === 'ar' ? 'الأكثر طلباً' : 'Most Popular'}</span>` : ''}
            <div class="modal-plan-name">${name}</div>

            <div class="modal-price-box">
                <span class="modal-price">${Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
                <span class="modal-price-period">${periodLabel}</span>
            </div>
            ${savingsHTML}

            <div class="modal-features-section">
                <p class="modal-features-title">${lang === 'ar' ? 'المميزات' : 'Features'}</p>
                <ul class="modal-features-list">${featureListHTML}</ul>
                ${showAllBtn}
            </div>
        </div>
    </div>`;

    document.getElementById('planModalOverlay')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleModalKeydown);
}

function closePlanModal() {
    document.getElementById('planModalOverlay')?.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleModalKeydown);
}

function closePlanModalOnBackdrop(e) {
    if (e.target.id === 'planModalOverlay') closePlanModal();
}

function handleModalKeydown(e) {
    if (e.key === 'Escape') closePlanModal();
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

    grid.innerHTML = plans.map((plan, idx) => {
        const name = plan.name || `Plan ${idx + 1}`;
        const monthlyPrice = plan.price_monthly ?? plan.monthly_price ?? 0;
        const yearlyPrice = plan.price_yearly ?? plan.yearly_price ?? (monthlyPrice * 12);
        const displayPrice = isYearly ? yearlyPrice : monthlyPrice;
        const isFeatured = plan.name === 'Pro';

        const periodLabel = isYearly
            ? (lang === 'ar' ? 'د.ك / سنة' : 'KWD / year')
            : (lang === 'ar' ? 'د.ك / شهر' : 'KWD / month');

        const badgeText = isFeatured
            ? (lang === 'ar' ? 'الأكثر طلباً' : 'Most Popular')
            : (isYearly ? (lang === 'ar' ? 'سنوي' : 'Annual') : (lang === 'ar' ? 'شهري' : 'Monthly'));

        const subscribeText = lang === 'ar' ? 'اشترك الآن' : 'Subscribe Now';
        const detailsText = lang === 'ar' ? 'عرض التفاصيل' : 'View Details';

        const features = decodePlanDetails(plan.plan_details, lang);
        const MAX_VIS = 5;
        const vis = features.slice(0, MAX_VIS);
        const hid = features.slice(MAX_VIS);
        const moreCount = hid.length;

        const featureHTML = vis.length
            ? vis.map(f => `<li>${f}</li>`).join('')
            + (moreCount > 0 ? `<li class="plan-feat-more-hint" onclick="openPlanModal(${idx})">${lang === 'ar' ? `+ ${moreCount} ميزة إضافية` : `+ ${moreCount} more features`}</li>` : '')
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
                <span class="plan-price">${Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
                <span class="plan-price-period"> ${periodLabel}</span>
            </div>
            ${savingsHTML}
            <ul class="plan-features">${featureHTML}</ul>
            <div class="plan-card-actions">
                <button class="btn btn-ghost-small" onclick="openPlanModal(${idx})">${detailsText}</button>
                <button class="btn ${isFeatured ? 'btn-primary' : 'btn-outline'}" onclick="handlePaymentClick('https://upayto.me/badia')">${subscribeText}</button>
            </div>
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


});

