/* =========================================================
   LimeFit — main interactions (vanilla JS, no dependencies)
   ========================================================= */
(function () {
  'use strict';

  var doc = document.documentElement;
  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var params = new URLSearchParams(location.search);
  var LANGS = ['zh', 'en'];
  var STORE_KEY = 'limefit-lang';
  var dict = window.I18N || { zh: {}, en: {} };
  var lang = 'zh';

  // "?static=1" disables motion (handy for screenshots / print)
  if (params.get('static') === '1') doc.classList.add('static');

  /* ---------------- i18n ---------------- */
  // Harvest Chinese source copy from the HTML so it lives in one place.
  function harvest() {
    var zh = dict.zh;
    $$('[data-i18n]').forEach(function (el) { var k = el.dataset.i18n; if (!(k in zh)) zh[k] = el.innerHTML.trim(); });
    $$('[data-i18n-ph]').forEach(function (el) { var k = el.dataset.i18nPh; if (!(k in zh)) zh[k] = el.getAttribute('placeholder'); });
    $$('[data-i18n-alt]').forEach(function (el) { var k = el.dataset.i18nAlt; if (!(k in zh)) zh[k] = el.getAttribute('alt'); });
    $$('[data-i18n-aria]').forEach(function (el) { var k = el.dataset.i18nAria; if (!(k in zh)) zh[k] = el.getAttribute('aria-label'); });
  }

  function t(key, vars) {
    var s = (dict[lang] && dict[lang][key] != null) ? dict[lang][key] : (dict.zh[key] != null ? dict.zh[key] : key);
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, function (_, v) { return vars[v] != null ? vars[v] : ''; });
    return s;
  }

  function detectLang() {
    var q = params.get('lang');
    if (q && LANGS.indexOf(q) > -1) return q;
    try { var s = localStorage.getItem(STORE_KEY); if (s && LANGS.indexOf(s) > -1) return s; } catch (e) {}
    return (navigator.language || 'zh').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
  }

  function applyLang(next, persist) {
    lang = next;
    doc.lang = lang === 'zh' ? 'zh-CN' : 'en';
    $$('[data-i18n]').forEach(function (el) { el.innerHTML = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(function (el) { el.setAttribute('placeholder', t(el.dataset.i18nPh)); });
    $$('[data-i18n-alt]').forEach(function (el) { el.setAttribute('alt', t(el.dataset.i18nAlt)); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.title = t('meta.title');
    var md = $('meta[name="description"]'); if (md) md.setAttribute('content', t('meta.desc'));
    $('#lang-label').textContent = t('lang.switch');
    syncMenuLabel();
    renderTabs();
    renderSchedule();
    renderPrices();
    refreshFormMessages();
    if (persist) { try { localStorage.setItem(STORE_KEY, lang); } catch (e) {} }
  }

  /* ---------------- Header / nav ---------------- */
  var header = $('.site-header');
  var nav = $('#main-nav');
  var burger = $('#hamburger');
  var toTop = $('#back-to-top');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle('scrolled', y > 10);
    toTop.classList.toggle('show', y > 700);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  function syncMenuLabel() {
    var open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-label', t(open ? 'nav.menuClose' : 'nav.menu'));
  }
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    syncMenuLabel();
  }
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); burger.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !e.target.closest('.site-header')) setMenu(false);
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) setMenu(false); });

  $('#lang-toggle').addEventListener('click', function () { applyLang(lang === 'zh' ? 'en' : 'zh', true); });

  // Active section highlighting
  if ('IntersectionObserver' in window) {
    var links = $$('.main-nav a[href^="#"]');
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) spy.observe(s); });
  }

  /* ---------------- Scroll reveal ---------------- */
  function initReveal() {
    var items = $$('.reveal');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || doc.classList.contains('static') || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) {
      // Anything already on screen is revealed immediately (no blank first paint).
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
      else io.observe(el);
    });
  }

  /* ---------------- Schedule ---------------- */
  // [time, class, coach, level(1-3), spots left]
  var SCHEDULE = [
    [['07:00', 'spin', 'marco', 2, 5], ['12:15', 'pilates', 'sophie', 1, 2], ['18:30', 'hiit', 'jay', 2, 3], ['20:00', 'boxing', 'marco', 3, 0]],
    [['07:00', 'yoga', 'sophie', 1, 6], ['12:15', 'hiit', 'jay', 2, 4], ['19:00', 'strength', 'jay', 3, 2], ['20:30', 'pilates', 'sophie', 2, 1]],
    [['07:30', 'hiit', 'jay', 2, 7], ['12:15', 'boxing', 'marco', 2, 3], ['18:30', 'pilates', 'sophie', 1, 0], ['20:00', 'spin', 'marco', 2, 5]],
    [['07:00', 'strength', 'jay', 2, 4], ['12:15', 'yoga', 'sophie', 1, 8], ['19:00', 'boxing', 'marco', 3, 2], ['20:30', 'hiit', 'jay', 3, 3]],
    [['07:00', 'pilates', 'sophie', 2, 3], ['12:15', 'spin', 'marco', 1, 6], ['18:30', 'hiit', 'jay', 2, 0], ['20:00', 'yoga', 'sophie', 1, 5]],
    [['09:00', 'hiit', 'jay', 2, 2], ['10:30', 'pilates', 'sophie', 1, 4], ['14:00', 'boxing', 'marco', 2, 6], ['16:00', 'strength', 'jay', 3, 3]],
    [['09:30', 'yoga', 'sophie', 1, 7], ['11:00', 'spin', 'marco', 2, 5], ['15:00', 'pilates', 'sophie', 2, 1], ['17:00', 'hiit', 'jay', 2, 4]]
  ];
  var DUR = { hiit: 45, pilates: 50, boxing: 60, strength: 60, yoga: 60, spin: 45 };
  var todayIdx = (new Date().getDay() + 6) % 7; // Monday = 0
  var dayIdx = todayIdx;
  var tabsEl = $('#day-tabs');
  var panelEl = $('#schedule-panel');

  function weekDate(i) {
    var d = new Date(); d.setDate(d.getDate() - todayIdx + i);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function renderTabs() {
    var days = t('days');
    tabsEl.innerHTML = days.map(function (name, i) {
      var sel = i === dayIdx;
      return '<button class="day-tab" type="button" role="tab" id="tab-' + i + '" aria-controls="schedule-panel"' +
        ' aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" data-day="' + i + '">' +
        '<b>' + name + '</b><small>' + (i === todayIdx ? t('sch.today') : weekDate(i)) + '</small></button>';
    }).join('');
    panelEl.setAttribute('aria-labelledby', 'tab-' + dayIdx);
  }

  function renderSchedule() {
    panelEl.innerHTML = SCHEDULE[dayIdx].map(function (c, i) {
      var spots = c[4];
      var spotCls = spots === 0 ? 'full' : (spots <= 2 ? 'low' : '');
      var spotTxt = spots === 0 ? t('sch.full') : t('sch.left', { n: spots });
      var coach = t('coach.' + c[2]);
      return '<div class="class-row" style="animation-delay:' + (i * 0.06) + 's">' +
        '<div class="class-time">' + c[0] + '<small>' + DUR[c[1]] + ' ' + t('sch.min') + '</small></div>' +
        '<div class="class-name"><b>' + t('cls.' + c[1]) + '</b><small>' + t('clsd.' + c[1]) + '</small></div>' +
        '<div class="class-coach"><span class="mini-av" aria-hidden="true">' + coach.charAt(0) + '</span>' + coach + '</div>' +
        '<span class="level l' + c[3] + '">' + t('lvl.' + c[3]) + '</span>' +
        '<div class="spots ' + spotCls + '">' + spotTxt + '</div>' +
        '</div>';
    }).join('');
  }

  function selectDay(i, focus) {
    dayIdx = (i + 7) % 7;
    renderTabs(); renderSchedule();
    if (focus) $('#tab-' + dayIdx).focus();
  }
  tabsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.day-tab'); if (b) selectDay(+b.dataset.day);
  });
  tabsEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); selectDay(dayIdx + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); selectDay(dayIdx - 1, true); }
    if (e.key === 'Home') { e.preventDefault(); selectDay(0, true); }
    if (e.key === 'End') { e.preventDefault(); selectDay(6, true); }
  });

  /* ---------------- Pricing ---------------- */
  var billing = 'month';
  function fmt(n, cur) {
    var s = Number(n).toLocaleString('en-US');
    return (cur === 'usd' ? '$' : '¥') + s;
  }
  function renderPrices() {
    var cur = t('currency');
    $$('.price-num').forEach(function (el) {
      var key = (cur === 'usd' ? 'usd' : 'cny') + (billing === 'year' ? 'Y' : 'M');
      el.textContent = fmt(el.dataset[key], cur);
    });
  }
  $$('.bt-option').forEach(function (b) {
    b.addEventListener('click', function () {
      billing = b.dataset.billing;
      $$('.bt-option').forEach(function (o) {
        var on = o === b; o.classList.toggle('is-active', on); o.setAttribute('aria-pressed', String(on));
      });
      renderPrices();
    });
  });
  $$('[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () {
      var msg = $('#f-msg');
      if (!msg.value.trim()) msg.value = t('form.planPrefill', { plan: t('plan.' + a.dataset.plan + '.name') });
    });
  });

  /* ---------------- FAQ accordion ---------------- */
  $$('.acc-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      $$('.acc-btn').forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
        $('#' + b.getAttribute('aria-controls')).hidden = true;
      });
      if (!open) {
        var panel = $('#' + btn.getAttribute('aria-controls'));
        btn.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
        panel.classList.remove('opening'); void panel.offsetWidth; panel.classList.add('opening');
      }
    });
  });

  /* ---------------- Booking form ---------------- */
  var form = $('#booking-form');
  var success = $('#form-success');
  var dateInput = $('#f-date');
  var lastBooking = null;

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var maxDay = new Date(today); maxDay.setDate(maxDay.getDate() + 60);
  dateInput.min = iso(today);
  dateInput.max = iso(maxDay);

  var RULES = {
    name: function (v) { v = v.trim(); return v.length >= 2 && v.length <= 30 ? '' : 'err.name'; },
    contact: function (v) {
      v = v.trim();
      if (!v) return 'err.contactEmpty';
      var email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      var digits = v.replace(/[\s\-()]/g, '');
      var cnMobile = /^(\+?86)?1[3-9]\d{9}$/.test(digits);
      var intl = /^\+\d{7,15}$/.test(digits) || /^\d{7,15}$/.test(digits);
      return email || cnMobile || intl ? '' : 'err.contact';
    },
    'class': function (v) { return v ? '' : 'err.class'; },
    date: function (v) {
      if (!v) return 'err.date';
      var d = new Date(v + 'T00:00:00');
      if (d < today) return 'err.datePast';
      if (d > maxDay) return 'err.dateFar';
      return '';
    },
    agree: function (_, el) { return el.checked ? '' : 'err.agree'; }
  };

  function validateField(el) {
    var rule = RULES[el.name]; if (!rule) return true;
    var field = el.closest('.field');
    var errKey = rule(el.value, el);
    var errEl = $('#' + el.getAttribute('aria-describedby'));
    field.classList.toggle('invalid', !!errKey);
    field.classList.toggle('valid', !errKey && el.type !== 'checkbox');
    el.setAttribute('aria-invalid', String(!!errKey));
    errEl.dataset.key = errKey;
    errEl.textContent = errKey ? t(errKey) : '';
    return !errKey;
  }

  function refreshFormMessages() {
    $$('.error[data-key]').forEach(function (e) { if (e.dataset.key) e.textContent = t(e.dataset.key); });
    if (lastBooking && !success.hidden) $('#success-msg').textContent = successText(lastBooking);
  }

  function successText(b) {
    var d = new Date(b.date + 'T00:00:00');
    var dateStr = d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' });
    return t('form.okMsg', { name: b.name, date: dateStr, cls: t('cls.' + b.cls), contact: b.contact });
  }

  $$('input, select, textarea', form).forEach(function (el) {
    var evt = (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
    el.addEventListener('blur', function () { if (el.value || el.closest('.field').classList.contains('invalid')) validateField(el); });
    el.addEventListener(evt, function () { if (el.closest('.field').classList.contains('invalid') || el.closest('.field').classList.contains('valid')) validateField(el); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = $$('[name]', form).filter(function (el) { return RULES[el.name]; });
    var firstBad = null;
    fields.forEach(function (el) { if (!validateField(el) && !firstBad) firstBad = el; });
    if (firstBad) {
      firstBad.focus();
      var card = $('.form-card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      return;
    }
    var btn = $('#submit-btn');
    var label = btn.querySelector('span');
    btn.classList.add('loading'); btn.disabled = true;
    label.textContent = t('form.sending');
    // Simulated request — replace with fetch('/api/booking', {...}) in production.
    setTimeout(function () {
      lastBooking = { name: $('#f-name').value.trim(), contact: $('#f-contact').value.trim(), cls: $('#f-class').value, date: dateInput.value };
      $('#success-msg').textContent = successText(lastBooking);
      form.hidden = true;
      success.hidden = false;
      success.focus();
      btn.classList.remove('loading'); btn.disabled = false;
      label.textContent = t('form.submit');
    }, 900);
  });

  $('#form-reset').addEventListener('click', function () {
    form.reset();
    $$('.field', form).forEach(function (f) { f.classList.remove('valid', 'invalid'); });
    $$('.error', form).forEach(function (e) { e.textContent = ''; e.dataset.key = ''; });
    success.hidden = true; form.hidden = false; lastBooking = null;
    $('#f-name').focus();
  });

  /* ---------------- Init ---------------- */
  harvest();
  applyLang(detectLang(), false);
  onScroll();
  initReveal();
})();
