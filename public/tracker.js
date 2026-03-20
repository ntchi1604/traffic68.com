/**
 * Anti-Bot Behavioral Tracker v1.0
 * Senior Security Engineer — Mouse tracking, WebGL fingerprint, Headless detection
 * Gọn nhẹ, tối ưu, không thư viện ngoài
 */
(function (w, d) {
  'use strict';

  /* ── Anti-Debug: TEMPORARILY DISABLED FOR DEBUGGING ── */
  var _devOpen = false;
  var _tainted = false;

  // TODO: Re-enable before production deploy
  // (function _trap() {
  //   var t = Date.now();
  //   debugger;
  //   if (Date.now() - t > 50) _devOpen = true;
  //   setTimeout(_trap, _devOpen ? 100 : 3000);
  // })();

  // function _checkTiming() {
  //   var t1 = performance.now();
  //   for (var i = 0; i < 1000; i++) Math.random();
  //   var t2 = performance.now();
  //   if (t2 - t1 > 50) { _devOpen = true; _tainted = true; }
  // }
  // setInterval(_checkTiming, 5000);

  // setInterval(function () {
  //   if (_devOpen) {
  //     try { console.clear(); } catch (e) {}
  //   }
  // }, 500);

  var MAX_POINTS = 50;
  var mouseTrail = [];
  var pageLoadTime = Date.now();
  var clickCount = 0;
  var keyPressCount = 0;
  var scrollCount = 0;
  var touchPoints = [];

  /* ── Mouse Tracking ─────────────────────────────────── */
  function onMove(e) {
    var point = { x: e.clientX || 0, y: e.clientY || 0, t: Date.now() };
    mouseTrail.push(point);
    if (mouseTrail.length > MAX_POINTS) mouseTrail.shift();
  }

  function onTouch(e) {
    if (e.touches && e.touches[0]) {
      var touch = e.touches[0];
      touchPoints.push({ x: touch.clientX, y: touch.clientY, t: Date.now() });
      if (touchPoints.length > MAX_POINTS) touchPoints.shift();
    }
  }

  function onClick() { clickCount++; }
  function onKeyPress() { keyPressCount++; }
  function onScroll() { scrollCount++; }

  d.addEventListener('mousemove', onMove, { passive: true });
  d.addEventListener('click', onClick, { passive: true });
  d.addEventListener('keydown', onKeyPress, { passive: true });
  d.addEventListener('touchstart', onTouch, { passive: true });
  d.addEventListener('touchmove', onTouch, { passive: true });
  w.addEventListener('scroll', onScroll, { passive: true });

  /* ── WebGL Fingerprint ──────────────────────────────── */
  function getWebGLFingerprint() {
    try {
      var canvas = d.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';

      // Draw a shaded triangle
      var vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}');
      gl.compileShader(vs);

      var fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, 'precision mediump float;void main(){gl_FragColor=vec4(0.2,0.7,0.3,1.0);}');
      gl.compileShader(fs);

      var prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.linkProgram(prog); gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0.5, -0.5, -0.5, 0.5, -0.5]), gl.STATIC_DRAW);

      var loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      gl.clearColor(0.1, 0.1, 0.1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Hash the DataURI
      var dataUri = canvas.toDataURL();
      var hash = 0;
      for (var i = 0; i < dataUri.length; i++) {
        hash = ((hash << 5) - hash) + dataUri.charCodeAt(i);
        hash |= 0;
      }
      return hash.toString(16);
    } catch (e) {
      return 'error';
    }
  }

  /* ── Headless / Automation Detection ────────────────── */
  function detectHeadless() {
    var flags = 0;

    // navigator.webdriver
    if (w.navigator.webdriver) flags |= 1;

    // Missing plugins (headless Chrome has 0 plugins)
    if (w.navigator.plugins && w.navigator.plugins.length === 0) flags |= 2;

    // Missing languages
    if (!w.navigator.languages || w.navigator.languages.length === 0) flags |= 4;

    // Chrome without chrome object
    if (/Chrome/.test(w.navigator.userAgent) && !w.chrome) flags |= 8;

    // Permissions API inconsistency
    try {
      if (w.navigator.permissions) {
        w.navigator.permissions.query({ name: 'notifications' }).then(function (r) {
          if (r.state === 'prompt' && Notification.permission === 'denied') flags |= 16;
        }).catch(function () {});
      }
    } catch (e) {}

    // Phantom / Selenium markers
    if (w._phantom || w.__nightmare || w.callPhantom) flags |= 32;
    if (d.documentElement.getAttribute('webdriver')) flags |= 64;

    // Screen size anomaly
    if (w.outerWidth === 0 && w.outerHeight === 0) flags |= 128;

    return flags;
  }

  /* ── Canvas 2D Fingerprint ──────────────────────────── */
  function getCanvas2DHash() {
    try {
      var c = d.createElement('canvas');
      c.width = 120; c.height = 30;
      var ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 120, 30);
      ctx.fillStyle = '#069';
      ctx.fillText('T68@bot?', 2, 5);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('T68@bot?', 4, 7);
      var data = c.toDataURL();
      var h = 0;
      for (var i = 0; i < data.length; i++) {
        h = ((h << 5) - h) + data.charCodeAt(i);
        h |= 0;
      }
      return h.toString(16);
    } catch (e) {
      return 'error';
    }
  }

  /* ── Key Derivation + XOR Encode ─────────────────────── */
  // Derive actual key from server key (never use raw key directly)
  function _deriveKey(serverKey) {
    if (!serverKey) return '';
    var h = 0x811c9dc5; // FNV offset
    for (var i = 0; i < serverKey.length; i++) {
      h ^= serverKey.charCodeAt(i);
      h = Math.imul(h, 0x01000193); // FNV prime
    }
    // Mix server key with derived hash to create longer key
    var derived = '';
    for (var j = 0; j < 32; j++) {
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
      derived += String.fromCharCode((h & 0x7F) + 32);
    }
    return serverKey + derived;
  }

  function xorEncode(str, dynamicKey) {
    if (!dynamicKey) return btoa(str); // No key = no encode (server will reject)
    var k = _deriveKey(dynamicKey);
    var out = '';
    for (var i = 0; i < str.length; i++) {
      out += String.fromCharCode(str.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    }
    return btoa(out);
  }

  /* ── Public API ─────────────────────────────────────── */
  w.BotTracker = {
    /**
     * Collect all behavioral data and return encoded payload
     * @param {string} dynamicKey — XOR key from server challenge (optional)
     */
    collect: function (dynamicKey) {
      var now = Date.now();
      var trail = mouseTrail.length > 0 ? mouseTrail : touchPoints;

      var payload = {
        // Mouse/touch trail (last 50 points)
        m: trail.map(function (p) { return { x: p.x, y: p.y, t: p.t - pageLoadTime }; }),
        // WebGL fingerprint hash
        wgl: getWebGLFingerprint(),
        // Canvas 2D fingerprint hash
        c2d: getCanvas2DHash(),
        // Time since page load (ms)
        lt: now - pageLoadTime,
        // Headless detection flags (bitmask)
        hd: detectHeadless(),
        // Interaction counts
        ic: { clicks: clickCount, keys: keyPressCount, scrolls: scrollCount },
        // Screen info
        sc: { w: w.screen.width, h: w.screen.height, dpr: w.devicePixelRatio || 1 },
        // DevTools detection
        dt: _devOpen ? 1 : 0,
        tn: _tainted ? 1 : 0,
        // Timestamp
        ts: now,
      };

      return xorEncode(JSON.stringify(payload), dynamicKey);
    },

    /**
     * Get raw payload (for debugging)
     */
    raw: function () {
      var trail = mouseTrail.length > 0 ? mouseTrail : touchPoints;
      return {
        mousePoints: trail.length,
        loadTime: Date.now() - pageLoadTime,
        headlessFlags: detectHeadless(),
        webgl: getWebGLFingerprint(),
        canvas2d: getCanvas2DHash(),
        clicks: clickCount,
        keys: keyPressCount,
        scrolls: scrollCount,
      };
    },
  };

})(window, document);
