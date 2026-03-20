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
  const { search, role, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let sql = `SELECT u.id, u.email, u.name, u.username, u.phone, u.role, u.status, u.referral_code, u.created_at,
    (SELECT COALESCE(SUM(w.balance), 0) FROM wallets w WHERE w.user_id = u.id) as total_balance,
    (SELECT COUNT(*) FROM campaigns c WHERE c.user_id = u.id) as campaign_count
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
    `${type === 'add' ? '+' : '-'}${numAmount.toLocaleString('vi-VN')} đ vào ví ${wType === 'main' ? 'Traffic' : 'Hoa hồng'}. Lý do: ${txNote}`,
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

// ── GET /admin/security — Security analytics ──
router.get('/security', async (req, res) => {
  try {
    const pool = getPool();
    const { filter, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // ── Stats (24h) ──
    const [totalTasks] = await pool.execute(
      `SELECT COUNT(*) as c FROM vuot_link_tasks WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    const [completedTasks] = await pool.execute(
      `SELECT COUNT(*) as c FROM vuot_link_tasks WHERE status = 'completed' AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    const [expiredTasks] = await pool.execute(
      `SELECT COUNT(*) as c FROM vuot_link_tasks WHERE status = 'expired' AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    const [uniqueDevices] = await pool.execute(
      `SELECT COUNT(DISTINCT visitor_id) as c FROM vuot_link_tasks WHERE visitor_id IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    const total24h = totalTasks[0].c || 0;
    const completed24h = completedTasks[0].c || 0;
    const expired24h = expiredTasks[0].c || 0;
    const blocked24h = total24h - completed24h - (total24h - completed24h - expired24h > 0 ? 0 : 0);

    // ── Top devices (high task count in 24h) ──
    const [topDevs] = await pool.execute(
      `SELECT visitor_id,
              COUNT(*) as total,
              SUM(status = 'completed') as completed,
              COUNT(DISTINCT ip_address) as ip_count
       FROM vuot_link_tasks
       WHERE visitor_id IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY visitor_id
       HAVING total >= 2
       ORDER BY total DESC LIMIT 10`
    );

    let logSql = `SELECT id, ip_address, visitor_id, status, user_agent, admin_note, bot_detected, mouse_score, mouse_reasons, mouse_points, clicks, created_at FROM vuot_link_tasks WHERE 1=1`;
    const logParams = [];

    if (filter === 'blocked') {
      logSql += ` AND status NOT IN ('completed', 'pending', 'step1', 'step2', 'step3')`;
    } else if (filter === 'warning') {
      logSql += ` AND visitor_id IN (SELECT visitor_id FROM vuot_link_tasks WHERE visitor_id IS NOT NULL GROUP BY visitor_id HAVING COUNT(*) >= 3)`;
    } else if (filter === 'passed') {
      logSql += ` AND status = 'completed'`;
    }

    if (search) {
      logSql += ` AND (ip_address LIKE ? OR visitor_id LIKE ?)`;
      logParams.push(`%${search}%`, `%${search}%`);
    }

    logSql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    logParams.push(Number(limit), offset);

    const [logs] = await pool.execute(logSql, logParams);

    res.json({
      stats: {
        totalTasks24h: total24h,
        completedTasks24h: completed24h,
        blockedTasks24h: expired24h,
        uniqueDevices24h: uniqueDevices[0].c,
        botDetected24h: 0,
        blockRate: total24h > 0 ? ((expired24h / total24h) * 100) : 0,
      },
      topDevices: topDevs,
      logs,
    });
  } catch (err) {
    console.error('Security API error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/security/tasks/:id/note — save admin note ──
router.put('/security/tasks/:id/note', async (req, res) => {
  try {
    const pool = getPool();
    const { note } = req.body;
    await pool.execute('UPDATE vuot_link_tasks SET admin_note = ? WHERE id = ?', [note || null, req.params.id]);
    res.json({ message: 'Đã lưu ghi chú' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
