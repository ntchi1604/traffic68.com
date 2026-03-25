/**
 * LayNut.js — Embeddable Button Script v3
 * Traffic68.com — https://traffic68.com
 *
 * LayNut.init(config) options:
 *
 * INSERT POSITION
 *   insertTarget   CSS selector for reference element    default '.footer'
 *   insertMode     'before' | 'after' | 'prepend' | 'append'  default 'after'
 *   insertId       ID for auto-created container div     default 'API_SEO_TRAFFIC68'
 *   insertStyle    Inline CSS for container div          default ''
 *   align          Button alignment in container         default 'center'
 *   padX           Horizontal padding in px              default 0
 *   padY           Vertical padding in px                default 12
 *
 * BUTTON APPEARANCE
 *   buttonText     Text on button                        default 'Lấy Mã'
 *   buttonColor    Background color (hex/rgb)            default '#f97316'
 *   textColor      Text color                            default '#ffffff'
 *   borderRadius   Button & pill radius in px            default 50
 *   fontSize       Button font size in px                default 15
 *   shadow         Show drop shadow on button            default true
 *   iconUrl        URL to image used as icon             default ''
 *   iconBg         Icon background color                 default 'rgba(255,255,255,0.92)'
 *   iconSize       Icon image size in px                 default 22
 *
 * THEME  (affects popup)
 *   theme          'default' | 'dark' | 'minimal' | 'glass'
 *
 * POPUP CONTENT
 *   waitTime       Seconds before code is revealed       default 30
 *   title          Popup title after reveal              default 'Mã của bạn!'
 *   message        Popup subtitle after reveal           default '...'
 *   countdownText  Waiting text template — use {s}      default 'Vui lòng chờ {s} giây...'
 *   successText    Hint text under code box              default 'Nhấn để sao chép!'
 *
 *   NOTE: Code is fetched dynamically from server per-session
 *         (vuot_link_tasks.code_given), NOT configured statically.
 *
 * BRANDING
 *   brandName      Brand text in footer                  default 'Traffic68'
 *   brandUrl       Brand link                            default 'https://traffic68.com'
 *   brandLogo      URL to brand logo image               default ''
 *
 * CUSTOM CSS
 *   customCSS      Raw CSS string injected after default styles
 *
 * CALLBACKS
 *   onReveal(code)     Called when countdown ends (code from server)
 *   onCopy(code)       Called when user copies the code
 */

(function (window) {
  'use strict';

  /* ── Defaults ─────────────────────────────────────────── */
  var D = {
    /* Vị trí chèn */
    insertTarget: '',
    insertMode: 'after',
    insertId: 'API_SEO_TRAFFIC68',
    insertStyle: '',
    align: 'center',
    padX: 0,
    padY: 12,

    buttonText: 'LẤY MÃ',
    buttonColor: '#f97316',
    textColor: '#ffffff',
    borderRadius: 50,
    fontSize: 15,
    shadow: true,
    iconUrl: '',
    iconBg: 'rgba(255,255,255,0.92)',
    iconSize: 22,
    theme: 'default',
    waitTime: 30,
    title: 'Mã của bạn! 🎉',
    message: 'Sao chép mã bên dưới để sử dụng.',
    countdownText: 'Vui lòng chờ {s} giây...',
    successText: 'Nhấn để sao chép!',
    brandName: 'Traffic68',
    brandUrl: 'https://traffic68.com',
    brandLogo: '',
    customCSS: '',
    overlapFix: 'none',  // 'auto' | 'zindex' | 'fixed' | 'none'
    hcaptchaSiteKey: '5acaec7e-83b0-464e-ba10-690889fc66ba',
    clarityId: 'vyua2zk5dc',
    onReveal: null,
    onCopy: null,
  };

  /* ── Theme definitions ────────────────────────────────── */
  var THEMES = {
    default: {
      modalBg: '#ffffff',
      modalText: '#0f172a',
      subText: '#64748b',
      codeBg: '#f8fafc',
      codeBorder: '#e2e8f0',
      copyBg: '#0f172a',
      copyText: '#ffffff',
      overlayBg: 'rgba(0,0,0,0.55)',
      ringBg: '#f1f5f9',
      hintColor: '#94a3b8',
    },
    dark: {
      modalBg: '#0f172a',
      modalText: '#f1f5f9',
      subText: '#94a3b8',
      codeBg: '#1e293b',
      codeBorder: '#334155',
      copyBg: '#f97316',
      copyText: '#ffffff',
      overlayBg: 'rgba(0,0,10,0.75)',
      ringBg: '#1e293b',
      hintColor: '#475569',
    },
    minimal: {
      modalBg: '#ffffff',
      modalText: '#111827',
      subText: '#6b7280',
      codeBg: '#ffffff',
      codeBorder: '#111827',
      copyBg: '#111827',
      copyText: '#ffffff',
      overlayBg: 'rgba(0,0,0,0.4)',
      ringBg: '#e5e7eb',
      hintColor: '#9ca3af',
    },
    glass: {
      modalBg: 'rgba(255,255,255,0.15)',
      modalText: '#ffffff',
      subText: 'rgba(255,255,255,0.7)',
      codeBg: 'rgba(255,255,255,0.1)',
      codeBorder: 'rgba(255,255,255,0.3)',
      copyBg: 'rgba(255,255,255,0.9)',
      copyText: '#0f172a',
      overlayBg: 'rgba(15,23,42,0.7)',
      ringBg: 'rgba(255,255,255,0.15)',
      hintColor: 'rgba(255,255,255,0.5)',
      backdropBlur: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.2)',
    },
  };

  var cfg = {};
  var t = {};
  var remaining = 0;
  var revealed = false;
  var globalTimer = null;
  var circumference = 0;
  var sessionCode = '';
  var _widgetToken = '';
  var _sessionToken = '';
  var _challengeId = '';
  var _challengeKey = '';
  var _visitorId = 'unknown';
  var _detectionReady = false;
  var _detectionCallbacks = [];
  var _botDetection = null;
  var _noCampaign = false; // true when campaignFound: false — show msg instead of code
  var _hcaptchaToken = ''; // hCaptcha response token
  var _hcaptchaLoaded = false;
  var _hcaptchaRendered = false;
  var _captchaEnabled = true; // controlled by admin config
  var _campVersion = 0; // 0 = default, 1 = multi-step
  var _v1Phase2Wait = 0; // seconds for V1 phase 2 countdown

  var _fpLoaded = false;
  function _loadDetectionLibs(callback) {
    if (_fpLoaded) { callback(); return; }
    _fpLoaded = true;

    var _called = false;
    function done() {
      if (!_called) {
        _called = true;
        _detectionReady = true;
        for (var i = 0; i < _detectionCallbacks.length; i++) {
          try { _detectionCallbacks[i](); } catch (e) { }
        }
        _detectionCallbacks = [];
        callback();
      }
    }

    // Dùng iframe creep-frame.html — bắt buộc
    var iframe = document.createElement('iframe');
    iframe.src = _scriptBase + '/creep-frame.html';
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');

    // Lắng nghe kết quả từ iframe
    window.addEventListener('message', function onMsg(e) {
      if (!e.data || e.data.type !== 'creep-result') return;
      window.removeEventListener('message', onMsg);
      var d = e.data.data || {};
      if (d.visitorId && d.visitorId !== 'unknown') {
        _visitorId = d.visitorId;
      }
      if (d.botDetection) _botDetection = d.botDetection;
      done();
    });

    iframe.onerror = function () {
      _botDetection = { bot: false, creepError: true };
      done();
    };

    (document.body || document.documentElement).appendChild(iframe);

    // Hard timeout 35s
    setTimeout(function () {
      if (!_called) {
        _botDetection = { bot: false, creepTimeout: true };
        done();
      }
    }, 35000);
  }

  // Chờ detection xong rồi gọi callback
  function _waitForDetection(callback) {
    if (_detectionReady) { callback(); return; }
    _detectionCallbacks.push(callback);
    // Nếu chưa load, tự load
    if (!_fpLoaded) {
      _loadDetectionLibs(function() {});
    }
  }

  function _extractBotDetection() {
    var bot = false;
    var totalLied = 0;
    try {
      var fp = window.Fingerprint;
      if (fp) {
        if (fp.headless && (fp.headless.headless || fp.headless.stealth)) bot = true;
        if (fp.workerScope && fp.workerScope.lied) bot = true;
      }
    } catch(e) {}
    return { bot: bot, totalLied: totalLied, creepDetected: true };
  }

  var _bhv = {
    startTime: Date.now(),
    mouse: [],
    clickPositions: [],
    totalKeys: 0,
    backspaceCount: 0,
    keyEvents: [],
    _keyDownMap: {},
    scrollEvents: [],
    scrollPauses: 0,
    _lastScrollT: 0,
    focusChanges: [],
    totalBlur: 0,
    rafStable: true,
    _rafTimes: [],
    probes: {},
  };

  var _bhvInit = false;
  function _initBehaviorTracking() {
    if (_bhvInit) return;
    _bhvInit = true;
    _bhv.startTime = Date.now();

    document.addEventListener('mousemove', function (e) {
      _bhv.mouse.push({ x: e.clientX, y: e.clientY, t: Date.now() - _bhv.startTime });
      if (_bhv.mouse.length > 100) _bhv.mouse.shift();
    }, { passive: true });

    document.addEventListener('click', function (e) {
      _bhv.clickPositions.push({ x: e.clientX, y: e.clientY, t: Date.now() - _bhv.startTime });
      if (_bhv.clickPositions.length > 20) _bhv.clickPositions.shift();
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      _bhv.totalKeys++;
      if (e.key === 'Backspace') _bhv.backspaceCount++;
      if (!_bhv._keyDownMap[e.key]) {
        _bhv._keyDownMap[e.key] = Date.now();
      }
    }, { passive: true });

    document.addEventListener('keyup', function (e) {
      var downT = _bhv._keyDownMap[e.key];
      if (downT) {
        var dwellMs = Date.now() - downT;
        _bhv.keyEvents.push({
          dwellMs: dwellMs,
          t: Date.now() - _bhv.startTime
        });
        if (_bhv.keyEvents.length > 30) _bhv.keyEvents.shift();
        delete _bhv._keyDownMap[e.key];
      }
    }, { passive: true });

    var scrollTimer = null;
    window.addEventListener('scroll', function () {
      var now = Date.now();
      var y = window.scrollY || window.pageYOffset || 0;
      if (_bhv._lastScrollT && (now - _bhv._lastScrollT) > 500) {
        _bhv.scrollPauses++;
      }
      _bhv._lastScrollT = now;
      _bhv.scrollEvents.push({ y: y, t: now - _bhv.startTime });
      if (_bhv.scrollEvents.length > 40) _bhv.scrollEvents.shift();
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      var vis = !document.hidden;
      _bhv.focusChanges.push({ visible: vis, t: Date.now() - _bhv.startTime });
      if (_bhv.focusChanges.length > 20) _bhv.focusChanges.shift();
      if (!vis) _bhv.totalBlur++;
    });

    var rafCount = 0;
    var rafStart = performance.now();
    function checkRaf(ts) {
      rafCount++;
      _bhv._rafTimes.push(ts);
      if (_bhv._rafTimes.length > 30) _bhv._rafTimes.shift();
      if (rafCount < 60) requestAnimationFrame(checkRaf);
      else {
        var elapsed = ts - rafStart;
        _bhv.rafStable = elapsed < 3000;
      }
    }
    if (window.requestAnimationFrame) requestAnimationFrame(checkRaf);

    try {
      var p = _bhv.probes;
      p.webdriver = !!navigator.webdriver;
      p.cdc = !!(window.cdc_adoQpoasnfa76pfcZLmcfl_ || window.cdc_adoQpoasnfa76pfcZLmcfl_Array || window.cdc_adoQpoasnfa76pfcZLmcfl_Promise || window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol);
      p.selenium = !!(document.__selenium_unwrapped || document.__webdriver_evaluate || document.__driver_evaluate || window._Selenium_IDE_Recorder || window.__nightmare);
      p.pluginCount = navigator.plugins ? navigator.plugins.length : -1;
      p.langCount = navigator.languages ? navigator.languages.length : 0;
      p.hasChrome = !!window.chrome;
      p.hasChromeRuntime = !!(window.chrome && window.chrome.runtime);
      if (window.Notification) p.notifPerm = Notification.permission;
      if (navigator.connection) p.rtt = navigator.connection.rtt;
    } catch (e) { }
  }



  /* ── CSS injection ────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('laynut-styles')) return;

    var r = 36;
    circumference = 2 * Math.PI * r;

    var css = [
      /* Button — base (position set dynamically) */
      '#laynut-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 20px;border:none;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-weight:700;letter-spacing:0.01em;transition:transform .15s ease,box-shadow .15s ease,opacity .3s ease;user-select:none;white-space:nowrap;animation:ln-pop .4s cubic-bezier(.34,1.56,.64,1) both;}',
      '#laynut-btn:hover{transform:translateY(-2px) scale(1.03);}',
      '#laynut-btn:active{transform:scale(0.97);}',
      '#laynut-btn .ln-icon-img{object-fit:contain;display:block;flex-shrink:0;}',
      '#laynut-btn .ln-icon-em{font-style:normal;line-height:1;}',
      '#laynut-btn .ln-label{flex-shrink:0;}',
      '#laynut-btn .ln-badge{background:rgba(255,255,255,0.28);border-radius:20px;padding:1px 8px;font-size:12px;font-weight:800;min-width:26px;text-align:center;flex-shrink:0;}',
      /* Inline wrapper (used when target is set) */
      '#laynut-wrap{position:absolute;z-index:9999;pointer-events:none;}',
      '#laynut-wrap #laynut-btn{pointer-events:all;}',
      '#laynut-wrap-inline{display:flex;width:100%;padding:12px 16px;box-sizing:border-box;}',
      '#laynut-wrap-inline.ln-left{justify-content:flex-start;}',
      '#laynut-wrap-inline.ln-center{justify-content:center;}',
      '#laynut-wrap-inline.ln-right{justify-content:flex-end;}',
      '.ln-target-rel{position:relative!important;}',
      /* Floating mode class */
      '#laynut-btn.ln-fixed{position:fixed;z-index:2147483647;}',
      '#laynut-btn.ln-abs{position:absolute;z-index:9999;}',
      '#laynut-btn.ln-inline{position:static;}',
      /* When target not set — apply fixed via JS instead of CSS so the class works */

      /* Overlay */
      '#laynut-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;animation:ln-fade .2s ease both;padding:16px;}',

      /* Modal base */
      '#laynut-modal{border-radius:20px;padding:32px 28px 24px;max-width:420px;width:100%;text-align:center;animation:ln-up .3s cubic-bezier(.34,1.3,.64,1) both;position:relative;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
      '#laynut-modal .ln-close{position:absolute;top:14px;right:16px;border:none;border-radius:50%;width:28px;height:28px;font-size:15px;cursor:pointer;line-height:28px;transition:opacity .15s;}',
      '#laynut-modal .ln-close:hover{opacity:.7;}',

      /* Ring */
      '.ln-ring-wrap{position:relative;width:88px;height:88px;margin:0 auto 18px;}',
      '.ln-ring-svg{transform:rotate(-90deg);}',
      '.ln-ring-bg{fill:none;stroke-width:6;}',
      '.ln-ring-prog{fill:none;stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset 1s linear;}',
      '.ln-ring-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;}',

      /* Text */
      '.ln-title{font-size:19px;font-weight:800;margin:0 0 6px;}',
      '.ln-msg{font-size:13px;margin:0 0 20px;line-height:1.5;}',

      /* Code box */
      '.ln-code-wrap{display:flex;align-items:center;border-radius:12px;overflow:hidden;margin-bottom:6px;}',
      '.ln-code-wrap{border-width:2px;border-style:solid;}',
      '.ln-code-val{flex:1;padding:13px 14px;font-size:17px;font-weight:900;letter-spacing:.04em;text-align:left;word-break:break-all;}',
      '.ln-copy-btn{padding:12px 16px;border:none;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.04em;transition:opacity .15s,transform .1s;flex-shrink:0;align-self:stretch;display:flex;align-items:center;}',
      '.ln-copy-btn:hover{opacity:.88;}',
      '.ln-copy-btn:active{transform:scale(.96);}',
      '.ln-copy-btn.ln-copied{background:#16a34a!important;color:#fff!important;}',
      '.ln-hint{font-size:11px;margin-bottom:16px;}',

      /* Waiting text */
      '.ln-waiting{border-radius:12px;padding:12px 14px;font-size:13px;margin-bottom:10px;font-weight:500;border-width:2px;border-style:solid;}',

      /* Brand */
      '.ln-brand{font-size:11px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:6px;opacity:.5;}',
      '.ln-brand img{height:16px;object-fit:contain;}',
      '.ln-brand a{text-decoration:none;font-weight:700;}',

      /* Animations */
      '@keyframes ln-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}',
      '@keyframes ln-fade{from{opacity:0}to{opacity:1}}',
      '@keyframes ln-up{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes ln-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}',
    ].join('');

    // Append custom CSS
    if (cfg.customCSS) css += '\n' + cfg.customCSS;

    var s = document.createElement('style');
    s.id = 'laynut-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── Auto-create container div if insertTarget is set ─── */
  function _autoInsertContainer() {
    if (!cfg.insertTarget) return null;

    // Don't create duplicate
    var existing = document.getElementById(cfg.insertId || 'laynut-auto-container');
    if (existing) return existing;

    var refEl = document.querySelector(cfg.insertTarget);
    if (!refEl) return null; // reference element not found yet

    var div = document.createElement('div');
    div.id = cfg.insertId || 'laynut-auto-container';
    if (cfg.insertStyle) div.style.cssText = cfg.insertStyle;

    var mode = cfg.insertMode || 'after';
    switch (mode) {
      case 'before':
        refEl.parentNode.insertBefore(div, refEl);
        break;
      case 'after':
        refEl.parentNode.insertBefore(div, refEl.nextSibling);
        break;
      case 'prepend':
        refEl.insertBefore(div, refEl.firstChild);
        break;
      case 'append':
        refEl.appendChild(div);
        break;
      default:
        refEl.parentNode.insertBefore(div, refEl.nextSibling);
    }

    return div;
  }

  /* ── Build button ─────────────────────────────────────── */
  function buildButton() {
    var btn = document.createElement('button');
    btn.id = 'laynut-btn';

    // Common styles
    btn.style.backgroundColor = cfg.buttonColor;
    btn.style.color = cfg.textColor;
    btn.style.borderRadius = cfg.borderRadius + 'px';
    btn.style.fontSize = cfg.fontSize + 'px';
    if (cfg.shadow) btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.28)';

    var effectiveIcon = cfg.iconUrl || defaultIcon();
    var iconBgStyle = cfg.iconBg !== 'transparent' ? 'background:' + cfg.iconBg + ';border-radius:6px;padding:2px;' : '';
    var iconHtml = '<img class="ln-icon-img" src="' + escHtml(effectiveIcon) + '" width="' + cfg.iconSize + '" height="' + cfg.iconSize + '" alt="" style="' + iconBgStyle + '">';

    btn.innerHTML = iconHtml +
      '<span class="ln-label">' + escHtml(cfg.buttonText) + '</span>' +
      '<span class="ln-badge" id="laynut-badge" style="display:none">' + remaining + '</span>';

    // Click handler — check session first, then start countdown
    btn.onclick = function () {
      if (revealed) { openModal(); return; }
      if (countdownRunning) {
        if (challengeActive) { openModal(); }
        return;
      }
      // V1 Phase 2: user clicked button on new page → start phase 2 countdown
      if (_v1Phase2Ready) {
        _startV1Phase2();
        return;
      }
      // V1: Phase 1 already done but user is still on the same page → show error
      if (_campVersion === 1 && _isV1Phase2() && !_isV1DifferentPage()) {
        _showSamePageError();
        fetchChallenge(function () { });
        return;
      }
      // First click: verify session exists before starting countdown
      checkSession(function (hasSession) {
        if (hasSession) {
          beginCountdown();
        } else {
          showNoSessionPopup();
        }
      });
    };

    /* ── Insert button ── */
    // Priority: 1) User-placed div with id=insertId, 2) insertTarget CSS selector
    var containerId = cfg.insertId || 'API_SEO_TRAFFIC68';
    var userDiv = document.getElementById(containerId);

    if (userDiv) {
      // User placed <div id="API_SEO_TRAFFIC68"></div> manually
      _placeButton(btn, userDiv);
      return;
    }

    if (cfg.insertTarget) {
      // Legacy mode: auto-create container at insertTarget
      var autoContainer = _autoInsertContainer();
      if (autoContainer) {
        _placeButton(btn, autoContainer);
        return;
      }

      _waitForTarget(cfg.insertTarget, function () {
        var container = _autoInsertContainer();
        if (container) {
          _placeButton(btn, container);
        } else {
          console.warn('[LayNut] Could not create container for:', cfg.insertTarget);
        }
      }, function () {
        console.warn('[LayNut] insertTarget not found:', cfg.insertTarget);
      });
      return;
    }

    // Fallback: wait for user div to appear (SPA)
    _waitForTarget('#' + containerId, function () {
      var div = document.getElementById(containerId);
      if (div) _placeButton(btn, div);
    }, function () {
      console.warn('[LayNut] Không tìm thấy <div id="' + containerId + '">. Hãy thêm div vào trang.');
    });
  }

  /* ── Place button inside container via flex layout ──── */
  function _placeButton(btn, container) {
    var alignMap = {
      'top-left': 'flex-start', 'bottom-left': 'flex-start', 'left': 'flex-start',
      'top-right': 'flex-end', 'bottom-right': 'flex-end', 'right': 'flex-end',
      'center': 'center',
    };
    var justify = alignMap[cfg.align] || 'center';
    var px = (cfg.padX || 0) + 'px';
    var py = (cfg.padY || 0) + 'px';

    var wrap = document.createElement('div');
    wrap.id = 'laynut-wrap-inline';
    wrap.style.cssText = 'display:flex;justify-content:' + justify +
      ';padding:' + py + ' ' + px + ';position:relative;z-index:9999;';
    wrap.appendChild(btn);
    container.appendChild(wrap);

    // Auto-check visibility — delay long enough for SPA frameworks to render
    if (cfg.overlapFix !== 'none') {
      setTimeout(function () { _checkVisibility(btn, wrap); }, 2000);
      // Second check as safety net for slow SPAs
      setTimeout(function () { _checkVisibility(btn, wrap); }, 4000);
      // Also re-check on scroll & resize (elements may overlap after scroll)
      var recheckTimer = null;
      var recheck = function () {
        if (recheckTimer) clearTimeout(recheckTimer);
        recheckTimer = setTimeout(function () { _checkVisibility(btn, wrap); }, 200);
      };
      window.addEventListener('scroll', recheck, { passive: true });
      window.addEventListener('resize', recheck, { passive: true });
    }
  }

  /* ── Check if button is visible or covered by other elements ── */
  function _checkVisibility(btn, wrap) {
    if (!btn || !btn.getBoundingClientRect) return;

    // Skip check when modal/overlay is open or a challenge is active —
    // the overlay naturally covers the button and elementFromPoint will
    // return the overlay, which is NOT a real overlap problem.
    if (challengeActive || document.getElementById('laynut-overlay')) return;

    var rect = btn.getBoundingClientRect();

    // Skip if button is not in viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight ||
      rect.right < 0 || rect.left > window.innerWidth) return;

    // Check if button center is clickable
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var topEl = document.elementFromPoint(cx, cy);

    // If topEl is the button itself or a child of it → visible, all good
    if (topEl && (topEl === btn || btn.contains(topEl))) return;

    // Button is covered! Apply fix based on config
    var mode = cfg.overlapFix || 'auto';
    console.warn('[LayNut] Button is covered by another element. Applying fix: ' + mode);

    if (mode === 'zindex' || mode === 'auto') {
      // First try: boost z-index on wrapper and button
      wrap.style.zIndex = '2147483647';
      wrap.style.position = 'relative';
      btn.style.zIndex = '2147483647';
      btn.style.position = 'relative';

      // Re-check after z-index boost
      setTimeout(function () {
        // Double-check overlay isn't open during the delayed re-check
        if (challengeActive || document.getElementById('laynut-overlay')) return;
        var topEl2 = document.elementFromPoint(cx, cy);
        if (topEl2 && (topEl2 === btn || btn.contains(topEl2))) return; // fixed!

        if (mode === 'auto') {
          // z-index didn't help → fallback to fixed position
          _switchToFixed(btn, wrap);
        }
      }, 100);
      return;
    }

    if (mode === 'fixed') {
      _switchToFixed(btn, wrap);
    }
  }

  /* ── Fallback: move button to fixed position (bottom-right corner) ── */
  function _switchToFixed(btn, wrap) {
    console.warn('[LayNut] Switching button to fixed position (bottom-right)');
    // Remove from inline flow
    if (wrap && wrap.parentNode) {
      wrap.parentNode.removeChild(wrap);
    }
    // Re-attach as fixed
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.top = 'auto';
    btn.style.left = 'auto';
    btn.style.zIndex = '2147483647';
    document.body.appendChild(btn);
  }

  /* ── Wait for a target selector to appear in DOM (SPA support) ── */
  function _waitForTarget(selector, onFound, onTimeout) {
    var maxWait = 10000; // 10 seconds
    var timer = setTimeout(function () {
      observer.disconnect();
      onTimeout();
    }, maxWait);

    var observer = new MutationObserver(function () {
      var el = document.querySelector(selector);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        onFound(el);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /* ── Build overlay + modal ────────────────────────────── */
  function buildModal() {
    var r = 36;
    var ov = document.createElement('div');
    ov.id = 'laynut-overlay';
    ov.style.background = t.overlayBg;
    if (t.backdropBlur) ov.style.backdropFilter = t.backdropBlur;
    ov.addEventListener('click', function (e) { if (e.target === ov && revealed) closeModal(); });

    var effectiveIcon = cfg.iconUrl || defaultIcon();
    var iconBgStyle = cfg.iconBg !== 'transparent' ? 'background:' + cfg.iconBg + ';border-radius:6px;padding:2px;' : '';
    var iconHtml = '<img src="' + escHtml(effectiveIcon) + '" height="' + cfg.iconSize + '" alt="" style="margin:0 auto 14px;display:block;width:auto;max-width:120px;object-fit:contain;' + iconBgStyle + '">';

    var brandHtml = '';
    if (cfg.brandName) {
      brandHtml = '<div class="ln-brand">' +
        (cfg.brandLogo ? '<img src="' + escHtml(cfg.brandLogo) + '" alt="' + escHtml(cfg.brandName) + '">' : '') +
        '<span>Powered by</span>' +
        '<a href="' + escHtml(cfg.brandUrl) + '" target="_blank" rel="noopener" style="color:inherit">' + escHtml(cfg.brandName) + '</a>' +
        '</div>';
    }

    ov.innerHTML = '<div id="laynut-modal">' +
      '<button class="ln-close" id="laynut-close">✕</button>' +
      iconHtml +
      '<div class="ln-ring-wrap">' +
      '<svg class="ln-ring-svg" width="88" height="88" viewBox="0 0 88 88">' +
      '<circle class="ln-ring-bg" cx="44" cy="44" r="' + r + '" stroke="' + t.ringBg + '"/>' +
      '<circle class="ln-ring-prog" id="laynut-ring" cx="44" cy="44" r="' + r + '"' +
      ' stroke="' + cfg.buttonColor + '"' +
      ' stroke-dasharray="' + circumference + '"' +
      ' stroke-dashoffset="0"/>' +
      '</svg>' +
      '<div class="ln-ring-num" id="laynut-num" style="color:' + t.modalText + '">' + remaining + '</div>' +
      '</div>' +
      '<h2 class="ln-title" id="laynut-title" style="color:' + t.modalText + '">' + escHtml(revealed ? cfg.title : 'Vui lòng chờ...') + '</h2>' +
      '<p class="ln-msg" id="laynut-msg" style="color:' + t.subText + '">' + escHtml(revealed ? cfg.message : cfg.countdownText.replace('{s}', remaining)) + '</p>' +
      '<div id="laynut-content">' + (revealed ? codeHtml() : waitHtml()) + '</div>' +
      brandHtml +
      '</div>';

    applyModalTheme(ov.querySelector('#laynut-modal'));
    document.body.appendChild(ov);
    document.getElementById('laynut-close').addEventListener('click', function () { if (revealed) closeModal(); });
    // Hide close button during challenges
    if (!revealed) {
      var closeBtn = document.getElementById('laynut-close');
      if (closeBtn) closeBtn.style.display = 'none';
    }
    if (revealed) bindCopy();
  }

  function applyModalTheme(modal) {
    modal.style.background = t.modalBg;
    if (t.border) modal.style.border = t.border;
    modal.style.boxShadow = t.backdropBlur
      ? '0 24px 60px rgba(0,0,0,0.5)'
      : '0 24px 60px rgba(0,0,0,0.2)';

    var close = modal.querySelector('.ln-close');
    if (close) {
      close.style.background = t.backdropBlur ? 'rgba(255,255,255,0.15)' : '#f1f5f9';
      close.style.color = t.subText;
    }
  }

  function waitHtml() {
    return '<div class="ln-waiting" style="color:' + t.subText + ';background:' + t.codeBg + ';border-color:' + t.codeBorder + '">' +
      escHtml(cfg.countdownText.replace('{s}', remaining)) +
      '</div>';
  }

  function codeHtml() {
    if (_noCampaign) return noCampaignHtml();
    var displayCode = sessionCode || 'Đang tải...';
    return '<div class="ln-code-wrap" style="border-color:' + t.codeBorder + '">' +
      '<div class="ln-code-val" style="background:' + t.codeBg + ';color:' + t.modalText + '">' + escHtml(displayCode) + '</div>' +
      '<button class="ln-copy-btn" id="laynut-copy" style="background:' + t.copyBg + ';color:' + t.copyText + '">SAO CHÉP</button>' +
      '</div>' +
      '<p class="ln-hint" style="color:' + t.hintColor + '">' + escHtml(cfg.successText) + '</p>';
  }

  function noCampaignHtml() {
    return '<div style="text-align:center;padding:12px 0;">' +
      '<div style="font-size:32px;margin-bottom:8px;">📋</div>' +
      '<p style="font-size:14px;font-weight:700;color:#f97316;margin:0 0 4px;">Campaign đã đủ số lượng</p>' +
      '<p style="font-size:12px;color:' + t.subText + ';margin:0;">Chiến dịch này đã hoàn thành chỉ tiêu.<br>Vui lòng thử lại sau.</p>' +
      '</div>';
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Copy button ──────────────────────────────────────── */
  function bindCopy() {
    var btn = document.getElementById('laynut-copy');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var code = sessionCode;
      if (!code) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function () { flashCopy(btn); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = code;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        flashCopy(btn);
      }
      if (typeof cfg.onCopy === 'function') cfg.onCopy(code);
    });
  }

  function flashCopy(btn) {
    btn.textContent = '✓ ĐÃ CHÉP';
    btn.classList.add('ln-copied');
    setTimeout(function () {
      btn.textContent = 'SAO CHÉP';
      btn.classList.remove('ln-copied');
    }, 2000);
  }

  /* ── Open / close ─────────────────────────────────────── */
  function openModal() {
    if (document.getElementById('laynut-overlay')) return;
    buildModal();
    syncModalUI();
  }

  function closeModal() {
    var el = document.getElementById('laynut-overlay');
    if (el) el.remove();
  }

  function syncModalUI() {
    var ring = document.getElementById('laynut-ring');
    var numEl = document.getElementById('laynut-num');
    var title = document.getElementById('laynut-title');
    var msg = document.getElementById('laynut-msg');
    var cont = document.getElementById('laynut-content');
    if (numEl) numEl.textContent = revealed ? '\u2713' : remaining;
    if (ring) {
      var pr = 1 - (remaining / cfg.waitTime);
      ring.style.strokeDashoffset = revealed ? 0 : circumference * (1 - pr);
    }
    if (revealed) {
      if (numEl) numEl.style.fontSize = '22px';
      if (title) title.textContent = cfg.title;
      if (msg) msg.textContent = cfg.message;
      if (cont) { cont.innerHTML = codeHtml(); bindCopy(); }
    } else {
      if (title) title.textContent = 'Vui lòng chờ...';
      if (msg) msg.textContent = cfg.countdownText.replace('{s}', remaining);
      if (cont) cont.innerHTML = '<div class="ln-waiting" style="padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;' +
        'background:' + t.codeBg + ';color:' + t.subText + ';">' +
        cfg.countdownText.replace('{s}', remaining) + '</div>';
    }
  }

  /* ── Challenge system ────────────────────────────────── */
  var tickTimer = null;
  var countdownRunning = false;
  var challengeActive = false;
  var _v1Phase2Active = false; // true when V1 phase 2 countdown is running
  var currentChallenge = null;
  var challengeListener = null;
  var challengeTimes = []; // pre-scheduled array of remaining-values to trigger challenges

  var CHALLENGES = [
    { id: 'scroll-top', icon: '⬆️', text: 'Scroll lên đầu trang' },
    { id: 'scroll-bottom', icon: '⬇️', text: 'Scroll xuống cuối trang' },
    { id: 'click', icon: '👆', text: 'Click vào bất kỳ đâu trên trang' },
  ];
  var _lastChallengeId = null; // Track last challenge to prevent consecutive duplicates

  function scheduleChallenges() {
    // Random 3-5 challenges, evenly distributed
    var count = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
    var total = cfg.waitTime;
    var gap = Math.floor(total / (count + 1)); // even spacing
    challengeTimes = [];
    for (var i = 1; i <= count; i++) {
      var t_val = total - (gap * i);
      if (t_val >= 2) challengeTimes.push(t_val); // don't schedule at 0 or 1
    }
  }

  function showChallenge() {
    challengeActive = true;

    // Smart pick: detect scroll position to choose direction
    var st = window.pageYOffset || document.documentElement.scrollTop;
    var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var distBottom = docH - st - window.innerHeight;
    var scrollThreshold = Math.max(100, docH * 0.05); // 100px or 5% of page height
    var atTop = st <= scrollThreshold;
    var atBottom = distBottom <= scrollThreshold;

    var pool = [];
    if (atTop) {
      pool.push(CHALLENGES[1]); // scroll-bottom
    } else if (atBottom) {
      pool.push(CHALLENGES[0]); // scroll-top
    } else {
      pool.push(CHALLENGES[0], CHALLENGES[1]); // either direction
    }
    pool.push(CHALLENGES[2]); // click is always an option

    // Filter out last challenge to prevent consecutive duplicates
    if (_lastChallengeId && pool.length > 1) {
      var filtered = pool.filter(function (c) { return c.id !== _lastChallengeId; });
      if (filtered.length > 0) pool = filtered;
    }

    var ch = pool[Math.floor(Math.random() * pool.length)];
    _lastChallengeId = ch.id;
    currentChallenge = ch.id;

    closeModal();
    openModal();

    var title = document.getElementById('laynut-title');
    var msg = document.getElementById('laynut-msg');
    var cont = document.getElementById('laynut-content');
    if (title) title.textContent = 'Xác minh tương tác';
    if (msg) msg.textContent = 'Hoàn thành hành động bên dưới để tiếp tục';
    if (cont) {
      cont.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 0;">' +
        '<div style="font-size:36px;line-height:1;">' + ch.icon + '</div>' +
        '<p style="font-size:14px;font-weight:800;color:' + t.modalText + ';">' + ch.text + '</p>' +
        '</div>';
    }

    if (ch.id === 'scroll-top') {
      challengeListener = function () {
        if ((window.pageYOffset || document.documentElement.scrollTop) <= 100) completeChallenge();
      };
      window.addEventListener('scroll', challengeListener, { passive: true });
      if ((window.pageYOffset || document.documentElement.scrollTop) <= 100) completeChallenge();
    } else if (ch.id === 'scroll-bottom') {
      challengeListener = function () {
        var st = window.pageYOffset || document.documentElement.scrollTop;
        var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        if (docH - st - window.innerHeight <= 100) completeChallenge();
      };
      window.addEventListener('scroll', challengeListener, { passive: true });
      var st2 = window.pageYOffset || document.documentElement.scrollTop;
      var docH2 = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      if (docH2 - st2 - window.innerHeight <= 100) completeChallenge();
    } else if (ch.id === 'click') {
      challengeListener = function (e) {
        var modal = document.getElementById('laynut-modal');
        if (modal && modal.contains(e.target)) return;
        completeChallenge();
      };
      document.addEventListener('click', challengeListener, { capture: true });
    }
  }

  function completeChallenge() {
    if (challengeListener) {
      if (currentChallenge === 'scroll-top' || currentChallenge === 'scroll-bottom') {
        window.removeEventListener('scroll', challengeListener);
      } else if (currentChallenge === 'click') {
        document.removeEventListener('click', challengeListener, { capture: true });
      }
      challengeListener = null;
    }
    challengeActive = false;
    currentChallenge = null;
    closeModal();
    doTick();
  }

  /* ── Visibility handling ─────────────────────────────── */
  var _isPageVisible = true;
  function bindVisibility() {
    // Track page visibility state
    document.addEventListener('visibilitychange', function () {
      _isPageVisible = !document.hidden;
      if (!countdownRunning || revealed) return;
      if (!_isPageVisible) {
        // Tab hidden → stop timer completely
        if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
      } else if (!challengeActive) {
        // Tab visible again → resume
        doTick();
      }
    });
    // Also handle window blur/focus (catches minimize, alt-tab)
    window.addEventListener('blur', function () {
      _isPageVisible = false;
      if (!countdownRunning || revealed) return;
      if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
    });
    window.addEventListener('focus', function () {
      _isPageVisible = true;
      if (!countdownRunning || revealed || challengeActive) return;
      doTick();
    });
  }

  /* ── Countdown tick ──────────────────────────────────── */
  function doTick() {
    if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
    function tick() {
      // MUST be visible to count — fully stop if hidden
      if (!_isPageVisible || document.hidden) {
        // Don't schedule next tick — visibility handler will resume
        return;
      }
      if (revealed || challengeActive) return;

      var badge = document.getElementById('laynut-badge');
      if (badge) badge.textContent = remaining;

      // Update modal UI if open
      var ring = document.getElementById('laynut-ring');
      var numEl = document.getElementById('laynut-num');
      if (ring) {
        var progress = 1 - (remaining / cfg.waitTime);
        ring.style.strokeDashoffset = circumference * (1 - progress);
      }
      if (numEl) numEl.textContent = remaining;
      var w = document.querySelector('.ln-waiting');
      if (w) w.textContent = cfg.countdownText.replace('{s}', remaining);
      var msgEl = document.getElementById('laynut-msg');
      if (msgEl) msgEl.textContent = cfg.countdownText.replace('{s}', remaining);

      if (remaining > 0 && challengeTimes.length > 0 && remaining <= challengeTimes[0]) {
        challengeTimes.shift();
        showChallenge();
        return;
      }

      if (remaining <= 0) {
        if (badge) badge.remove();
        challengeTimes = [];
        if (_noCampaign) {
          revealed = true;
          closeModal();
          openModal();
          syncModalUI();
          return;
        }
        // ── V1: After countdown 1 → show "visit internal link" message ──
        if (_campVersion === 1 && !_v1Phase2Active && !_isV1Phase2()) {
          _showV1VisitMessage();
          return;
        }
        // ── V1 Phase 2 or V0: Show captcha then code ──
        if (_captchaEnabled) {
          if (_v1Phase2Active) {
            _clearV1Phase();
            _showV1Phase2Captcha();
          } else {
            _showHcaptchaChallenge();
          }
        } else {
          // Captcha disabled — reveal code directly
          _hcaptchaToken = 'disabled';
          revealed = true;
          if (_v1Phase2Active) {
            _clearV1Phase();
            fetchSessionCodeV1Phase2(function () {
              closeModal();
              openModal();
              if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode);
            });
          } else {
            fetchSessionCode(function () {
              closeModal();
              openModal();
              if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode);
            });
          }
        }
        return;
      }

      remaining--;
      tickTimer = setTimeout(tick, 1000);
    }
    tick();
  }

  /* ── Check if session exists (pre-countdown) ───────────── */
  var _sessionVerified = false;
  var _requireGoogle = false;
  function checkSession(callback) {
    if (_sessionVerified) { callback(true); return; }
    if (!_widgetToken) { callback(false); return; }

    // Bắt buộc chờ CreepJS xong
    _waitForDetection(function () {
      var base = _scriptBase;
      var url = base + '/api/widgets/public/' + _widgetToken + '/check-session';
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (_sessionToken) xhr.setRequestHeader('X-Session-Token', _sessionToken);
      xhr.onload = function () {
        if (xhr.status === 200) {
          _sessionVerified = true;
          _requireGoogle = false;
          callback(true);
        } else {
          try {
            var resp = JSON.parse(xhr.responseText);
            if (resp.requireGoogle) _requireGoogle = true;
          } catch (e) { }
          callback(false);
        }
      };
      xhr.onerror = function () { callback(false); };
      xhr.send(JSON.stringify({ visitorId: _visitorId || '', pageReferrer: document.referrer || '' }));
    });
  }

  /* ── Fetch challenge token (anti-replay — same as vuotlink) ── */
  var _domText = '', _domFontSize = 16, _glColor = [0, 0, 0];

  function fetchChallenge(callback) {
    if (!_widgetToken) { callback(false); return; }
    var base = _scriptBase;
    var url = base + '/api/widgets/public/' + _widgetToken + '/challenge';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    if (_sessionToken) xhr.setRequestHeader('X-Session-Token', _sessionToken);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var resp = JSON.parse(xhr.responseText);
          _challengeId = resp.c || '';
          _challengeKey = resp._ck || '';
          _domText = resp.dt || '';
          _domFontSize = resp.df || 16;
          _glColor = resp.gc || [0, 0, 0];
          callback(true);
        } catch (e) { callback(false); }
      } else {
        callback(false);
      }
    };
    xhr.onerror = function () { callback(false); };
    xhr.send();
  }

  /* ── Show "no session" popup ────────────────────────────── */
  function showNoSessionPopup() {
    closeModal();
    var ov = document.createElement('div');
    ov.id = 'laynut-overlay';
    ov.style.background = t.overlayBg;
    if (t.backdropBlur) ov.style.backdropFilter = t.backdropBlur;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });

    var effectiveIcon = cfg.iconUrl || defaultIcon();
    var iconBgStyle = cfg.iconBg !== 'transparent' ? 'background:' + cfg.iconBg + ';border-radius:6px;padding:2px;' : '';

    var popupTitle = _requireGoogle ? 'Truy cập từ Google' : 'Chưa có phiên làm việc';
    var popupMsg = _requireGoogle
      ? 'Bạn cần tìm kiếm trên Google và truy cập trang này từ kết quả tìm kiếm để nhận mã.'
      : 'Vui lòng bắt đầu từ trang vượt link trước hoặc cùng trình duyệt để nhận mã.';

    ov.innerHTML = '<div id="laynut-modal">' +
      '<button class="ln-close" onclick="document.getElementById(\'laynut-overlay\').remove()">✕</button>' +
      '<img src="' + escHtml(effectiveIcon) + '" height="' + cfg.iconSize + '" alt="" style="margin:0 auto 14px;display:block;width:auto;max-width:120px;object-fit:contain;' + iconBgStyle + '">' +
      '<h2 class="ln-title" style="color:' + t.modalText + '">' + escHtml(popupTitle) + '</h2>' +
      '<p class="ln-msg" style="color:' + t.subText + '">' + escHtml(popupMsg) + '</p>' +
      '<div style="margin-top:16px">' +
      '<button onclick="document.getElementById(\'laynut-overlay\').remove()" ' +
      'style="padding:10px 24px;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;' +
      'background:' + cfg.buttonColor + ';color:' + cfg.textColor + '">Đã hiểu</button>' +
      '</div>' +
      '</div>';

    applyModalTheme(ov.querySelector('#laynut-modal'));
    document.body.appendChild(ov);
  }

  /* ── hCaptcha ────────────────────────────────────────── */
  function _loadHcaptcha(cb) {
    if (_hcaptchaLoaded) { cb(); return; }
    if (document.querySelector('script[src*="hcaptcha"]')) { _hcaptchaLoaded = true; cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    s.async = true;
    s.onload = function () { _hcaptchaLoaded = true; cb(); };
    s.onerror = function () { _hcaptchaLoaded = true; cb(); }; // continue even if fail
    document.head.appendChild(s);
  }

  function _showHcaptchaChallenge() {
    // Close countdown modal, show captcha modal
    closeModal();

    var ov = document.createElement('div');
    ov.id = 'laynut-overlay';
    ov.style.background = t.overlayBg;
    if (t.backdropBlur) ov.style.backdropFilter = t.backdropBlur;

    var effectiveIcon = cfg.iconUrl || defaultIcon();
    var iconBgStyle = cfg.iconBg !== 'transparent' ? 'background:' + cfg.iconBg + ';border-radius:6px;padding:2px;' : '';

    ov.innerHTML = '<div id="laynut-modal">' +
      '<img src="' + escHtml(effectiveIcon) + '" height="' + cfg.iconSize + '" alt="" style="margin:0 auto 14px;display:block;width:auto;max-width:120px;object-fit:contain;' + iconBgStyle + '">' +
      '<h2 class="ln-title" style="color:' + t.modalText + '">Xác minh bạn là người thật</h2>' +
      '<p class="ln-msg" style="color:' + t.subText + '">Hoàn thành captcha để nhận mã</p>' +
      '<div id="ln-hcaptcha-box" style="display:flex;justify-content:center;margin:16px 0;min-height:78px;align-items:center;"></div>' +
      '<p id="ln-hcaptcha-status" style="font-size:12px;color:' + t.subText + ';text-align:center;">Đang tải captcha...</p>' +
      '</div>';

    applyModalTheme(ov.querySelector('#laynut-modal'));
    document.body.appendChild(ov);

    // Load and render hCaptcha
    _loadHcaptcha(function () {
      var box = document.getElementById('ln-hcaptcha-box');
      var status = document.getElementById('ln-hcaptcha-status');
      if (!box) return;

      if (!window.hcaptcha) {
        // hCaptcha failed to load — skip captcha, get code directly
        if (status) status.textContent = 'Captcha không tải được, đang lấy mã...';
        _hcaptchaToken = 'skip';
        setTimeout(function () {
          revealed = true;
          fetchSessionCode(function () {
            closeModal();
            openModal();
            if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode);
          });
        }, 1000);
        return;
      }

      if (status) status.textContent = '';
      try {
        window.hcaptcha.render(box, {
          sitekey: cfg.hcaptchaSiteKey,
          size: 'normal',
          theme: (cfg.theme === 'dark' || cfg.theme === 'glass') ? 'dark' : 'light',
          callback: function (token) {
            _hcaptchaToken = token;
            if (status) {
              status.textContent = '✓ Đã xác minh! Đang lấy mã...';
              status.style.color = '#16a34a';
            }
            // Got captcha token → fetch code
            setTimeout(function () {
              revealed = true;
              fetchSessionCode(function () {
                closeModal();
                openModal();
                if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode);
              });
            }, 800);
          },
          'expired-callback': function () {
            _hcaptchaToken = '';
            if (status) {
              status.textContent = 'Captcha hết hạn, vui lòng thử lại';
              status.style.color = '#ef4444';
            }
          },
          'error-callback': function () {
            if (status) status.textContent = 'Lỗi captcha, đang thử lại...';
            // Fallback: skip captcha
            _hcaptchaToken = 'error';
            setTimeout(function () {
              revealed = true;
              fetchSessionCode(function () {
                closeModal();
                openModal();
                if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode);
              });
            }, 1500);
          },
        });
      } catch (e) {
        // Render failed — skip
        _hcaptchaToken = 'render-error';
        revealed = true;
        fetchSessionCode(function () {
          closeModal();
          openModal();
          if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode);
        });
      }
    });
  }

  /* ── Fetch session code from server (ONLY after countdown + captcha) ── */
  /* Sends behavioral data + challenge + hCaptcha token */
  /* With automatic retry: on failure, fetches new challenge and retries */
  var _fetchRetryCount = 0;
  var _MAX_RETRIES = 2;

  function _buildGetCodePayload() {
    // Collect comprehensive behavioral data (v2)
    var countdownElapsed = _bhv.startTime ? Math.floor((Date.now() - _bhv.startTime) / 1000) : 0;

    // Compute keystroke flight times (time between consecutive key releases)
    var flightTimes = [];
    for (var fi = 1; fi < _bhv.keyEvents.length; fi++) {
      flightTimes.push(_bhv.keyEvents[fi].t - _bhv.keyEvents[fi - 1].t);
    }

    // Canvas 2D + WebGL proof (recompute fresh each time using current challenge data)
    var _dw = 0, _glR = '', _glP = [0, 0, 0];
    try {
      var cv2 = document.createElement('canvas');
      var ctx2 = cv2.getContext('2d');
      ctx2.font = _domFontSize + 'px monospace';
      _dw = ctx2.measureText(_domText).width;
    } catch (e) { }
    try {
      var glCv = document.createElement('canvas');
      glCv.width = 4; glCv.height = 4;
      var gl = glCv.getContext('webgl') || glCv.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        _glR = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        gl.clearColor(_glColor[0], _glColor[1], _glColor[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        var px = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        _glP = [px[0], px[1], px[2]];
      }
    } catch (e) { }

    return {
      challengeId: _challengeId,
      _ck: _challengeKey,
      domWidth: _dw,
      glRenderer: _glR,
      glPixel: _glP,
      visitorId: _visitorId,
      botDetection: _botDetection,
      hcaptchaToken: _hcaptchaToken,
      behavioral: {
        // 1. Mouse dynamics
        mouseTrail: _bhv.mouse.slice(-50),
        mousePoints: _bhv.mouse.length,
        clickPositions: _bhv.clickPositions,
        // 2. Keystroke dynamics
        keyDwellTimes: _bhv.keyEvents.map(function (k) { return k.dwellMs; }),
        keyFlightTimes: flightTimes,
        totalKeys: _bhv.totalKeys,
        backspaceCount: _bhv.backspaceCount,
        // 3. Scroll patterns
        scrollEvents: _bhv.scrollEvents,
        scrollPauses: _bhv.scrollPauses,
        // 4. Focus & visibility
        focusChanges: _bhv.focusChanges,
        totalBlur: _bhv.totalBlur,
        rafStable: _bhv.rafStable,
        // 5. Probes
        probes: _bhv.probes,
        // Meta
        countdownTime: countdownElapsed,
        screen: {
          w: window.screen ? window.screen.width : 0,
          h: window.screen ? window.screen.height : 0,
          dpr: window.devicePixelRatio || 1
        }
      },
      pageReferrer: document.referrer || ''
    };
  }

  function _sendGetCode(callback) {
    var base = _scriptBase;
    var url = base + '/api/widgets/public/' + _widgetToken + '/get-code';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (_sessionToken) xhr.setRequestHeader('X-Session-Token', _sessionToken);

    var payload = _buildGetCodePayload();

    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var resp = JSON.parse(xhr.responseText);
          // ── V1: Multi-step — show step 2 instead of code ──
          if (resp.v1_step2) {
            showV1Step2(resp.targetPage || '', resp.v1Wait || 25);
            return;
          }
          sessionCode = resp.code || '';
          _fetchRetryCount = 0; // reset
        } catch (e) {
          sessionCode = 'ERR';
        }
        if (callback) callback();

        // Tag Clarity with visitor_id only
        if (window.clarity && _visitorId && _visitorId !== 'unknown') {
          window.clarity('set', 'visitor_id', _visitorId);
        }
      } else {
        // ── RETRY: Fetch new challenge and try again ──
        console.warn('[LayNut] get-code failed (status=' + xhr.status + '), retry ' + (_fetchRetryCount + 1) + '/' + _MAX_RETRIES);
        _fetchRetryCount++;
        if (_fetchRetryCount <= _MAX_RETRIES) {
          // Fetch a brand new challenge, then retry
          fetchChallenge(function (ok) {
            if (ok) {
              // Small delay to let challenge settle on server
              setTimeout(function () { _sendGetCode(callback); }, 300);
            } else {
              sessionCode = 'ERR';
              _fetchRetryCount = 0;
              if (callback) callback();
            }
          });
        } else {
          sessionCode = 'ERR';
          _fetchRetryCount = 0;
          if (callback) callback();
        }
      }
    };
    xhr.onerror = function () {
      _fetchRetryCount++;
      if (_fetchRetryCount <= _MAX_RETRIES) {
        fetchChallenge(function (ok) {
          if (ok) {
            setTimeout(function () { _sendGetCode(callback); }, 300);
          } else {
            sessionCode = 'ERR';
            _fetchRetryCount = 0;
            if (callback) callback();
          }
        });
      } else {
        sessionCode = 'ERR';
        _fetchRetryCount = 0;
        if (callback) callback();
      }
    };
    xhr.send(JSON.stringify(payload));
  }

  function fetchSessionCode(callback) {
    if (!_widgetToken) {
      sessionCode = 'ERR';
      if (callback) callback();
      return;
    }
    _fetchRetryCount = 0;
    _sendGetCode(callback);
  }

  /* ── V1 helpers ── */
  var _V1_KEY = 'laynut_v1_phase';
  function _isV1Phase2() {
    try {
      var d = JSON.parse(localStorage.getItem(_V1_KEY) || '{}');
      return d.phase === 2 && (Date.now() - d.ts) < 600000; // valid 10 min
    } catch (e) { return false; }
  }
  function _setV1Phase2() {
    try { localStorage.setItem(_V1_KEY, JSON.stringify({ phase: 2, ts: Date.now(), originUrl: window.location.pathname })); } catch (e) { }
  }
  function _clearV1Phase() {
    try { localStorage.removeItem(_V1_KEY); } catch (e) { }
  }
  function _isV1DifferentPage() {
    try {
      var d = JSON.parse(localStorage.getItem(_V1_KEY) || '{}');
      if (!d.originUrl) return true;
      return window.location.pathname !== d.originUrl;
    } catch (e) { return true; }
  }

  /* ── V1: Show "visit any internal link" popup after countdown 1 (NO captcha) ── */
  function _showV1VisitMessage() {
    _setV1Phase2();
    countdownRunning = false; // IMPORTANT: stop countdown so visibility handler won't retrigger doTick → captcha
    closeModal();
    // Tell server phase 1 is done (async, response handled by showV1Step2)
    fetchSessionCode(function () { });
    // Show popup immediately
    _buildV1VisitPopup();
  }

  /* ── V1: Handle server v1_step2 response ── */
  function showV1Step2(targetPage, v1Wait) {
    _setV1Phase2();
    if (!document.getElementById('laynut-overlay')) {
      _buildV1VisitPopup();
    }
  }

  /* ── V1: Build the "visit internal link" popup overlay (user closes manually) ── */
  function _buildV1VisitPopup() {
    closeModal();
    var ov = document.createElement('div');
    ov.id = 'laynut-overlay';
    ov.style.background = t.overlayBg;
    if (t.backdropBlur) ov.style.backdropFilter = t.backdropBlur;

    var effectiveIcon = cfg.iconUrl || defaultIcon();
    var iconBgStyle = cfg.iconBg !== 'transparent' ? 'background:' + cfg.iconBg + ';border-radius:6px;padding:2px;' : '';

    ov.innerHTML = '<div id="laynut-modal">' +
      '<img src="' + escHtml(effectiveIcon) + '" height="' + cfg.iconSize + '" alt="" style="margin:0 auto 14px;display:block;width:auto;max-width:120px;object-fit:contain;' + iconBgStyle + '">' +
      '<div style="text-align:center;padding:8px 16px">' +
      '<div style="width:64px;height:64px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">' +
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      '</div>' +
      '<h3 style="color:' + t.modalText + ';font-weight:800;margin:0 0 8px;font-size:17px">' + escHtml('Bước tiếp theo') + '</h3>' +
      '<p style="color:' + t.subText + ';font-size:13px;margin:0 0 16px;line-height:1.5">' +
      'Truy cập vào <strong>bất kỳ link nội bộ nào</strong> trên trang web này, sau đó nhấn nút lấy mã trên trang đó để hoàn tất.' +
      '</p>' +
      '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin:0 0 16px">' +
      '<p style="color:#92400e;font-size:11px;font-weight:600;margin:0">Nhấn vào một link bất kỳ ở menu, bài viết, hoặc sidebar trên trang này.</p>' +
      '</div>' +
      '<button id="ln-v1-close" style="margin-top:8px;padding:10px 28px;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;background:' + cfg.buttonColor + ';color:' + cfg.textColor + ';transition:opacity .15s">' + escHtml('Đã hiểu') + '</button>' +
      '</div>' +
      '</div>';

    applyModalTheme(ov.querySelector('#laynut-modal'));
    document.body.appendChild(ov);
    document.getElementById('ln-v1-close').addEventListener('click', function () { closeModal(); });
  }



  /* ── V1 Phase 2: Start second countdown on new page (user clicks button to start) ── */
  var _v1Phase2Ready = false; // flag: button click will start phase 2

  function _prepareV1Phase2() {
    // Just mark ready — countdown starts when user clicks the button
    _v1Phase2Ready = true;
    // Pre-load detection libs and challenge in background
    _initBehaviorTracking();
    _loadDetectionLibs(function () { });
    fetchChallenge(function () { });
    bindVisibility();
    // Update button text to indicate next step
    var label = document.querySelector('#laynut-btn .ln-label');
    if (label) label.textContent = 'LẤY MÃ';
  }

  function _startV1Phase2() {
    // Verify user is on a different page
    if (!_isV1DifferentPage()) {
      _showSamePageError();
      return;
    }
    _v1Phase2Ready = false;
    _v1Phase2Active = true; // Flag so doTick knows to use V1 phase 2 flow
    var seconds = Math.floor(Math.random() * 11) + 25; // 25-35s
    _v1Phase2Wait = seconds;
    countdownRunning = true;
    remaining = seconds;
    cfg.waitTime = seconds; // override for progress calc

    // Schedule 1-2 random challenges for phase 2 (reuse global challengeTimes)
    var v1ChallengeCount = 1 + Math.floor(Math.random() * 2); // 1 or 2
    challengeTimes = [];
    var gap = Math.floor(seconds / (v1ChallengeCount + 1));
    for (var ci = 1; ci <= v1ChallengeCount; ci++) {
      var ct = seconds - (gap * ci);
      if (ct >= 2) challengeTimes.push(ct);
    }

    // Update button to show countdown
    var btn = document.getElementById('laynut-btn');
    var label = document.querySelector('#laynut-btn .ln-label');
    if (label) label.textContent = 'Vui lòng chờ';
    if (btn) btn.style.padding = '8px 16px 8px 12px';
    var badge = document.getElementById('laynut-badge');
    if (badge) { badge.style.display = ''; badge.textContent = remaining; }

    // Use the normal doTick — it handles V1 phase 2 via _v1Phase2Active flag
    doTick();
  }

  /* ── V1 Phase 2: Show captcha after countdown ends ── */
  function _showV1Phase2Captcha() {
    closeModal();
    var ov = document.createElement('div');
    ov.id = 'laynut-overlay';
    ov.style.background = t.overlayBg;
    if (t.backdropBlur) ov.style.backdropFilter = t.backdropBlur;

    var effectiveIcon = cfg.iconUrl || defaultIcon();
    var iconBgStyle = cfg.iconBg !== 'transparent' ? 'background:' + cfg.iconBg + ';border-radius:6px;padding:2px;' : '';

    ov.innerHTML = '<div id="laynut-modal">' +
      '<img src="' + escHtml(effectiveIcon) + '" height="' + cfg.iconSize + '" alt="" style="margin:0 auto 14px;display:block;width:auto;max-width:120px;object-fit:contain;' + iconBgStyle + '">' +
      '<h2 class="ln-title" style="color:' + t.modalText + '">Xác minh bạn là người thật</h2>' +
      '<p class="ln-msg" style="color:' + t.subText + '">Hoàn thành captcha để nhận mã</p>' +
      '<div id="ln-hcaptcha-box" style="display:flex;justify-content:center;margin:16px 0;min-height:78px;align-items:center;"></div>' +
      '<p id="ln-hcaptcha-status" style="font-size:12px;color:' + t.subText + ';text-align:center;">Đang tải captcha...</p>' +
      '</div>';

    applyModalTheme(ov.querySelector('#laynut-modal'));
    document.body.appendChild(ov);

    _loadHcaptcha(function () {
      var box = document.getElementById('ln-hcaptcha-box');
      var status = document.getElementById('ln-hcaptcha-status');
      if (!box) return;

      if (!window.hcaptcha) {
        if (status) status.textContent = 'Captcha không tải được, đang lấy mã...';
        _hcaptchaToken = 'skip';
        setTimeout(function () {
          revealed = true;
          fetchSessionCodeV1Phase2(function () { closeModal(); openModal(); if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode); });
        }, 1000);
        return;
      }

      if (status) status.textContent = '';
      try {
        window.hcaptcha.render(box, {
          sitekey: cfg.hcaptchaSiteKey,
          size: 'normal',
          theme: (cfg.theme === 'dark' || cfg.theme === 'glass') ? 'dark' : 'light',
          callback: function (token) {
            _hcaptchaToken = token;
            if (status) { status.textContent = '✓ Đã xác minh! Đang lấy mã...'; status.style.color = '#16a34a'; }
            setTimeout(function () {
              revealed = true;
              fetchSessionCodeV1Phase2(function () { closeModal(); openModal(); if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode); });
            }, 800);
          },
          'expired-callback': function () {
            _hcaptchaToken = '';
            if (status) { status.textContent = 'Captcha hết hạn, vui lòng thử lại'; status.style.color = '#ef4444'; }
          },
          'error-callback': function () {
            if (status) status.textContent = 'Lỗi captcha, đang thử lại...';
            _hcaptchaToken = 'error';
            setTimeout(function () {
              revealed = true;
              fetchSessionCodeV1Phase2(function () { closeModal(); openModal(); if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode); });
            }, 1500);
          },
        });
      } catch (e) {
        _hcaptchaToken = 'render-error';
        revealed = true;
        fetchSessionCodeV1Phase2(function () { closeModal(); openModal(); if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode); });
      }
    });
  }

  /* ── V1 Phase 2: Fetch code with v1Phase=2 (uses full payload + Canvas/WebGL proofs) ── */
  function fetchSessionCodeV1Phase2(callback) {
    if (!_widgetToken) { sessionCode = 'ERR'; _clearV1Phase(); if (callback) callback(); return; }
    var base = _scriptBase;
    var url = base + '/api/widgets/public/' + _widgetToken + '/get-code';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (_sessionToken) xhr.setRequestHeader('X-Session-Token', _sessionToken);

    // Use the full payload builder (includes domWidth, glRenderer, glPixel) + add v1Phase
    var payload = _buildGetCodePayload();
    payload.v1Phase = 2;

    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var resp = JSON.parse(xhr.responseText);
          sessionCode = resp.code || '';
        } catch (e) { sessionCode = 'ERR'; _clearV1Phase(); }
      } else { sessionCode = 'ERR'; _clearV1Phase(); }
      if (callback) callback();
    };
    xhr.onerror = function () { sessionCode = 'ERR'; _clearV1Phase(); if (callback) callback(); };
    xhr.send(JSON.stringify(payload));
  }

  /* ── V1: Error when user hasn't navigated to a different page ── */
  function _showSamePageError() {
    closeModal();
    var ov = document.createElement('div');
    ov.id = 'laynut-overlay';
    ov.style.background = t.overlayBg;
    if (t.backdropBlur) ov.style.backdropFilter = t.backdropBlur;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });

    var effectiveIcon = cfg.iconUrl || defaultIcon();
    var iconBgStyle = cfg.iconBg !== 'transparent' ? 'background:' + cfg.iconBg + ';border-radius:6px;padding:2px;' : '';

    ov.innerHTML = '<div id="laynut-modal">' +
      '<button class="ln-close" onclick="document.getElementById(\'laynut-overlay\').remove()">✕</button>' +
      '<img src="' + escHtml(effectiveIcon) + '" height="' + cfg.iconSize + '" alt="" style="margin:0 auto 14px;display:block;width:auto;max-width:120px;object-fit:contain;' + iconBgStyle + '">' +
      '<div style="text-align:center;padding:8px 16px">' +
      '<div style="width:56px;height:56px;border-radius:50%;background:#fef2f2;border:2px solid #fecaca;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:24px">⚠️</div>' +
      '<h3 style="color:' + t.modalText + ';font-weight:800;margin:0 0 8px;font-size:16px">Click vào liên kết bất kỳ trong nội bộ!</h3>' +
      '<p style="color:' + t.subText + ';font-size:13px;margin:0 0 16px;line-height:1.5">' +
      'Vui lòng truy cập vào <strong>một link nội bộ khác</strong> trên trang web này trước, sau đó nhấn nút lấy mã trên trang đó.' +
      '</p>' +
      '<button onclick="document.getElementById(\'laynut-overlay\').remove()" style="padding:10px 24px;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;background:' + cfg.buttonColor + ';color:' + cfg.textColor + '">Đã hiểu</button>' +
      '</div>' +
      '</div>';

    applyModalTheme(ov.querySelector('#laynut-modal'));
    document.body.appendChild(ov);
  }

  function fetchSessionCodeV1Phase2(callback) {
    if (!_widgetToken) { sessionCode = 'ERR'; if (callback) callback(); return; }
    var base = _scriptBase;
    var url = base + '/api/widgets/public/' + _widgetToken + '/get-code';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (_sessionToken) xhr.setRequestHeader('X-Session-Token', _sessionToken);

    var payload = {
      challengeId: _challengeId,
      _ck: _challengeKey,
      v1Phase: 2,
      visitorId: _visitorId,
      botDetection: _botDetection,
      hcaptchaToken: 'v1-phase2',
      behavioral: { v1Phase2: true }
    };

    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var resp = JSON.parse(xhr.responseText);
          sessionCode = resp.code || '';
        } catch (e) { sessionCode = 'ERR'; }
      } else { sessionCode = 'ERR'; }
      if (callback) callback();
    };
    xhr.onerror = function () { sessionCode = 'ERR'; if (callback) callback(); };
    xhr.send(JSON.stringify(payload));
  }

  /* ── Button click starts everything ──────────────────── */
  function startGlobal() {
    var badge = document.getElementById('laynut-badge');
    if (badge) badge.textContent = remaining;
    // Don't start countdown — wait for user to click button
  }

  function beginCountdown() {
    if (countdownRunning) return;
    countdownRunning = true;

    // Start behavioral tracking (same as VuotLink.jsx)
    _initBehaviorTracking();

    // Load FingerprintJS + BotD (same as VuotLink.jsx useEffect)
    _loadDetectionLibs(function () {
      // Libraries loaded, visitorId and botDetection are now set
    });

    // Fetch challenge token (anti-replay — same as vuotlink.js)
    fetchChallenge(function (ok) {
      if (!ok) {
        console.warn('[LayNut] Could not fetch challenge, continuing anyway');
      }
    });

    scheduleChallenges();
    bindVisibility();
    // Change button text to "Vui lòng chờ" and show badge
    var btn = document.getElementById('laynut-btn');
    var label = document.querySelector('#laynut-btn .ln-label');
    if (label) label.textContent = 'Vui lòng chờ';
    if (btn) btn.style.padding = '8px 16px 8px 12px';
    var badge = document.getElementById('laynut-badge');
    if (badge) badge.style.display = '';
    doTick();
  }

  /* ── Public API ───────────────────────────────────────── */
  window.LayNut = {
    init: function (userCfg) {
      cfg = Object.assign({}, D, userCfg);
      t = Object.assign({}, THEMES.default, THEMES[cfg.theme] || {});
      remaining = cfg.waitTime;
      circumference = 2 * Math.PI * 36;

      injectStyles();

      // Inject Microsoft Clarity for session recording (only tags visitor_id)
      if (cfg.clarityId && !window.clarity) {
        (function (c, l, a, r, i, t, y) {
          c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
          t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
          y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, 'clarity', 'script', cfg.clarityId);
      }

      function ready() {
        _initBehaviorTracking();
        buildButton();
        startGlobal();
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
      } else {
        ready();
      }
    },
  };

  /* ── Resolve script origin for absolute asset URLs ──── */
  var _scriptBase = '';
  (function resolveBase() {
    var scripts = document.querySelectorAll('script[src*="laynut"], script[src*="api_seo_traffic68"]');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src) { _scriptBase = src.replace(/\/[^\/]*$/, ''); break; }
    }
  })();

  function defaultIcon() {
    return 'https://traffic68.com/lg.png';
  }

  /* ── Auto-init from data-token ───────────────────────── */
  (function autoInit() {
    var scripts = document.querySelectorAll('script[src*="laynut"], script[src*="api_seo_traffic68"]');
    for (var i = 0; i < scripts.length; i++) {
      var token = scripts[i].getAttribute('data-token');
      if (token) {
        _widgetToken = token;
        var base = _scriptBase;
        var pageUrl = encodeURIComponent(window.location.href);
        var apiUrl = base + '/api/widgets/public/' + token + '?pageUrl=' + pageUrl;

        (function (url) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.onload = function () {
            if (xhr.status === 200) {
              try {
                var resp = JSON.parse(xhr.responseText);
                if (resp._t) _sessionToken = resp._t; // save session token
                var config = resp.config || {};
                if (!resp.campaignFound) {
                  _noCampaign = true; // mark — show button/countdown but no code
                }
                if (resp.captchaEnabled === false) _captchaEnabled = false;
                if (resp.version === 1) _campVersion = 1;
                window.LayNut.init(config);

                // Start CreepJS fingerprinting EARLY so visitorId is ready for check-session
                if (document.body) {
                  _loadDetectionLibs(function () { });
                } else {
                  document.addEventListener('DOMContentLoaded', function () {
                    _loadDetectionLibs(function () { });
                  });
                }

                // V1 Phase 2: If coming from another page after phase 1
                // Don't auto-start countdown — just prepare, user must click button
                if (_campVersion === 1 && _isV1Phase2()) {
                  setTimeout(function () { _prepareV1Phase2(); }, 500);
                }
              } catch (e) { }
            }
          };
          xhr.onerror = function () { };
          xhr.send();
        })(apiUrl);
        break; // only init once
      }
    }
  })();

})(window);
