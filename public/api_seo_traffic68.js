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
    insertTarget: '.footer',
    insertMode: 'after',
    insertId: 'API_SEO_TRAFFIC68',
    insertStyle: '',
    align: 'center',
    padX: 0,
    padY: 12,

    buttonText: 'Lấy Mã',
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
    overlapFix: 'auto',  // 'auto' | 'zindex' | 'fixed' | 'none'
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

  /* ── State ────────────────────────────────────────────── */
  var cfg = {};
  var t = {};          // active theme colors
  var remaining = 0;
  var revealed = false;
  var globalTimer = null;
  var circumference = 0;
  var sessionCode = '';    // code fetched from server (vuot_link_tasks.code_given)
  var _widgetToken = '';   // token for API calls
  var _sessionToken = '';  // anti-bypass HMAC token from server
  var _challengeId = '';   // anti-replay challenge token
  var _challengeKey = '';  // challenge signature
  var _visitorId = 'unknown';   // FingerprintJS visitor ID (same as VuotLink.jsx)
  var _botDetection = null;     // BotD result (same as VuotLink.jsx)

  /* ── Load FingerprintJS (visitorId) + CreepJS (bot detection) ── */
  var _fpLoaded = false;
  function _loadDetectionLibs(callback) {
    if (_fpLoaded) { callback(); return; }
    _fpLoaded = true;

    // FingerprintJS — fast (~1s), provides visitorId
    var fpScript = document.createElement('script');
    fpScript.src = _scriptBase + '/fp.js';
    fpScript.onload = function () {
      try {
        var FP = window.FingerprintJS;
        if (FP) {
          FP.load().then(function (fp) {
            return fp.get();
          }).then(function (result) {
            _visitorId = result.visitorId;
            callback();
          }).catch(function () { callback(); });
        } else { callback(); }
      } catch (e) { callback(); }
    };
    fpScript.onerror = function () { callback(); };
    document.head.appendChild(fpScript);

    // CreepJS — for bot detection only (async, don't block)
    var crScript = document.createElement('script');
    crScript.src = _scriptBase + '/creep.js';
    crScript.onload = function () {
      var tries = 0;
      var poll = setInterval(function () {
        tries++;
        var fp = window.Fingerprint || window.Creep;
        // CreepJS structure: { workerScope: { lied: 0, lies: {...} }, navigator: {...}, ... }
        // Wait until object has sections with 'lied' property
        var ready = false;
        if (fp && typeof fp === 'object') {
          for (var k in fp) {
            if (fp[k] && typeof fp[k] === 'object' && fp[k].lied !== undefined) {
              ready = true;
              break;
            }
          }
        }
        if (ready || tries >= 150) { // 30s max (150 * 200ms)
          clearInterval(poll);
          if (fp && typeof fp === 'object') {
            try {
              // Sum all lied counts across sections
              var totalLied = 0;
              var liedSections = [];
              for (var key in fp) {
                if (fp[key] && typeof fp[key] === 'object' && typeof fp[key].lied === 'number') {
                  totalLied += fp[key].lied;
                  if (fp[key].lied > 0) liedSections.push(key + ':' + fp[key].lied);
                }
              }
              _botDetection = {
                bot: totalLied > 0,
                totalLied: totalLied,
                liedSections: liedSections,
                headless: fp.headless || (fp.headlessness ? fp.headlessness.lied : null),
                stealth: fp.stealth || (fp.resistance ? fp.resistance.lied : null),
              };
            } catch (e) {
              _botDetection = { bot: false, parseError: e.message };
            }
          } else {
            _botDetection = { bot: false, creepTimeout: true };
          }
        }
      }, 200);
    };
    crScript.onerror = function () { _botDetection = { bot: false, creepError: true }; };
    document.head.appendChild(crScript);
  }

  /* ── Behavioral tracker (same as VuotLink.jsx) ────────── */
  var _bhv = {
    mouse: [],
    clicks: 0,
    keys: 0,
    scrolls: 0,
    startTime: 0,
    probes: {}, // automation detection probes
  };
  var _bhvBound = false;
  function _bindBehavior() {
    if (_bhvBound) return;
    _bhvBound = true;
    _bhv.startTime = Date.now();
    var MAX = 50;
    document.addEventListener('mousemove', function (e) {
      _bhv.mouse.push({ x: e.clientX, y: e.clientY, t: Date.now() - _bhv.startTime });
      if (_bhv.mouse.length > MAX) _bhv.mouse.shift();
    }, { passive: true });
    document.addEventListener('click', function () { _bhv.clicks++; }, { passive: true });
    document.addEventListener('keydown', function () { _bhv.keys++; }, { passive: true });
    window.addEventListener('scroll', function () { _bhv.scrolls++; }, { passive: true });

    // ── Automation detection probes ──
    try {
      var p = _bhv.probes;
      // 1. navigator.webdriver (patched by undetected_chrome but check anyway)
      p.webdriver = !!navigator.webdriver;
      // 2. Chrome DevTools Protocol traces
      p.cdc = !!(window.cdc_adoQpoasnfa76pfcZLmcfl_ || window.cdc_adoQpoasnfa76pfcZLmcfl_Array || window.cdc_adoQpoasnfa76pfcZLmcfl_Promise || window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol);
      // 3. Selenium / automation properties
      p.selenium = !!(document.__selenium_unwrapped || document.__webdriver_evaluate || document.__driver_evaluate || window._Selenium_IDE_Recorder || window.__nightmare);
      // 4. navigator.plugins (headless often has 0)
      p.pluginCount = navigator.plugins ? navigator.plugins.length : -1;
      // 5. navigator.languages
      p.langCount = navigator.languages ? navigator.languages.length : 0;
      // 6. Chrome runtime check — real Chrome has window.chrome
      p.hasChrome = !!window.chrome;
      p.hasChromeRuntime = !!(window.chrome && window.chrome.runtime);
      // 7. Notification permission anomaly (headless gives denied + prompt)
      if (window.Notification) {
        p.notifPerm = Notification.permission;
      }
      // 8. Connection rtt (headless often has rtt=0)
      if (navigator.connection) {
        p.rtt = navigator.connection.rtt;
      }
      // 9. devtools open detection (debugger timing)
      var t1 = performance.now();
      // Regex that takes longer with devtools open
      var devtoolsRegex = /./;
      devtoolsRegex.toString = function () { return 'devtools'; };
      // Just collect timing, server analyzes
      p.perfTiming = Math.round(performance.now() - t1);
    } catch (e) { /* probes failed, that's ok */ }
  }



  /* ── CSS injection ────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('laynut-styles')) return;

    var r = 36;
    circumference = 2 * Math.PI * r;

    var css = [
      /* Button — base (position set dynamically) */
      '#laynut-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border:none;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-weight:700;letter-spacing:0.01em;transition:transform .15s ease,box-shadow .15s ease,opacity .3s ease;user-select:none;animation:ln-pop .4s cubic-bezier(.34,1.56,.64,1) both;}',
      '#laynut-btn:hover{transform:translateY(-2px) scale(1.03);}',
      '#laynut-btn:active{transform:scale(0.97);}',
      '#laynut-btn .ln-icon-img{object-fit:contain;display:block;flex-shrink:0;}',
      '#laynut-btn .ln-icon-em{font-style:normal;line-height:1;}',
      '#laynut-btn .ln-badge{background:rgba(255,255,255,0.28);border-radius:20px;padding:1px 8px;font-size:12px;font-weight:800;min-width:26px;text-align:center;}',
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
      '.ln-code-wrap{display:flex;align-items:stretch;border-radius:12px;overflow:hidden;margin-bottom:6px;}',
      '.ln-code-wrap{border-width:2px;border-style:solid;}',
      '.ln-code-val{flex:1;padding:13px 14px;font-size:17px;font-weight:900;letter-spacing:.04em;text-align:left;word-break:break-all;}',
      '.ln-copy-btn{padding:12px 16px;border:none;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.04em;transition:opacity .15s,transform .1s;flex-shrink:0;}',
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
      // First click: verify session exists before starting countdown
      checkSession(function (hasSession) {
        if (hasSession) {
          beginCountdown();
        } else {
          showNoSessionPopup();
        }
      });
    };

    /* ── Insert button into auto-created container ── */
    if (!cfg.insertTarget) {
      console.warn('[LayNut] insertTarget is required. Button will not be shown.');
      return;
    }

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
      console.warn('[LayNut] insertTarget never appeared:', cfg.insertTarget);
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
    var displayCode = sessionCode || 'Đang tải...';
    return '<div class="ln-code-wrap" style="border-color:' + t.codeBorder + '">' +
      '<div class="ln-code-val" style="background:' + t.codeBg + ';color:' + t.modalText + '">' + escHtml(displayCode) + '</div>' +
      '<button class="ln-copy-btn" id="laynut-copy" style="background:' + t.copyBg + ';color:' + t.copyText + '">SAO CHÉP</button>' +
      '</div>' +
      '<p class="ln-hint" style="color:' + t.hintColor + '">' + escHtml(cfg.successText) + '</p>';
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
  var currentChallenge = null;
  var challengeListener = null;
  var challengeTimes = []; // pre-scheduled array of remaining-values to trigger challenges

  var CHALLENGES = [
    { id: 'scroll-top', icon: '⬆️', text: 'Scroll lên đầu trang' },
    { id: 'scroll-bottom', icon: '⬇️', text: 'Scroll xuống cuối trang' },
    { id: 'click', icon: '👆', text: 'Click vào bất kỳ đâu trên trang' },
  ];

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
    var atTop = st <= 5;
    var atBottom = distBottom <= 5;

    var pool = [];
    if (atTop) {
      pool.push(CHALLENGES[1]); // scroll-bottom
    } else if (atBottom) {
      pool.push(CHALLENGES[0]); // scroll-top
    } else {
      pool.push(CHALLENGES[0], CHALLENGES[1]); // either direction
    }
    pool.push(CHALLENGES[2]); // click is always an option

    var ch = pool[Math.floor(Math.random() * pool.length)];
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
        if ((window.pageYOffset || document.documentElement.scrollTop) <= 5) completeChallenge();
      };
      window.addEventListener('scroll', challengeListener, { passive: true });
      if ((window.pageYOffset || document.documentElement.scrollTop) <= 5) completeChallenge();
    } else if (ch.id === 'scroll-bottom') {
      challengeListener = function () {
        var st = window.pageYOffset || document.documentElement.scrollTop;
        var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        if (docH - st - window.innerHeight <= 5) completeChallenge();
      };
      window.addEventListener('scroll', challengeListener, { passive: true });
      var st2 = window.pageYOffset || document.documentElement.scrollTop;
      var docH2 = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      if (docH2 - st2 - window.innerHeight <= 5) completeChallenge();
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

      // Check if it's time for a challenge
      if (challengeTimes.length > 0 && remaining <= challengeTimes[0]) {
        challengeTimes.shift(); // consume this challenge
        showChallenge();
        return;
      }

      // Countdown done!
      if (remaining <= 0) {
        revealed = true;
        if (badge) badge.remove();
        // Fetch the session code from server
        fetchSessionCode(function () {
          closeModal();
          openModal(); // show code
          if (typeof cfg.onReveal === 'function') cfg.onReveal(sessionCode);
        });
        return;
      }

      remaining--;
      tickTimer = setTimeout(tick, 1000);
    }
    tick();
  }

  /* ── Check if session exists (pre-countdown) ───────────── */
  var _sessionVerified = false;
  function checkSession(callback) {
    if (_sessionVerified) { callback(true); return; }
    if (!_widgetToken) { callback(false); return; }

    var base = _scriptBase;
    var url = base + '/api/widgets/public/' + _widgetToken + '/check-session';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (_sessionToken) xhr.setRequestHeader('X-Session-Token', _sessionToken);
    xhr.onload = function () {
      if (xhr.status === 200) {
        _sessionVerified = true;
        callback(true);
      } else {
        callback(false);
      }
    };
    xhr.onerror = function () { callback(false); };
    xhr.send('{}');
  }

  /* ── Fetch challenge token (anti-replay — same as vuotlink) ── */
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

    ov.innerHTML = '<div id="laynut-modal">' +
      '<button class="ln-close" onclick="document.getElementById(\'laynut-overlay\').remove()">✕</button>' +
      '<img src="' + escHtml(effectiveIcon) + '" height="' + cfg.iconSize + '" alt="" style="margin:0 auto 14px;display:block;width:auto;max-width:120px;object-fit:contain;' + iconBgStyle + '">' +
      '<h2 class="ln-title" style="color:' + t.modalText + '">Chưa có phiên làm việc</h2>' +
      '<p class="ln-msg" style="color:' + t.subText + '">Vui lòng bắt đầu từ trang vượt link trước hoặc cùng trình duyệt để nhận mã.</p>' +
      '<div style="margin-top:16px">' +
      '<button onclick="document.getElementById(\'laynut-overlay\').remove()" ' +
      'style="padding:10px 24px;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;' +
      'background:' + cfg.buttonColor + ';color:' + cfg.textColor + '">Đã hiểu</button>' +
      '</div>' +
      '</div>';

    applyModalTheme(ov.querySelector('#laynut-modal'));
    document.body.appendChild(ov);
  }

  /* ── Fetch session code from server (ONLY after countdown) ── */
  /* Sends behavioral data + challenge (same as vuotlink.js flow) */
  function fetchSessionCode(callback) {
    if (!_widgetToken) {
      sessionCode = 'ERR';
      if (callback) callback();
      return;
    }
    var base = _scriptBase;
    var url = base + '/api/widgets/public/' + _widgetToken + '/get-code';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (_sessionToken) xhr.setRequestHeader('X-Session-Token', _sessionToken);

    // Collect behavioral data (same fields as VuotLink.jsx)
    var countdownElapsed = _bhv.startTime ? Math.floor((Date.now() - _bhv.startTime) / 1000) : 0;
    var payload = {
      challengeId: _challengeId,
      _ck: _challengeKey,
      visitorId: _visitorId,
      botDetection: _botDetection,
      behavioral: {
        mousePoints: _bhv.mouse.length,
        mouseTrail: _bhv.mouse.slice(-30),
        clicks: _bhv.clicks,
        keys: _bhv.keys,
        scrolls: _bhv.scrolls,
        countdownTime: countdownElapsed,
        screen: {
          w: window.screen ? window.screen.width : 0,
          h: window.screen ? window.screen.height : 0,
          dpr: window.devicePixelRatio || 1
        }
      }
    };

    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var resp = JSON.parse(xhr.responseText);
          sessionCode = resp.code || '';
        } catch (e) {
          sessionCode = 'ERR';
        }
      } else {
        sessionCode = 'ERR';
      }
      if (callback) callback();
    };
    xhr.onerror = function () {
      sessionCode = 'ERR';
      if (callback) callback();
    };
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
    _bindBehavior();

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
    var label = document.querySelector('#laynut-btn .ln-label');
    if (label) label.textContent = 'Vui lòng chờ';
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

      function ready() {
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
                if (!resp.campaignFound) return;
                window.LayNut.init(config);
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
