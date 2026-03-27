"use strict";
const fs = require('fs');

let c = fs.readFileSync('src/pages/Admin/AdminSecurity.jsx', 'utf8');

const reasonViInsert = `
const REASON_VI = {
  creepjs_bot: 'Bot (CreepJS)',
  headless_or_webdriver: 'Headless / WebDriver',
  canvas_suspicious: 'Canvas giả mạo',
  webgl_suspicious: 'WebGL bất thường',
  non_google_referrer: 'Không từ Google',
  rate_limit: 'Vượt giới hạn tốc độ',
  duplicate_visitor: 'Visitor trùng lặp',
  ip_blocked: 'IP bị chặn',
  proof_invalid: 'Xác minh thất bại',
  devtools_open: 'DevTools mở',
  automation_detected: 'Tự động hóa',
  fingerprint_mismatch: 'Fingerprint không khớp',
};
`;

if (!c.includes('REASON_VI')) {
  c = c.replace('const REASON_META =', reasonViInsert + 'const REASON_META =');
  console.log('Added REASON_VI');
}

// 2. Add ipFilter, ipPage state to UserDetail
const oldState = "  const [allIps, setAllIps] = useState(u.ips || []);\r\n  const [ipsLoaded, setIpsLoaded] = useState(false);\r\n  const LIMIT = 50;";
const newState = "  const [allIps, setAllIps] = useState(u.ips || []);\r\n  const [ipsLoaded, setIpsLoaded] = useState(false);\r\n  const [ipFilter, setIpFilter] = useState('all');\r\n  const [ipPage, setIpPage] = useState(1);\r\n  const IP_PER_PAGE = 15;\r\n  const LIMIT = 50;";

if (c.includes(oldState)) {
  c = c.replace(oldState, newState);
  console.log('Added ipFilter states');
}

// 3. Fix event reason display to Vietnamese
const oldReason = '{ev.reason}';
const newReason = '{REASON_VI[ev.reason] || ev.reason}';
if (c.includes(oldReason)) {
  c = c.replace(oldReason, newReason);
  console.log('Fixed ev.reason display');
}

fs.writeFileSync('src/pages/Admin/AdminSecurity.jsx', c, 'utf8');
console.log('All done!');
