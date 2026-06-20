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
        // Google button listeners will be attached in initAuthForm()

        /* Handle URL params (OAuth, Verification, Password Reset) on page load */
        async function handleURLParams() {
            const params = new URLSearchParams(window.location.search);
            
            // Check for open_signin query param
            const openSignin = params.get('open_signin');
            if (openSignin === 'true') {
                if (typeof openAuthModal === 'function') {
                    openAuthModal('login');
                }
                const newParams = new URLSearchParams(window.location.search);
                newParams.delete('open_signin');
                const newSearch = newParams.toString();
                const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
                window.history.replaceState({}, document.title, newUrl);
            }
            
            // 1. Google OAuth Callback (logged_in=1 in URL)
            const loggedIn = params.get('logged_in');
            if (loggedIn === '1') {
                try {
                    const res = await fetch(`${API_BASE}/api/v1/users/me`, {
                        credentials: 'include',
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const role = data.user_info?.role || 'user';
                        document.cookie = `badia_role=${role}; path=/; max-age=2592000; samesite=lax`;
                        document.documentElement.style.display = '';
                        window.history.replaceState({}, document.title, window.location.pathname);
                        window.location.replace(role === 'admin' ? 'admin.html' : 'account.html');
                    } else {
                        document.documentElement.style.display = '';
                        window.location.replace('account.html');
                    }
                } catch {
                    document.documentElement.style.display = '';
                    window.location.replace('account.html');
                }
                return;
            }


            // 2. Email Verification Token
            const verifyToken = params.get('verify_token');
            if (verifyToken) {
                const lang = document.documentElement.getAttribute('lang') || 'en';
                showToast(lang === 'ar' ? 'جاري التحقق من بريدك الإلكتروني...' : 'Verifying your email...', 'success');
                try {
                    const res = await fetch(`${API_BASE}/api/v1/auth/verify-email`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
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
            const resetTokenPanel = document.getElementById('panel-reset-token');
            if (resetToken && resetTokenPanel) {
                // Switch to reset password tab
                const loginPanel = document.getElementById('panel-login');
                const regPanel = document.getElementById('panel-register');
                const forgotPanel = document.getElementById('panel-forgot');
                if (loginPanel) loginPanel.classList.remove('active');
                if (regPanel) regPanel.classList.remove('active');
                if (forgotPanel) forgotPanel.classList.remove('active');
                resetTokenPanel.classList.add('active');
                const authTabs = document.querySelector('.auth-tabs');
                if (authTabs) authTabs.style.display = 'none';
                
                // Pre-fill token input
                const resetTokenInput = document.getElementById('resetToken');
                if (resetTokenInput) resetTokenInput.value = resetToken;
                
                // Clean URL but keep token in field
                window.history.replaceState({}, document.title, window.location.pathname);
                
                const lang = document.documentElement.getAttribute('lang') || 'en';
                showToast(lang === 'ar' ? 'تم استيراد رمز إعادة التعيين تلقائياً. يرجى إدخال كلمة مرور جديدة.' : 'Reset token imported automatically. Please enter a new password.', 'success');
            }
        }

        /* Login form — hits the backend */
        async function onLoginFormSubmit(e) {
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

            try {
                const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
                    body: JSON.stringify({ email: email.value, password: pass.value })
                });

                if (res.ok) {
                    if (typeof clearUserDataCache === 'function') clearUserDataCache();
                    
                    // Fetch user info to get the role since login response doesn't contain it
                    const userRes = await fetch(`${API_BASE}/api/v1/users/me`, { credentials: 'include' });
                    let role = 'user';
                    if (userRes.ok) {
                        const userData = await userRes.json();
                        role = userData.user_info?.role || 'user';
                        document.cookie = `badia_role=${role}; path=/; max-age=2592000; samesite=lax`;
                        if (typeof setCachedUser === 'function') setCachedUser(userData.user_info);
                    }

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
        }

        /* Register form — hits POST /api/v1/auth/register_local */
        async function onRegisterFormSubmit(e) {
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
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        company_name: company,
                        email: email,
                        password: password,
                        phone: phone || null
                    })
                });

                const data = await res.json();

                if (res.ok || res.status === 201) {
                    if (typeof clearUserDataCache === 'function') clearUserDataCache();
                    const role = data.role || (data.user_info ? data.user_info.role : 'user');
                    showToast(lang === 'ar' ? 'تم إنشاء الحساب بنجاح! جاري التحويل...' : 'Account created successfully! Redirecting...', 'success');
                    setTimeout(() => handleSuccessfulAuth(role), 1500);
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
        }

        /* Forgot password form */
        let resetEmailCooldown = 0;
        async function onForgotFormSubmit(e) {
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
                const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
                    body: JSON.stringify({ email })
                });

                if (res.ok) {
                    showToast(lang === 'ar' ? 'تم إرسال رابط إعادة التعيين! يرجى التحقق من بريدك الوارد ومجلد البريد العشوائي (Spam) أو المهملات.' : 'Reset link sent! Please check your inbox and your spam or delete folder.', 'success');
                    
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
                } else {
                    const data = await res.json().catch(() => ({}));
                    const errMsg = data.detail || (lang === 'ar' ? 'البريد الإلكتروني غير مسجل لدينا' : 'This email is not registered with us');
                    showToast(errMsg, 'error');
                    btn.disabled = false;
                    btn.querySelector('span').textContent = lang === 'ar' ? 'إرسال رابط إعادة التعيين →' : 'Send Reset Link →';
                }
            } catch {
                showToast(lang === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Connection error', 'error');
                btn.disabled = false;
                btn.querySelector('span').textContent = lang === 'ar' ? 'إرسال رابط إعادة التعيين →' : 'Send Reset Link →';
            }
        }

        /* Reset Password with Token form */
        const resetTokenForm = document.getElementById('resetTokenForm');
        async function onResetTokenFormSubmit(e) {
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
                    const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
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
            }

        let authFormInitialized = false;
        function initAuthForm() {
            if (authFormInitialized) return;
            const loginForm = document.getElementById('loginForm');
            if (!loginForm) return;
            authFormInitialized = true;

            const googleLoginBtn = document.getElementById('googleLoginBtn');
            if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleAuth);
            const googleRegBtn = document.getElementById('googleRegBtn');
            if (googleRegBtn) googleRegBtn.addEventListener('click', handleGoogleAuth);

            loginForm.addEventListener('submit', onLoginFormSubmit);
            
            const registerForm = document.getElementById('registerForm');
            if (registerForm) registerForm.addEventListener('submit', onRegisterFormSubmit);

            const forgotForm = document.getElementById('forgotForm');
            if (forgotForm) forgotForm.addEventListener('submit', onForgotFormSubmit);

            const resetTokenForm = document.getElementById('resetTokenForm');
            if (resetTokenForm) resetTokenForm.addEventListener('submit', onResetTokenFormSubmit);
        }

        handleURLParams();
        // Init
        initAuthForm();
        // ===== Nav Auth & Service Gates (Moved from script.js) =====
        window.handlePaymentClick = function(url) { if (isLoggedIn()) { window.open(url, '_blank'); } else { if(typeof openAuthModal === 'function') { openAuthModal('login', 'payment'); } } };

        window.handleServiceRequest = function(serviceType) {
            if (isLoggedIn()) {
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
            const userLoggedIn = isLoggedIn();
            const lang = document.documentElement.getAttribute('lang') || 'en';

            if (userLoggedIn) {
                const role = getUserRole();
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
            const userLoggedIn = isLoggedIn();
            const lang = document.documentElement.getAttribute('lang') || 'en';

            document.querySelectorAll('.service-gate').forEach(gate => {
                const blockId = gate.closest('.service-block')?.id;
                const serviceType = blockId === 'service-operations' ? 'partnership' : 'feasibility';
                const cta = gate.querySelector('.service-gate-cta');
                if (!cta) return;

                if (userLoggedIn) {
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
        // Initialize UI state on script load
        if (typeof window.updateNavAuthLink === 'function') {
            window.updateNavAuthLink();
        }

        // Verify session validity with backend on index page load using the minimal endpoint
        const isLandingPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname.endsWith('/');
        if (isLandingPage) {
            async function checkSession() {
                try {
                    let res = await fetch(`${API_BASE}/api/v1/users/me?minimal=true`, { credentials: 'include' });
                    if (res.status === 401 && typeof tryRefreshToken === 'function') {
                        const refreshed = await tryRefreshToken();
                        if (refreshed) {
                            res = await fetch(`${API_BASE}/api/v1/users/me?minimal=true`, { credentials: 'include' });
                        }
                    }
                    if (res.ok) {
                        // User is actually logged in according to source of truth
                        if (!isLoggedIn()) {
                            // Missing role cookie, get full profile to set it and update UI
                            const fullRes = await fetch(`${API_BASE}/api/v1/users/me`, { credentials: 'include' });
                            if (fullRes.ok) {
                                const data = await fullRes.json();
                                const role = data.user_info?.role || 'user';
                                document.cookie = `badia_role=${role}; path=/; max-age=2592000; samesite=lax`;
                            }
                        }
                        if (typeof window.updateNavAuthLink === 'function') {
                            window.updateNavAuthLink();
                        }
                    } else {
                        // Not authenticated according to backend
                        if (isLoggedIn()) {
                            clearCachedUser();
                            if (typeof window.updateNavAuthLink === 'function') {
                                window.updateNavAuthLink();
                            }
                        }
                    }
                } catch (err) {
                    // Ignore connection errors
                }
            }
            checkSession();
        }