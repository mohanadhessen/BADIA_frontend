// ===== API Base URL =====
const API_BASE = 'http://127.0.0.1:8000';

// ===== Language System =====
function initLanguage() {
    const saved = localStorage.getItem('badia_lang') || 'en';
    setLanguage(saved, false);
}

function setLanguage(lang, save = true) {
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    // Update all elements with data-en / data-ar
    document.querySelectorAll('[data-en][data-ar]').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return; // skip — handled by placeholder
        el.textContent = el.getAttribute(`data-${lang}`);
    });

    // Update placeholders
    document.querySelectorAll('[data-placeholder-en][data-placeholder-ar]').forEach(el => {
        el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
    });

    // Update toggle button text
    const toggleBtn = document.querySelector('.lang-toggle-text');
    if (toggleBtn) {
        toggleBtn.textContent = lang === 'en' ? 'عربي' : 'English';
    }

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.content = lang === 'ar'
            ? 'بادية - شريكك الموثوق في الاستشارات التجارية والإدارة التشغيلية ودراسات الجدوى والخدمات المحاسبية في الكويت.'
            : 'BADIA – Your trusted partner in business consulting, operational management, feasibility studies, and accounting services in Kuwait.';
    }

    // Update nav auth link
    updateNavAuthLink();

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
    initLanguage();

    // Init animations
    document.querySelectorAll('.service-block, .about-card, .portfolio-item, .testimonial-card, .blog-card, .usp-item').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.6s ease-out';
        observer.observe(card);
    });

    // Update nav auth link on load
    updateNavAuthLink();
});

// ===== Nav Auth Link =====
function updateNavAuthLink() {
    const link = document.getElementById('navAuthLink');
    if (!link) return;
    const token = localStorage.getItem('access_token');
    const lang = getCurrentLang();
    if (token) {
        link.href = 'account.html';
        link.setAttribute('data-en', 'My Account');
        link.setAttribute('data-ar', 'حسابي');
        link.textContent = lang === 'ar' ? 'حسابي' : 'My Account';
    } else {
        link.href = 'Signin.html';
        link.setAttribute('data-en', 'Login');
        link.setAttribute('data-ar', 'تسجيل الدخول');
        link.textContent = lang === 'ar' ? 'تسجيل الدخول' : 'Login';
    }
}

// ===== Smooth Scroll =====
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

document.querySelectorAll('.nav-links a, .footer-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
            e.preventDefault();
            const el = document.getElementById(href.substring(1));
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            // Close mobile menu
            document.getElementById('navLinks')?.classList.remove('open');
        }
    });
});

// ===== Mobile Menu Toggle =====
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');
if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
}

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
    if (nav) nav.style.boxShadow = window.scrollY > 100 ? '0 4px 15px rgba(0,0,0,.1)' : '0 2px 10px rgba(0,0,0,.05)';
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

// ===== Load =====
window.addEventListener('load', () => console.log('✓ BADIA website loaded'));