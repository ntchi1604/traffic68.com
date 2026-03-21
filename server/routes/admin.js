const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Admin guard middleware
router.use(async (req, res, next) => {
  const pool = getPool();
  const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.userId]);
  if (!users[0] || users[0].role !== 'admin') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập trang admin' });
  }
  next();
});

// ── GET /api/admin/overview ──
router.get('/overview', async (req, res) => {
  const pool = getPool();
  const { fromDate, toDate } = req.query;

  let dateCondition = '';
  const dateParams = [];
  if (fromDate) { dateCondition += " AND DATE(created_at) >= ?"; dateParams.push(fromDate); }
  if (toDate) { dateCondition += " AND DATE(created_at) <= ?"; dateParams.push(toDate); }

  const [tu] = await pool.execute('SELECT COUNT(*) as c FROM users');
  const [tc] = await pool.execute('SELECT COUNT(*) as c FROM campaigns');
  const [rc] = await pool.execute("SELECT COUNT(*) as c FROM campaigns WHERE status = 'running'");

  const [td] = await pool.execute(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type = 'deposit' AND status = 'completed'${dateCondition}`, dateParams);
  const [tr] = await pool.execute(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type = 'withdraw' AND status = 'completed'${dateCondition}`, dateParams);
  const [pd] = await pool.execute(`SELECT COUNT(*) as c FROM transactions WHERE type = 'deposit' AND status = 'pending'${dateCondition}`, dateParams);
  const [tv] = await pool.execute('SELECT COALESCE(SUM(views_done), 0) as s FROM campaigns');
  const [pt] = await pool.execute("SELECT COUNT(*) as c FROM support_tickets WHERE status = 'open'");
  const [nuw] = await pool.execute("SELECT COUNT(*) as c FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");

  // Daily stats
  let chartSql, chartParams;
  if (fromDate || toDate) {
    chartSql = `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM transactions WHERE 1=1${dateCondition} GROUP BY DATE(created_at) ORDER BY date ASC`;
    chartParams = dateParams;
  } else {
    chartSql = `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) GROUP BY DATE(created_at) ORDER BY date ASC`;
    chartParams = [];
  }
  const [rawStats] = await pool.execute(chartSql, chartParams);

  const statsMap = {};
  rawStats.forEach(r => { statsMap[r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date] = r; });

  const dailyStats = [];
  const startStr = fromDate || (rawStats.length ? (rawStats[0].date instanceof Date ? rawStats[0].date.toISOString().slice(0, 10) : rawStats[0].date) : new Date().toISOString().slice(0, 10));
  const endStr = toDate || new Date().toISOString().slice(0, 10);
  const start = new Date(startStr);
  const end = new Date(endStr);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dailyStats.push(statsMap[key] || { date: key, count: 0, total: 0 });
  }

  res.json({
    overview: {
      totalUsers: tu[0].c, totalCampaigns: tc[0].c, runningCampaigns: rc[0].c,
      totalDeposits: td[0].s, totalRevenue: tr[0].s, totalViews: tv[0].s,
      pendingTickets: pt[0].c, newUsersWeek: nuw[0].c, pendingDeposits: pd[0].c,
    },
    dailyStats,
  });
});

// ── GET /api/admin/users ──
router.get('/users', async (req, res) => {
  const pool = getPool();
  const { search, role, service_type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let sql = `SELECT u.id, u.email, u.name, u.username, u.phone, u.role, u.service_type, u.status, u.referral_code, u.created_at,
    (SELECT COALESCE(SUM(w.balance), 0) FROM wallets w WHERE w.user_id = u.id) as total_balance,
    (SELECT COALESCE(w2.balance, 0) FROM wallets w2 WHERE w2.user_id = u.id AND w2.type = 'main') as main_balance,
    (SELECT COALESCE(w3.balance, 0) FROM wallets w3 WHERE w3.user_id = u.id AND w3.type = 'earning') as earning_balance,
    (SELECT COALESCE(w4.balance, 0) FROM wallets w4 WHERE w4.user_id = u.id AND w4.type = 'commission') as commission_balance,
    (SELECT COUNT(*) FROM campaigns c WHERE c.user_id = u.id) as campaign_count,
    (SELECT COUNT(*) FROM vuot_link_tasks vt WHERE vt.worker_id = u.id AND vt.status = 'completed') as task_count,
    (SELECT COALESCE(SUM(vt2.earning), 0) FROM vuot_link_tasks vt2 WHERE vt2.worker_id = u.id AND vt2.status = 'completed') as total_earning
    FROM users u WHERE 1=1`;
  let countSql = `SELECT COUNT(*) as total FROM users u WHERE 1=1`;
  const params = [];
  const countParams = [];

  if (search) {
    const searchCond = ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.username LIKE ?)';
    sql += searchCond; countSql += searchCond;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (role && role !== 'all') {
    sql += ' AND u.role = ?'; countSql += ' AND u.role = ?';
    params.push(role); countParams.push(role);
  }
  if (service_type && service_type !== 'all') {
    sql += ' AND u.service_type = ?'; countSql += ' AND u.service_type = ?';
    params.push(service_type); countParams.push(service_type);
  }

  const [totalRows] = await pool.execute(countSql, countParams);
  sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const [users] = await pool.execute(sql, params);
  res.json({ users, total: totalRows[0].total, page: Number(page), limit: Number(limit) });
});

// ── PUT /api/admin/users/:id ──
router.put('/users/:id', async (req, res) => {
  const pool = getPool();
  const { role, status, name, email } = req.body;
  await pool.execute(
    `UPDATE users SET role=COALESCE(?,role), status=COALESCE(?,status), name=COALESCE(?,name), email=COALESCE(?,email) WHERE id = ?`,
    [role || null, status || null, name || null, email || null, req.params.id]
  );
  const [users] = await pool.execute('SELECT id, email, name, role, status FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: 'Cập nhật thành công', user: users[0] });
});

// ── DELETE /api/admin/users/:id ──
router.delete('/users/:id', async (req, res) => {
  const pool = getPool();
  if (Number(req.params.id) === req.userId) return res.status(400).json({ error: 'Không thể xóa chính mình' });
  await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: 'Đã xóa người dùng' });
});

// ── POST /api/admin/users/:id/balance ──
router.post('/users/:id/balance', async (req, res) => {
  const pool = getPool();
  const { amount, type, walletType, note } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
  if (!['add', 'subtract'].includes(type)) return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' });

  const wType = walletType || 'main';
  const [wallets] = await pool.execute('SELECT id, balance FROM wallets WHERE user_id = ? AND type = ?', [req.params.id, wType]);
  if (wallets.length === 0) return res.status(404).json({ error: 'Không tìm thấy ví của người dùng' });
  const wallet = wallets[0];

  if (type === 'subtract' && wallet.balance < numAmount) {
    return res.status(400).json({ error: `Số dư ví không đủ (hiện có: ${wallet.balance.toLocaleString('vi-VN')} đ)` });
  }

  const newBalance = type === 'add' ? Number(wallet.balance) + numAmount : Number(wallet.balance) - numAmount;
  await pool.execute('UPDATE wallets SET balance = ? WHERE id = ?', [newBalance, wallet.id]);

  const refCode = 'ADM-' + Date.now();
  const txType = type === 'add' ? 'deposit' : 'withdraw';
  const txNote = note || (type === 'add' ? 'Admin cộng tiền' : 'Admin trừ tiền');
  await pool.execute(
    `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, wType, txType, 'admin', numAmount, 'completed', refCode, txNote]
  );

  await pool.execute(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`, [
    req.params.id,
    type === 'add' ? 'Ví được cộng tiền' : 'Ví bị trừ tiền',
    `${type === 'add' ? '+' : '-'}${numAmount.toLocaleString('vi-VN')} đ vào ví ${wType === 'main' ? 'Traffic' : wType === 'earning' ? 'Thu nhập' : 'Hoa hồng'}. Lý do: ${txNote}`,
    type === 'add' ? 'success' : 'warning'
  ]);

  res.json({ message: `Đã ${type === 'add' ? 'cộng' : 'trừ'} ${numAmount.toLocaleString('vi-VN')} đ`, newBalance, refCode });
});

// ── GET /api/admin/campaigns ──
router.get('/campaigns', async (req, res) => {
  const pool = getPool();
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let sql = `SELECT c.*, u.name as user_name, u.email as user_email FROM campaigns c LEFT JOIN users u ON c.user_id = u.id WHERE 1=1`;
  const params = [];
  if (search) { sql += ' AND (c.name LIKE ? OR c.url LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (status && status !== 'all') { sql += ' AND c.status = ?'; params.push(status); }
  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const [campaigns] = await pool.execute(sql, params);
  res.json({ campaigns });
});

// ── PUT /api/admin/campaigns/:id ──
router.put('/campaigns/:id', async (req, res) => {
  const pool = getPool();
  const { status } = req.body;
  await pool.execute('UPDATE campaigns SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ message: 'Đã cập nhật chiến dịch' });
});

// ── GET /api/admin/transactions ──
router.get('/transactions', async (req, res) => {
  const pool = getPool();
  const { type, status, fromDate, toDate, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let sql = `SELECT t.*, u.name as user_name, u.email as user_email FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE 1=1`;
  const params = [];
  if (type && type !== 'all') { sql += ' AND t.type = ?'; params.push(type); }
  if (status && status !== 'all') { sql += ' AND t.status = ?'; params.push(status); }
  if (fromDate) { sql += ' AND DATE(t.created_at) >= ?'; params.push(fromDate); }
  if (toDate) { sql += ' AND DATE(t.created_at) <= ?'; params.push(toDate); }
  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const [transactions] = await pool.execute(sql, params);
  res.json({ transactions });
});

// ── PUT /api/admin/transactions/:id/approve ──
router.put('/transactions/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const [txs] = await pool.execute('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (txs.length === 0) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
    const tx = txs[0];
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Giao dịch này đã được xử lý' });

    await pool.execute("UPDATE transactions SET status = 'completed' WHERE id = ?", [req.params.id]);
    await pool.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?', [tx.amount, tx.user_id, tx.wallet_type || 'main']);

    const fmt = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [tx.user_id, 'Nạp tiền thành công ✓', `Đơn nạp ${fmt} VND (Mã: ${tx.ref_code}) đã được admin duyệt. Tiền đã vào ví!`, 'success']
    );
    res.json({ message: `Đã duyệt đơn nạp ${fmt} VND` });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Lỗi duyệt giao dịch: ' + err.message });
  }
});

// ── PUT /api/admin/transactions/:id/reject ──
router.put('/transactions/:id/reject', async (req, res) => {
  try {
    const pool = getPool();
    const { reason } = req.body;
    const [txs] = await pool.execute('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (txs.length === 0) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
    const tx = txs[0];
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Giao dịch này đã được xử lý' });

    await pool.execute("UPDATE transactions SET status = 'failed', note = ? WHERE id = ?", [reason || 'Admin từ chối', req.params.id]);

    const fmt = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [tx.user_id, 'Đơn nạp tiền bị từ chối', `Đơn nạp ${fmt} VND (Mã: ${tx.ref_code}) đã bị từ chối. Lý do: ${reason || 'Không hợp lệ'}`, 'error']
    );
    res.json({ message: 'Đã từ chối đơn nạp' });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'Lỗi từ chối giao dịch: ' + err.message });
  }
});

// ── GET /api/admin/tickets ──
router.get('/tickets', async (req, res) => {
  const pool = getPool();
  const [tickets] = await pool.execute(`SELECT st.*, u.name as user_name, u.email as user_email FROM support_tickets st LEFT JOIN users u ON st.user_id = u.id ORDER BY st.created_at DESC LIMIT 50`);
  res.json({ tickets });
});

// ── PUT /api/admin/tickets/:id ──
router.put('/tickets/:id', async (req, res) => {
  const pool = getPool();
  const { status, reply } = req.body;
  if (reply !== undefined) {
    await pool.execute('UPDATE support_tickets SET admin_reply = ?, replied_at = NOW(), status = COALESCE(?, status) WHERE id = ?', [reply, status || null, req.params.id]);
  } else {
    await pool.execute('UPDATE support_tickets SET status = COALESCE(?, status) WHERE id = ?', [status || null, req.params.id]);
  }
  if (reply) {
    const [tickets] = await pool.execute('SELECT user_id, subject FROM support_tickets WHERE id = ?', [req.params.id]);
    if (tickets[0]) {
      await pool.execute(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`, [tickets[0].user_id, `Phản hồi ticket: ${tickets[0].subject}`, reply, 'info']);
    }
  }
  res.json({ message: 'Đã cập nhật ticket' });
});

// ── PUT /api/admin/settings/info ──
router.put('/settings/info', async (req, res) => {
  try {
    const pool = getPool();
    const { email, username, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email là bắt buộc' });

    const [emailCheck] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.userId]);
    if (emailCheck.length > 0) return res.status(409).json({ error: 'Email đã được sử dụng bởi tài khoản khác' });

    if (username) {
      const [usernameCheck] = await pool.execute("SELECT id FROM users WHERE username = ? AND username != '' AND id != ?", [username, req.userId]);
      if (usernameCheck.length > 0) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    }

    await pool.execute('UPDATE users SET email = ?, username = ?, name = ? WHERE id = ?', [email, username || '', name || '', req.userId]);
    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    console.error('Settings info error:', err);
    res.status(500).json({ error: 'Lỗi cập nhật: ' + err.message });
  }
});

// ── PUT /api/admin/settings/password ──
router.put('/settings/password', async (req, res) => {
  try {
    const pool = getPool();
    const bcrypt = require('bcryptjs');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });

    const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
    if (users.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    if (!bcrypt.compareSync(currentPassword, users[0].password_hash)) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });

    const newHash = bcrypt.hashSync(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.userId]);
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('Settings password error:', err);
    res.status(500).json({ error: 'Lỗi đổi mật khẩu: ' + err.message });
  }
});

// ── GET /admin/pricing ──
router.get('/pricing', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
    res.json({ tiers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/pricing/:id ──
router.put('/pricing/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { v1_price, v1_discount, v2_price, v2_discount } = req.body;
    await pool.execute(
      'UPDATE pricing_tiers SET v1_price=?, v1_discount=?, v2_price=?, v2_discount=? WHERE id=?',
      [v1_price, v1_discount, v2_price, v2_discount, req.params.id]
    );
    res.json({ message: 'Cập nhật giá thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/settings/site ──
router.get('/settings/site', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT setting_key, setting_value FROM site_settings');
    const config = {};
    rows.forEach(r => { config[r.setting_key] = r.setting_value; });
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/settings/site ──
router.put('/settings/site', async (req, res) => {
  try {
    const pool = getPool();
    const { settings } = req.body; // { discount_code: '...', discount_percent: '40', ... }
    for (const [key, value] of Object.entries(settings || {})) {
      await pool.execute(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, String(value), String(value)]
      );
    }
    res.json({ message: 'Cập nhật cài đặt thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/security', async (req, res) => {
  try {
    const pool = getPool();
    const { search, page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    await pool.execute(`CREATE TABLE IF NOT EXISTS security_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(20) NOT NULL DEFAULT 'unknown',
      reason VARCHAR(50) NOT NULL,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      visitor_id VARCHAR(100),
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at),
      INDEX idx_reason (reason),
      INDEX idx_ip (ip_address)
    )`);


    let countSql = `SELECT COUNT(*) as total FROM security_logs WHERE 1=1`;
    let listSql = `SELECT id, source, reason, ip_address, visitor_id, details, created_at FROM security_logs WHERE 1=1`;
    const params = [];

    if (search) {
      const searchClause = ` AND (ip_address LIKE ? OR visitor_id LIKE ? OR reason LIKE ?)`;
      countSql += searchClause;
      listSql += searchClause;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.execute(countSql, params);
    const total = countResult[0].total;

    listSql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const listParams = [...params, Number(limit), offset];
    const [rows] = await pool.execute(listSql, listParams);

    // Compute is_bot for each row based on details assessments
    const securityLogs = rows.map(row => {
      let isBot = false;
      try {
        const d = JSON.parse(row.details || '{}');
        if ((d.assessments || []).some(a => a.flagged)) isBot = true;
        const bd = d.botDetection || (d.totalLied !== undefined ? d : null);
        if (bd && (bd.bot === true || bd.totalLied > 0)) isBot = true;
        const probes = d.probes || {};
        if (probes.webdriver || probes.selenium || probes.cdc) isBot = true;
      } catch {}
      // Also check reason-based blocking
      if (['creep_detected', 'automation_probes', 'mouse_bot', 'bot_ua', 'ip_rate_limit', 'bot_behavior'].includes(row.reason)) isBot = true;
      return { id: row.id, source: row.source, reason: row.reason, ip_address: row.ip_address, visitor_id: row.visitor_id, created_at: row.created_at, is_bot: isBot };
    });

    res.json({ securityLogs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Security API error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/security/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, source, reason, ip_address, user_agent, visitor_id, details, created_at FROM security_logs WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ event: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/ip/:ip — IP Evaluation ──
router.get('/security/ip/:ip', async (req, res) => {
  try {
    const pool = getPool();
    const ip = req.params.ip;

    // 1. Tasks from this IP (last 7 days)
    const [taskStats] = await pool.execute(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
       SUM(CASE WHEN bot_detected = 1 THEN 1 ELSE 0 END) as bot_detected,
       COUNT(DISTINCT worker_id) as unique_workers,
       COUNT(DISTINCT DATE(created_at)) as active_days,
       MIN(created_at) as first_seen,
       MAX(created_at) as last_seen
       FROM vuot_link_tasks WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [ip]
    );

    // 2. Daily breakdown
    const [dailyBreakdown] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as tasks,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM vuot_link_tasks WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at) ORDER BY date DESC`,
      [ip]
    );

    // 3. Workers using this IP
    const [workers] = await pool.execute(
      `SELECT DISTINCT u.id, u.name, u.email, u.status, COUNT(t.id) as task_count
       FROM vuot_link_tasks t LEFT JOIN users u ON t.worker_id = u.id
       WHERE t.ip_address = ? AND t.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) AND t.worker_id IS NOT NULL
       GROUP BY u.id ORDER BY task_count DESC LIMIT 20`,
      [ip]
    );

    // 4. Security events for this IP
    const [secEvents] = await pool.execute(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN reason IN ('creep_detected','automation_probes','mouse_bot','bot_ua','ip_rate_limit') THEN 1 ELSE 0 END) as blocked,
       SUM(CASE WHEN reason = 'suspicious' THEN 1 ELSE 0 END) as suspicious
       FROM security_logs WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [ip]
    );

    // 5. All-time stats
    const [allTime] = await pool.execute(
      `SELECT COUNT(*) as total, MIN(created_at) as first_seen FROM vuot_link_tasks WHERE ip_address = ?`,
      [ip]
    );

    // 6. VPN/Proxy check via ip-api.com (free, no key needed)
    let geoData = null;
    try {
      const https = require('http');
      const geoResponse = await new Promise((resolve, reject) => {
        const url = `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,as,proxy,hosting,mobile,query`;
        require('http').get(url, (resp) => {
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        }).on('error', () => resolve(null));
      });
      if (geoResponse && geoResponse.status === 'success') {
        geoData = geoResponse;
      }
    } catch { }

    // Calculate risk score
    const stats = taskStats[0];
    const sec = secEvents[0];
    let riskScore = 0;
    const risks = [];

    // Multiple workers same IP
    if (stats.unique_workers > 3) {
      riskScore += 25;
      risks.push({ type: 'multi_worker', label: `${stats.unique_workers} worker dùng chung IP`, severity: 'high' });
    } else if (stats.unique_workers > 1) {
      riskScore += 10;
      risks.push({ type: 'multi_worker', label: `${stats.unique_workers} worker dùng chung IP`, severity: 'medium' });
    }

    // High task volume
    if (stats.total > 50) {
      riskScore += 20;
      risks.push({ type: 'high_volume', label: `${stats.total} tasks trong 7 ngày`, severity: 'high' });
    } else if (stats.total > 20) {
      riskScore += 10;
      risks.push({ type: 'high_volume', label: `${stats.total} tasks trong 7 ngày`, severity: 'medium' });
    }

    // Bot detections
    if (sec.blocked > 0) {
      riskScore += 30;
      risks.push({ type: 'blocked', label: `${sec.blocked} lần bị chặn`, severity: 'high' });
    }
    if (sec.suspicious > 3) {
      riskScore += 15;
      risks.push({ type: 'suspicious', label: `${sec.suspicious} sự kiện đáng ngờ`, severity: 'medium' });
    }

    // VPN/Proxy/Hosting
    if (geoData) {
      if (geoData.proxy) {
        riskScore += 30;
        risks.push({ type: 'vpn_proxy', label: 'IP là VPN/Proxy', severity: 'high' });
      }
      if (geoData.hosting) {
        riskScore += 25;
        risks.push({ type: 'hosting', label: 'IP thuộc dải datacenter/hosting', severity: 'high' });
      }
      if (geoData.mobile) {
        risks.push({ type: 'mobile', label: 'IP mạng di động (chia sẻ NAT)', severity: 'info' });
      }
    }

    // Low completion rate
    if (stats.total > 5) {
      const completionRate = stats.completed / stats.total;
      if (completionRate < 0.3) {
        riskScore += 15;
        risks.push({ type: 'low_completion', label: `Chỉ ${Math.round(completionRate * 100)}% hoàn thành`, severity: 'medium' });
      }
    }

    const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';

    res.json({
      ip,
      riskScore,
      riskLevel,
      risks,
      stats: {
        total: stats.total,
        completed: stats.completed,
        expired: stats.expired,
        botDetected: stats.bot_detected,
        uniqueWorkers: stats.unique_workers,
        activeDays: stats.active_days,
        firstSeen: stats.first_seen,
        lastSeen: stats.last_seen,
      },
      allTime: { total: allTime[0].total, firstSeen: allTime[0].first_seen },
      dailyBreakdown,
      workers,
      securityEvents: { total: sec.total, blocked: sec.blocked, suspicious: sec.suspicious },
      geo: geoData ? {
        country: geoData.country,
        region: geoData.regionName,
        city: geoData.city,
        isp: geoData.isp,
        org: geoData.org,
        as: geoData.as,
        proxy: !!geoData.proxy,
        hosting: !!geoData.hosting,
        mobile: !!geoData.mobile,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/referrals/:type (buyers or workers) ──
router.get('/referrals/:type', async (req, res) => {
  try {
    const pool = getPool();
    const type = req.params.type; // 'buyers' or 'workers'
    const serviceFilter = type === 'workers' ? "AND u.service_type = 'worker'" : "AND (u.service_type = 'buyer' OR u.service_type IS NULL)";
    const search = req.query.search || '';

    let sql = `
      SELECT u.id, u.name, u.email, u.referral_code, u.service_type,
        (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) as ref_count
      FROM users u
      WHERE (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) > 0
      ${serviceFilter}
    `;
    const params = [];

    if (search) {
      sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.referral_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY ref_count DESC LIMIT 100';

    const [referrers] = await pool.execute(sql, params);

    // Get referred users for each referrer
    for (const ref of referrers) {
      const [referred] = await pool.execute(
        `SELECT id, name, email, service_type, status, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC LIMIT 50`,
        [ref.id]
      );
      ref.referred = referred;
    }

    // Stats
    const serviceWhere = type === 'workers' ? "AND service_type = 'worker'" : "AND (service_type = 'buyer' OR service_type IS NULL)";
    const [totalRefs] = await pool.execute(`SELECT COUNT(*) as c FROM users WHERE referred_by IS NOT NULL ${serviceWhere}`);
    const [totalReferrers] = await pool.execute(`SELECT COUNT(DISTINCT referred_by) as c FROM users WHERE referred_by IS NOT NULL`);

    res.json({ referrers, totalReferred: totalRefs[0].c, totalReferrers: totalReferrers[0].c });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/worker-tasks ──
router.get('/worker-tasks', async (req, res) => {
  try {
    const pool = getPool();
    const { page = 1, limit = 30, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = '1=1';
    const params = [];
    if (status && status !== 'all') { where += ' AND t.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countR] = await pool.execute(`SELECT COUNT(*) as c FROM vuot_link_tasks t LEFT JOIN users u ON t.worker_id = u.id LEFT JOIN campaigns c ON t.campaign_id = c.id WHERE ${where}`, params);
    const [tasks] = await pool.execute(
      `SELECT t.id, t.keyword, t.status, t.earning, t.completed_at, t.created_at,
       c.name as campaign_name, c.url as campaign_url,
       u.name as worker_name, u.email as worker_email
       FROM vuot_link_tasks t
       LEFT JOIN campaigns c ON t.campaign_id = c.id
       LEFT JOIN users u ON t.worker_id = u.id
       WHERE ${where}
       ORDER BY t.created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
      params
    );

    res.json({ tasks, total: countR[0].c, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/worker-withdrawals ──
router.get('/worker-withdrawals', async (req, res) => {
  try {
    const pool = getPool();
    const { status } = req.query;

    let where = "t.type = 'withdraw' AND t.wallet_type = 'earning'";
    const params = [];
    if (status && status !== 'all') { where += ' AND t.status = ?'; params.push(status); }

    const [rows] = await pool.execute(
      `SELECT t.*, u.name as user_name, u.email as user_email
       FROM transactions t LEFT JOIN users u ON t.user_id = u.id
       WHERE ${where} ORDER BY t.created_at DESC LIMIT 200`,
      params
    );
    res.json({ withdrawals: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/worker-withdrawals/:id ──
router.put('/worker-withdrawals/:id', async (req, res) => {
  const pool = getPool();
  const { action } = req.body; // 'approve' or 'reject'
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [txs] = await conn.execute('SELECT * FROM transactions WHERE id = ? AND type = ? AND wallet_type = ? FOR UPDATE', [req.params.id, 'withdraw', 'earning']);
    if (!txs[0]) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Không tìm thấy' }); }
    const tx = txs[0];
    if (tx.status !== 'pending') { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Đã xử lý rồi' }); }

    const newStatus = action === 'approve' ? 'completed' : 'rejected';
    await conn.execute('UPDATE transactions SET status = ? WHERE id = ?', [newStatus, tx.id]);

    if (action === 'reject') {
      // Refund back to earning wallet
      await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?', [tx.amount, tx.user_id, 'earning']);
    }

    // Notify user
    const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [tx.user_id,
       action === 'approve' ? 'Rút tiền thành công' : 'Rút tiền bị từ chối',
       action === 'approve' ? `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) đã được duyệt.` : `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) bị từ chối. Số tiền đã hoàn lại ví.`,
       action === 'approve' ? 'success' : 'warning']
    );

    await conn.commit();
    conn.release();
    res.json({ message: action === 'approve' ? 'Đã duyệt' : 'Đã từ chối và hoàn tiền' });
  } catch (err) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/referrals/:type ──
router.get('/referrals/:type', async (req, res) => {
  try {
    const pool = getPool();
    const type = req.params.type; // 'buyers' or 'workers'
    const serviceType = type === 'workers' ? 'shortlink' : 'traffic';
    const { search } = req.query;

    let where = 'r.service_type = ?';
    const params = [serviceType];
    if (search) {
      where += ' AND (r.name LIKE ? OR r.email LIKE ? OR r.referral_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get referrers who have at least 1 referral
    const [referrers] = await pool.execute(
      `SELECT r.id, r.name, r.email, r.referral_code, r.service_type,
       (SELECT COUNT(*) FROM users WHERE referred_by = r.id) as ref_count
       FROM users r
       WHERE ${where} AND (SELECT COUNT(*) FROM users WHERE referred_by = r.id) > 0
       ORDER BY ref_count DESC LIMIT 100`,
      params
    );

    // For each referrer, get their referred users
    for (const ref of referrers) {
      const [referred] = await pool.execute(
        'SELECT id, name, email, service_type, status, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC',
        [ref.id]
      );
      ref.referred = referred;
    }

    const [totalReferrers] = await pool.execute(
      `SELECT COUNT(*) as c FROM users r WHERE r.service_type = ? AND (SELECT COUNT(*) FROM users WHERE referred_by = r.id) > 0`,
      [serviceType]
    );
    const [totalReferred] = await pool.execute(
      `SELECT COUNT(*) as c FROM users u INNER JOIN users r ON u.referred_by = r.id WHERE r.service_type = ?`,
      [serviceType]
    );

    res.json({
      referrers,
      totalReferrers: totalReferrers[0].c,
      totalReferred: totalReferred[0].c,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
