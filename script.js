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

    if (!data.name || !data.email || !data.phone || !data.message) {
        showNotification('جميع الحقول مطلوبة', 'error'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        showNotification('البريد الإلكتروني غير صحيح', 'error'); return;
    }

    const btn = document.getElementById('submitBtn');
    const orig = btn.textContent;
    btn.textContent = 'جاري الإرسال...';
    btn.disabled = true;

    setTimeout(() => {
        showNotification('تم إرسال رسالتك بنجاح! سنتواصل معك قريباً', 'success');
        this.reset();
        btn.textContent = orig;
        btn.disabled = false;
    }, 1500);
});

// ===== Notification =====
function showNotification(msg, type = 'success') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    const el = document.createElement('div');
    el.className = `notification`;
    el.textContent = msg;
    Object.assign(el.style, {
        position: 'fixed', top: '20px', right: '20px', padding: '1rem 1.5rem',
        borderRadius: '5px', fontSize: '1rem', fontWeight: '500', zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,.15)', maxWidth: '400px', fontFamily: 'Tajawal, sans-serif',
        background: type === 'success' ? '#10b981' : '#ef4444', color: 'white',
        animation: 'slideIn .3s ease-out'
    });
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3000);
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

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.service-block, .about-card, .portfolio-item, .testimonial-card, .blog-card, .usp-item').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.6s ease-out';
        observer.observe(card);
    });
});

// ===== Navbar Scroll Effect =====
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.style.boxShadow = window.scrollY > 100 ? '0 4px 15px rgba(0,0,0,.1)' : '0 2px 10px rgba(0,0,0,.05)';
});

// ===== Active Nav Link =====
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const links = document.querySelectorAll('.nav-links a');
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

// ===== Load =====
window.addEventListener('load', () => console.log('✓ BADIA website loaded'));