window._authIntent = null;
function openAuthModal(tab = 'login', intent = null) {
    switchTab(tab);
    window._authIntent = intent;
    document.getElementById('authModalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeAuthModal() {
    document.getElementById('authModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}
function closeAuthModalOnBackdrop(e) {
    if (e.target.id === 'authModalOverlay') closeAuthModal();
}
function handleSuccessfulAuth(role) {
    closeAuthModal();
    if (window._authIntent === 'partnership') {
        window.location.href = 'account.html#partnership';
    } else if (window._authIntent === 'feasibility') {
        window.location.href = 'account.html#feasibility';
    } else if (window._authIntent === 'payment') {
        window.open('https://upayto.me/badia', '_blank');
        if (typeof updateNavAuthLink === 'function') {
            updateNavAuthLink();
        }
    } else if (role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        const isLandingPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
        if (isLandingPage) {
            if (typeof updateNavAuthLink === 'function') {
                updateNavAuthLink();
            }
        } else {
            window.location.href = 'account.html';
        }
    }
}


        // API_BASE is declared in script.js — do not redeclare here

        // ===== Language for auth page =====
        function initAuthLang() {
            const saved = localStorage.getItem('badia_lang') || 'en';
            setAuthLang(saved, false);
        }

        

        function setAuthLang(lang, save = true) {
            document.documentElement.setAttribute('lang', lang);
            document.documentElement.setAttribute('dir', 'ltr');

            document.querySelectorAll('[data-en][data-ar]').forEach(el => {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
                const val = el.getAttribute(`data-${lang}`);
                if (el.children.length > 0 && val.includes('<')) {
                    el.innerHTML = val;
                } else {
                    el.textContent = val;
                }
            });

            document.querySelectorAll('[data-placeholder-en][data-placeholder-ar]').forEach(el => {
                el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
            });

            const toggleBtn = document.getElementById('authLangToggle');
            if (toggleBtn) toggleBtn.textContent = lang === 'en' ? 'عربي' : 'English';

            if (save) localStorage.setItem('badia_lang', lang);
        }

        function toggleAuthLang() {
            const current = document.documentElement.getAttribute('lang') || 'en';
            setAuthLang(current === 'en' ? 'ar' : 'en');
        }

        /* Tab switch */
        function switchTab(tab, event) {
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault();
            }
            document.querySelectorAll('.auth-tab').forEach((t, i) => {
                t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
            });
            const loginPanel = document.getElementById('panel-login');
            if (loginPanel) loginPanel.classList.toggle('active', tab === 'login');
            const regPanel = document.getElementById('panel-register');
            if (regPanel) regPanel.classList.toggle('active', tab === 'register');
            const forgotPanel = document.getElementById('panel-forgot');
            if (forgotPanel) forgotPanel.classList.remove('active');
            const resetPanel = document.getElementById('panel-reset-token');
            if (resetPanel) resetPanel.classList.remove('active');
            const tabsEl = document.querySelector('.auth-tabs');
            if (tabsEl) {
                tabsEl.style.display = '';
            }
        }

        /* Forgot password view */
        function showForgotPassword(e) {
            e.preventDefault();
            const loginPanel = document.getElementById('panel-login');
            if (loginPanel) loginPanel.classList.remove('active');
            const regPanel = document.getElementById('panel-register');
            if (regPanel) regPanel.classList.remove('active');
            const forgotPanel = document.getElementById('panel-forgot');
            if (forgotPanel) forgotPanel.classList.add('active');
            const resetPanel = document.getElementById('panel-reset-token');
            if (resetPanel) resetPanel.classList.remove('active');
            const tabsEl = document.querySelector('.auth-tabs');
            if (tabsEl) {
                tabsEl.style.display = 'none';
            }
        }



        function backToLogin(e) {
            e.preventDefault();
            const forgotPanel = document.getElementById('panel-forgot');
            if (forgotPanel) forgotPanel.classList.remove('active');
            const resetPanel = document.getElementById('panel-reset-token');
            if (resetPanel) resetPanel.classList.remove('active');
            const loginPanel = document.getElementById('panel-login');
            if (loginPanel) loginPanel.classList.add('active');
            const tabsEl = document.querySelector('.auth-tabs');
            if (tabsEl) {
                tabsEl.style.display = '';
            }
        }

        /* Toggle password visibility */
        function togglePass(ids, btn) {
            const idList = ids.split(',');
            if (idList.length === 0) return;
            const firstInp = document.getElementById(idList[0].trim());
            if (!firstInp) return;
            const isPass = firstInp.type === 'password';
            const nextType = isPass ? 'text' : 'password';

            idList.forEach(id => {
                const inp = document.getElementById(id.trim());
                if (inp) inp.type = nextType;
            });

            const icon = btn.querySelector('i');
            if (icon) {
                if (isPass) {
                    icon.className = 'fa-regular fa-eye-slash';
                } else {
                    icon.className = 'fa-regular fa-eye';
                }
            }
        }

        /* Password strength */
        function checkStrength(val) {
            const bars = [document.getElementById('sb1'), document.getElementById('sb2'), document.getElementById('sb3'), document.getElementById('sb4')];
            const label = document.getElementById('strengthLabel');
            bars.forEach(b => { b.className = 'strength-bar'; });
            if (!val) { label.textContent = ''; return; }
            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;
            const levels = ['', 'weak', 'fair', 'strong', 'strong'];
            const lang = document.documentElement.getAttribute('lang') || 'en';
            const labelsEN = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
            const labelsAR = ['', 'ضعيفة', 'مقبولة', 'قوية', 'قوية جداً'];
            const colors = ['', '#e74c3c', '#f39c12', '#27ae60', '#27ae60'];
            for (let i = 0; i < score; i++) bars[i].classList.add(levels[score]);
            label.textContent = lang === 'ar' ? labelsAR[score] : labelsEN[score];
            label.style.color = colors[score];
        }

        /* Toast helper */
        function showToast(msg, type) {
            document.querySelectorAll('.notification').forEach(n => n.remove());
            const el = document.createElement('div');
            el.className = 'notification';
            el.textContent = msg;
            el.style.background = type === 'success' ? '#10b981' : '#ef4444';
            el.style.color = 'white';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        }

        /* Google OAuth — redirect to backend */
        function handleGoogleAuth() {
            window.location.href = `${API_BASE}/api/v1/auth/google`;
        }
        const googleLoginBtn = document.getElementById('googleLoginBtn');
        if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleAuth);
        const googleRegBtn = document.getElementById('googleRegBtn');
        if (googleRegBtn) googleRegBtn.addEventListener('click', handleGoogleAuth);

        /* Handle URL params (OAuth, Verification, Password Reset) on page load */
        async function handleURLParams() {
            const params = new URLSearchParams(window.location.search);
            
            // 1. Google OAuth Callback (Tokens in URL)
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (accessToken) {
                localStorage.setItem('access_token', accessToken);
                if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
                const lang = document.documentElement.getAttribute('lang') || 'en';
                showToast(lang === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!', 'success');
                // Clean URL query parameters
                window.history.replaceState({}, document.title, window.location.pathname);
                // Fetch user profile to determine role for redirect
                try {
                    const res = await fetch(`${API_BASE}/api/v1/users/me`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const role = data.user_info?.role;
                        if (role) localStorage.setItem('user_role', role);
                        setTimeout(() => window.location.href = role === 'admin' ? 'admin.html' : 'account.html', 1000);
                    } else {
                        setTimeout(() => window.location.href = 'account.html', 1000);
                    }
                } catch {
                    setTimeout(() => window.location.href = 'account.html', 1000);
                }
                return;
            }

            // 1b. Google OAuth Callback (Code in URL)
            const code = params.get('code');
            if (code) {
                const lang = document.documentElement.getAttribute('lang') || 'en';
                showToast(lang === 'ar' ? 'جاري التحقق من حساب Google...' : 'Authenticating with Google...', 'success');
                try {
                    const res = await fetch(`${API_BASE}/api/v1/auth/google/callback?code=${code}&remember_me=true`, {
                        method: 'GET'
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const authHeader = res.headers.get('Authorization') || res.headers.get('authorization');
                        const token = authHeader ? authHeader.replace('Bearer ', '') : data.access_token;
                        if (token) localStorage.setItem('access_token', token);
                        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
                        const role = data.user_info?.role;
                        if (role) localStorage.setItem('user_role', role);
                        showToast(lang === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!', 'success');
                        window.history.replaceState({}, document.title, window.location.pathname);
                        setTimeout(() => window.location.href = role === 'admin' ? 'admin.html' : 'account.html', 1000);
                    } else {
                        const err = await res.json();
                        showToast(err.detail || (lang === 'ar' ? 'فشل تسجيل الدخول باستخدام Google' : 'Google sign-in failed'), 'error');
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } catch {
                    showToast(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                return;
            }


            // 2. Email Verification Token
            const verifyToken = params.get('verify_token');
            if (verifyToken) {
                const lang = document.documentElement.getAttribute('lang') || 'en';
                showToast(lang === 'ar' ? 'جاري التحقق من بريدك الإلكتروني...' : 'Verifying your email...', 'success');
                try {
                    const res = await fetch(`${API_BASE}/api/v1/email/auth/verify-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: verifyToken })
                    });
                    if (res.ok) {
                        showToast(lang === 'ar' ? 'تم تفعيل البريد الإلكتروني بنجاح!' : 'Email verified successfully!', 'success');
                    } else {
                        const err = await res.json();
                        showToast(err.detail || (lang === 'ar' ? 'فشل تفعيل البريد الإلكتروني' : 'Email verification failed'), 'error');
                    }
                } catch {
                    showToast(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
                }
                // Clean URL query parameters
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            // 3. Password Reset Token
            const resetToken = params.get('reset_token');
            if (resetToken) {
                // Switch to reset password tab
                document.getElementById('panel-login').classList.remove('active');
                document.getElementById('panel-register').classList.remove('active');
                document.getElementById('panel-forgot').classList.remove('active');
                document.getElementById('panel-reset-token').classList.add('active');
                document.querySelector('.auth-tabs').style.display = 'none';
                
                // Pre-fill token input
                document.getElementById('resetToken').value = resetToken;
                
                // Clean URL but keep token in field
                window.history.replaceState({}, document.title, window.location.pathname);
                
                const lang = document.documentElement.getAttribute('lang') || 'en';
                showToast(lang === 'ar' ? 'تم استيراد رمز إعادة التعيين تلقائياً. يرجى إدخال كلمة مرور جديدة.' : 'Reset token imported automatically. Please enter a new password.', 'success');
            }
        }

        /* Login form — hits the backend */
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            let valid = true;
            const lang = document.documentElement.getAttribute('lang') || 'en';
            const email = document.getElementById('loginEmail');
            const pass  = document.getElementById('loginPass');
            const emailErr = document.getElementById('loginEmailErr');
            const passErr  = document.getElementById('loginPassErr');

            emailErr.classList.remove('visible'); email.classList.remove('error');
            passErr.classList.remove('visible');  pass.classList.remove('error');

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
                emailErr.classList.add('visible'); email.classList.add('error'); valid = false;
            }
            if (!pass.value) {
                passErr.classList.add('visible'); pass.classList.add('error'); valid = false;
            }
            if (!valid) return;

            const btn = this.querySelector('.btn-submit');
            btn.disabled = true;
            btn.querySelector('span').textContent = lang === 'ar' ? 'جاري التحقق...' : 'Signing in...';

            const rememberMeEl = document.getElementById('rememberMe');
            const rememberMe = rememberMeEl ? rememberMeEl.checked : false;

            try {
                const res = await fetch(`${API_BASE}/api/v1/auth/login?remember_me=${rememberMe}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.value, password: pass.value, remember_me: rememberMe })
                });

                if (res.ok) {
                    const data = await res.json();
                    const authHeader = res.headers.get('Authorization') || res.headers.get('authorization');
                    const token = authHeader ? authHeader.replace('Bearer ', '') : data.access_token;
                    if (token) localStorage.setItem('access_token', token);
                    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);

                    // Try to get role from login response first
                    let role = data.user_info?.role;

                    // If login response doesn't include role, fetch it from /users/me
                    if (!role && token) {
                        try {
                            const meRes = await fetch(`${API_BASE}/api/v1/users/me`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (meRes.ok) {
                                const meData = await meRes.json();
                                role = meData.user_info?.role;
                            }
                        } catch { /* ignore, will default to account.html */ }
                    }

                    if (role) localStorage.setItem('user_role', role);
                    showToast(lang === 'ar' ? 'تم تسجيل الدخول بنجاح! جاري التحويل...' : 'Signed in successfully! Redirecting...', 'success');
                    setTimeout(() => handleSuccessfulAuth(role), 1500);







                } else {
                    const err = await res.json();
                    showToast(err.detail || (lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'), 'error');
                    btn.disabled = false;
                    btn.querySelector('span').textContent = lang === 'ar' ? 'دخول إلى الحساب →' : 'Sign In →';
                }
            } catch {
                showToast(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
                btn.disabled = false;
                btn.querySelector('span').textContent = lang === 'ar' ? 'دخول إلى الحساب →' : 'Sign In →';
            }
        });

        /* Register form — hits POST /api/v1/auth/register_local */
        document.getElementById('registerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const lang = document.documentElement.getAttribute('lang') || 'en';

            const firstName = document.getElementById('regFirst').value.trim();
            const lastName = document.getElementById('regLast').value.trim();
            const company = document.getElementById('regCompany').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const password = document.getElementById('regPass').value;
            const confirmPassword = document.getElementById('regConfirmPass').value;
            const agreed = document.getElementById('agreeTerms').checked;
            const regRememberMeEl = document.getElementById('regRememberMe');
            const regRememberMe = regRememberMeEl ? regRememberMeEl.checked : false;

            // Validation
            if (!firstName || !lastName || !company || !email || !password || !confirmPassword) {
                showToast(lang === 'ar' ? 'جميع الحقول المطلوبة يجب ملؤها' : 'All required fields must be filled', 'error');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                document.getElementById('regEmailErr').classList.add('visible');
                return;
            }
            document.getElementById('regEmailErr').classList.remove('visible');

            if (password.length < 8) {
                showToast(lang === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters', 'error');
                return;
            }
            if (password !== confirmPassword) {
                showToast(lang === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match', 'error');
                return;
            }
            if (!agreed) {
                showToast(lang === 'ar' ? 'يجب الموافقة على شروط الاستخدام' : 'You must agree to the Terms of Use', 'error');
                return;
            }

            const btn = this.querySelector('.btn-submit');
            btn.disabled = true;
            btn.querySelector('span').textContent = lang === 'ar' ? 'جاري إنشاء الحساب...' : 'Creating account...';

            try {
                const res = await fetch(`${API_BASE}/api/v1/auth/register_local`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        company_name: company,
                        email: email,
                        password: password,
                        phone: phone || null,
                        remember_me: regRememberMe
                    })
                });

                const data = await res.json();

                if (res.ok || res.status === 201) {
                    localStorage.setItem('access_token', data.access_token);
                    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
                    showToast(lang === 'ar' ? 'تم إنشاء الحساب بنجاح! جاري التحويل...' : 'Account created successfully! Redirecting...', 'success');
                    setTimeout(() => handleSuccessfulAuth('user'), 1500);
                } else {
                    showToast(data.detail || (lang === 'ar' ? 'حدث خطأ أثناء التسجيل' : 'Registration error'), 'error');
                    btn.disabled = false;
                    btn.querySelector('span').textContent = lang === 'ar' ? 'إنشاء الحساب →' : 'Create Account →';
                }
            } catch {
                showToast(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
                btn.disabled = false;
                btn.querySelector('span').textContent = lang === 'ar' ? 'إنشاء الحساب →' : 'Create Account →';
            }
        });

        /* Forgot password form */
        let resetEmailCooldown = 0;
        document.getElementById('forgotForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            if (resetEmailCooldown > 0) return;

            const lang = document.documentElement.getAttribute('lang') || 'en';
            const email = document.getElementById('forgotEmail').value.trim();

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast(lang === 'ar' ? 'أدخل بريداً إلكترونياً صحيحاً' : 'Enter a valid email', 'error');
                return;
            }

            const btn = this.querySelector('.btn-submit');
            btn.disabled = true;
            btn.querySelector('span').textContent = lang === 'ar' ? 'جاري الإرسال...' : 'Sending...';

            try {
                await fetch(`${API_BASE}/api/v1/email/auth/forgot-password?email=${encodeURIComponent(email)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                // Always show success (security — don't reveal if email exists)
                showToast(lang === 'ar' ? 'إذا كان البريد مسجلاً، تم إرسال رابط إعادة التعيين' : 'If the email exists, a reset link has been sent', 'success');
                
                // Cooldown logic
                resetEmailCooldown = 60;
                const updateBtn = () => {
                    if (resetEmailCooldown > 0) {
                        btn.disabled = true;
                        btn.querySelector('span').textContent = lang === 'ar' ? `إعادة الإرسال بعد ${resetEmailCooldown} ثانية` : `Resend in ${resetEmailCooldown}s`;
                        resetEmailCooldown--;
                        setTimeout(updateBtn, 1000);
                    } else {
                        btn.disabled = false;
                        btn.querySelector('span').textContent = lang === 'ar' ? 'إرسال رابط إعادة التعيين →' : 'Send Reset Link →';
                    }
                };
                updateBtn();
            } catch {
                showToast(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
                btn.disabled = false;
                btn.querySelector('span').textContent = lang === 'ar' ? 'إرسال رابط إعادة التعيين →' : 'Send Reset Link →';
            }
        });

        /* Reset Password with Token form */
        document.getElementById('resetTokenForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const lang = document.documentElement.getAttribute('lang') || 'en';
            const token = document.getElementById('resetToken').value.trim();
            const newPassword = document.getElementById('resetNewPass').value;

            if (!token) {
                showToast(lang === 'ar' ? 'يرجى إدخال رمز إعادة التعيين' : 'Please enter the reset token', 'error');
                return;
            }
            if (newPassword.length < 8) {
                showToast(lang === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters', 'error');
                return;
            }

            const btn = this.querySelector('.btn-submit');
            btn.disabled = true;
            btn.querySelector('span').textContent = lang === 'ar' ? 'جاري إعادة التعيين...' : 'Resetting...';

            try {
                const res = await fetch(`${API_BASE}/api/v1/email/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, new_password: newPassword })
                });

                if (res.ok) {
                    showToast(lang === 'ar' ? 'تم إعادة تعيين كلمة المرور بنجاح!' : 'Password reset successfully!', 'success');
                    setTimeout(() => {
                        // Switch to login tab
                        switchTab('login');
                        // Clear fields
                        document.getElementById('resetToken').value = '';
                        document.getElementById('resetNewPass').value = '';
                    }, 1500);
                } else {
                    const err = await res.json();
                    showToast(err.detail || (lang === 'ar' ? 'فشل إعادة تعيين كلمة المرور' : 'Password reset failed'), 'error');
                }
            } catch {
                showToast(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
            }
            btn.disabled = false;
            btn.querySelector('span').textContent = lang === 'ar' ? 'إعادة تعيين كلمة المرور →' : 'Reset Password →';
        });

        handleURLParams();
        // Init
        initAuthLang();
        // ===== Nav Auth & Service Gates (Moved from script.js) =====
        window.handlePaymentClick = function(url) { if (localStorage.getItem('access_token')) { window.open(url, '_blank'); } else { if(typeof openAuthModal === 'function') { openAuthModal('login', 'payment'); } } };

        window.handleServiceRequest = function(serviceType) {
            var isLoggedIn = !!localStorage.getItem('access_token');
            if (isLoggedIn) {
                var destinations = {
                    partnership: 'account.html#partnership',
                    feasibility: 'account.html#feasibility'
                };
                window.location.href = destinations[serviceType] || 'account.html';
            } else {
                if (typeof openAuthModal === 'function') {
                    openAuthModal('login', serviceType);
                }
            }
        };

        window.updateNavAuthLink = function() {
            const desktopAuth = document.getElementById('navAuthDesktop');
            const mobileAuth = document.getElementById('navMobileAuth');
            const token = localStorage.getItem('access_token');
            const lang = document.documentElement.getAttribute('lang') || 'en';

            if (token) {
                const role = localStorage.getItem('user_role');
                const targetUrl = role === 'admin' ? 'admin.html' : 'account.html';

                // Logged in → replace both auth zones with a single link
                const accountLabelEN = role === 'admin' ? 'Admin Dashboard' : 'My Account';
                const accountLabelAR = role === 'admin' ? 'لوحة الإدارة' : 'حسابي';
                const label = lang === 'ar' ? accountLabelAR : accountLabelEN;

                if (desktopAuth) {
                    desktopAuth.innerHTML = `<a href="${targetUrl}" class="nav-btn-account"
                        data-en="${accountLabelEN}" data-ar="${accountLabelAR}"><i class="fa-solid fa-user-gear"></i> ${label}</a>`;
                }
                if (mobileAuth) {
                    mobileAuth.innerHTML = `<a href="${targetUrl}" class="nav-btn-register" style="flex:1;text-align:center;display:flex;align-items:center;justify-content:center;gap:.4rem"
                        data-en="${accountLabelEN}" data-ar="${accountLabelAR}"><i class="fa-solid fa-user-gear"></i> ${label}</a>`;
                }
            } else {
                // Not logged in → show Login only
                const siEN = 'Login', siAR = 'تسجيل الدخول';
                const si = lang === 'ar' ? siAR : siEN;

                if (desktopAuth) {
                    desktopAuth.innerHTML = `
                        <button onclick="openAuthModal('login')" class="nav-btn-signin" id="navSignIn" data-en="${siEN}" data-ar="${siAR}"><i class="fa-regular fa-user"></i> ${si}</button>`;
                }
                if (mobileAuth) {
                    mobileAuth.innerHTML = `
                        <button onclick="openAuthModal('login')" class="nav-btn-signin" data-en="${siEN}" data-ar="${siAR}"><i class="fa-regular fa-user"></i> ${si}</button>`;
                }
            }
            // Sync service gates with current auth state
            if (typeof updateServiceGates === 'function') {
                updateServiceGates();
            }
        };

        window.updateServiceGates = function() {
            const token = localStorage.getItem('access_token');
            const isLoggedIn = !!token;
            const lang = document.documentElement.getAttribute('lang') || 'en';

            document.querySelectorAll('.service-gate').forEach(gate => {
                const blockId = gate.closest('.service-block')?.id;
                const serviceType = blockId === 'service-operations' ? 'partnership' : 'feasibility';
                const cta = gate.querySelector('.service-gate-cta');
                if (!cta) return;

                if (isLoggedIn) {
                    gate.classList.add('gate-open');
                    gate.classList.remove('gate-locked');

                    const btnEN = serviceType === 'partnership' ? 'Request Operational Partnership' : 'Request Feasibility Study';
                    const btnAR = serviceType === 'partnership' ? 'اطلب الشراكة التشغيلية' : 'اطلب دراسة الجدوى';
                    const msgEN = serviceType === 'partnership'
                        ? "You're all set. Submit your request and our team will follow up within 24 hours."
                        : "You're all set. Submit your request and we'll reach out to start your study.";
                    const msgAR = serviceType === 'partnership'
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
                        const msgEN = serviceType === 'partnership'
                            ? 'Sign in or create an account to request this service and access your partnership dashboard.'
                            : 'Sign in or create an account to request a feasibility study and track your project through your dashboard.';
                        const msgAR = serviceType === 'partnership'
                            ? 'سجّل دخولك أو أنشئ حساباً لطلب هذه الخدمة والوصول إلى لوحة الشراكة.'
                            : 'سجّل دخولك أو أنشئ حساباً لطلب دراسة الجدوى ومتابعة مشروعك عبر لوحة التحكم.';
                        const btnEN = serviceType === 'partnership' ? 'Request Operational Partnership' : 'Request Feasibility Study';
                        const btnAR = serviceType === 'partnership' ? 'اطلب الشراكة التشغيلية' : 'اطلب دراسة الجدوى';

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
        };