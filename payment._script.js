  const CARD_METHODS   = ['card', 'amex'];
  const WALLET_METHODS = ['apple', 'google'];
  const KNET_METHODS   = ['knet'];

  let detectedBrand = null;

  const PAY_LABELS = {
    en: {
      knet:       'Pay with KNET',
      card:       'Pay with Card',
      visa:       'Pay with Visa',
      mastercard: 'Pay with Mastercard',
      amex:       'Pay with Amex',
      apple:      'Pay with Apple Pay',
      google:     'Pay with Google Pay',
      default:    'Select a payment method',
      processing: 'Processing…',
      success:    'Payment successful! Redirecting…',
      error:      'Payment failed. Please try again.',
    },
    ar: {
      knet:       'الدفع عبر KNET',
      card:       'الدفع بالبطاقة',
      visa:       'الدفع عبر فيزا',
      mastercard: 'الدفع عبر ماستركارد',
      amex:       'AMEX الدفع عبر ',
      apple:      'الدفع عبر آبل باي',
      google:     'الدفع عبر جوجل باي',
      default:    'اختر طريقة الدفع',
      processing: 'جاري المعالجة…',
      success:    'تم الدفع بنجاح! جاري التحويل…',
      error:      'فشل الدفع. يرجى المحاولة مرة أخرى.',
    }
  };

  // Asset paths for live detection inside form field badge
  const BRAND_ASSET = {
    visa:       'assets/credit-card-svgrepo-com.svg', // generic fallback or unique asset path if added later
    mastercard: 'assets/credit-card-svgrepo-com.svg',
    amex:       'assets/amex-credit-card-svgrepo-com.svg'
  };

  // ─── State ────────────────────────────────────────────────────
  let selectedMethod = null;
  let currentLang    = localStorage.getItem('badia_lang') || 'en';

  // ─── DOM refs ─────────────────────────────────────────────────
  const grid          = document.getElementById('methodsGrid');
  const cardSection   = document.getElementById('cardFormSection');
  const walletSection = document.getElementById('walletSection');
  const knetSection   = document.getElementById('knetSection');
  const payBtn        = document.getElementById('payBtn');
  const payBtnText    = document.getElementById('payBtnText');
  const langBtn       = document.getElementById('langBtn');
  const cardNumberIn  = document.getElementById('cardNumber');
  const cardBrand     = document.getElementById('cardBrandBadge');

  // ─── Language ─────────────────────────────────────────────────
  function applyLang(lang) {
    currentLang = lang;
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    langBtn.textContent = lang === 'en' ? 'عربي' : 'English';
    localStorage.setItem('badia_lang', lang);

    document.querySelectorAll('[data-en][data-ar]').forEach(el => {
      if (el.tagName === 'INPUT') return;
      if (el.classList.contains('method-wallet-text')) return; // keep literal "Pay" text intact
      if (el.classList.contains('method-btn')) return;
      el.textContent = el.getAttribute(`data-${lang}`);
    });
    document.querySelectorAll('[data-placeholder-en]').forEach(el => {
      el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
    });

    if (selectedMethod) {
      if (selectedMethod === 'card' && detectedBrand) {
        payBtnText.textContent = PAY_LABELS[lang][detectedBrand];
      } else {
        payBtnText.textContent = PAY_LABELS[lang][selectedMethod];
      }
    } else {
      payBtnText.textContent = PAY_LABELS[lang].default;
    }
  }

  langBtn.addEventListener('click', () => applyLang(currentLang === 'en' ? 'ar' : 'en'));
  applyLang(currentLang);

  // ─── Method selection ─────────────────────────────────────────
  grid.querySelectorAll('.method-btn').forEach(btn => {
    btn.addEventListener('click', () => selectMethod(btn.dataset.method));
  });

  function selectMethod(method) {
    selectedMethod = method;

    grid.querySelectorAll('.method-btn').forEach(b => {
      const isActive = b.dataset.method === method;
      b.classList.toggle('selected', isActive);
      b.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    cardSection.classList.toggle('visible', CARD_METHODS.includes(method));
    walletSection.classList.toggle('visible', WALLET_METHODS.includes(method));
    knetSection.classList.toggle('visible', KNET_METHODS.includes(method));

    payBtn.disabled = false;
    
    if (method === 'card' && detectedBrand) {
      payBtnText.textContent = PAY_LABELS[currentLang][detectedBrand];
    } else {
      payBtnText.textContent = PAY_LABELS[currentLang][method];
    }
  }

  // ─── Card number formatting + brand detection ─────────────────
  cardNumberIn?.addEventListener('input', () => {
    let raw = cardNumberIn.value.replace(/\D/g, '').slice(0, 16);
    cardNumberIn.value = raw.replace(/(.{4})/g, '$1 ').trim();
    detectBrand(raw);
    cardNumberIn.classList.remove('error');
    document.getElementById('cardNumberError').classList.remove('show');
  });

  function detectBrand(digits) {
    let brand = null;
    if (digits.startsWith('4'))                                          brand = 'visa';
    else if (['51','52','53','54','55'].some(p => digits.startsWith(p))) brand = 'mastercard';
    else if (digits.length >= 4) {
      const n4 = parseInt(digits.slice(0, 4));
      if (n4 >= 2221 && n4 <= 2720) brand = 'mastercard';
    }

    detectedBrand = brand;

    if (brand && BRAND_ASSET[brand]) {
      cardBrand.innerHTML = `<img src="${BRAND_ASSET[brand]}" alt="${brand}" />`;
      cardBrand.classList.add('show');
    } else {
      cardBrand.innerHTML = '';
      cardBrand.classList.remove('show');
    }

    if (selectedMethod === 'card') {
      const label = brand
        ? PAY_LABELS[currentLang][brand]
        : PAY_LABELS[currentLang]['card'];
      payBtnText.textContent = label;
    }
  }

  document.getElementById('cardExpiry')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2,4);
    e.target.value = v;
  });

  document.getElementById('cardCvc')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });

  // ─── Form validation ──────────────────────────────────────────
  function validateCardForm() {
    let valid = true;
    const lang = currentLang;

    const num = cardNumberIn.value.replace(/\s/g, '');
    if (num.length < 15) {
      document.getElementById('cardNumberError').textContent =
        document.getElementById('cardNumberError').getAttribute(`data-${lang}`) ||
        (lang === 'ar' ? 'أدخل رقم بطاقة صحيح' : 'Please enter a valid card number');
      document.getElementById('cardNumberError').classList.add('show');
      cardNumberIn.classList.add('error');
      valid = false;
    }

    const name = document.getElementById('cardName').value.trim();
    if (!name) {
      const el = document.getElementById('cardNameError');
      el.textContent = el.getAttribute(`data-${lang}`) || (lang === 'ar' ? 'أدخل اسم حامل البطاقة' : 'Please enter the cardholder name');
      el.classList.add('show');
      valid = false;
    }

    const exp = document.getElementById('cardExpiry').value;
    const expValid = /^\d{2}\/\d{2}$/.test(exp);
    if (!expValid) {
      const el = document.getElementById('cardExpiryError');
      el.textContent = el.getAttribute(`data-${lang}`) || (lang === 'ar' ? 'تاريخ انتهاء غير صحيح' : 'Invalid expiry date');
      el.classList.add('show');
      valid = false;
    }

    const cvc = document.getElementById('cardCvc').value;
    if (cvc.length < 3) {
      const el = document.getElementById('cardCvcError');
      el.textContent = el.getAttribute(`data-${lang}`) || (lang === 'ar' ? 'رمز الأمان غير صحيح' : 'Invalid security code');
      el.classList.add('show');
      valid = false;
    }

    return valid;
  }

  // ─── Pay button ───────────────────────────────────────────────
  payBtn.addEventListener('click', () => {
    if (!selectedMethod || payBtn.disabled) return;

    const lang = currentLang;

    if (CARD_METHODS.includes(selectedMethod)) {
      if (!validateCardForm()) return;
    }

    payBtn.classList.add('loading');
    payBtn.disabled = true;
    payBtnText.textContent = PAY_LABELS[lang].processing;

    setTimeout(() => {
      payBtn.classList.remove('loading');
      showNotif(PAY_LABELS[lang].success, 'success');
      setTimeout(() => { window.location.href = 'account.html'; }, 2000);
    }, 2200);
  });

  // ─── Notification ───
  function showNotif(msg, type) {
    document.querySelectorAll('.notif').forEach(n => n.remove());
    const el = document.createElement('div');
    el.className = `notif ${type}`;
    el.setAttribute('role', 'alert');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 250ms';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 260);
    }, 3500);
  }