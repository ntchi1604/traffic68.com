// CreepJS Direct Injector
// Inject this script into customer websites to get visitorId without iframe
(function() {
 var _sent = false;
 var _visitorId = 'unknown';
 var _botData = { bot: false, totalLied: 0 };
 var _capturedHash = null;

 function sendResult(data) {
 if (_sent) return;
 _sent = true;
 _visitorId = data.visitorId;
 _botData = data.botDetection;

 // Dispatch custom event for parent page to listen
 var event = new CustomEvent('creep-result', { detail: data });
 window.dispatchEvent(event);

 // Also try postMessage for iframe scenarios
 if (window.parent && window.parent !== window) {
 window.parent.postMessage({ type: 'creep-result', data: data }, '*');
 }
 }

 // Intercept console.log BEFORE loading creep.js
 var _origLog = console.log;
 console.log = function () {
 if (_capturedHash) return;
 for (var i = 0; i < arguments.length; i++) {
 var arg = arguments[i];
 if (arg && typeof arg === 'object') {
 if (arg.$hash) _capturedHash = arg.$hash;
 if (arg.visitorId) _capturedHash = arg.visitorId;
 if (arg.workerScope && arg.workerScope.$hash) _capturedHash = arg.workerScope.$hash;
 }
 }
 _origLog.apply(console, arguments);
 };

 // Load creep.js
 var s = document.createElement('script');
 s.src = '/creep.js';
 s.onload = function () {
 setTimeout(function () {
 if (_capturedHash) {
 sendResult({ visitorId: _capturedHash, botDetection: _botData });
 }
 console.log = _origLog;
 }, 1000);
 };
 s.onerror = function () {
 sendResult({ visitorId: 'unknown', botDetection: { bot: false, creepError: true } });
 console.log = _origLog;
 };
 document.head.appendChild(s);

 // Timeout 10s
 setTimeout(function () {
 if (!_sent) {
 if (_capturedHash) {
 sendResult({ visitorId: _capturedHash, botDetection: _botData });
 } else {
 sendResult({ visitorId: 'unknown', botDetection: { bot: false, creepTimeout: true } });
 }
 console.log = _origLog;
 }
 }, 10000);

 // Expose API for manual access
 window.CreepInjector = {
 getVisitorId: function() { return _visitorId; },
 onResult: function(callback) {
 window.addEventListener('creep-result', function(e) {
 callback(e.detail);
 });
 }
 };
})();
