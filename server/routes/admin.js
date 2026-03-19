const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Admin guard middleware
router.use((req, res, next) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập trang admin' });
  }
  next();
});

// ── GET /api/admin/overview ──
router.get('/overview', (req, res) => {
  const db = getDb();
  const { fromDate, toDate } = req.query;

  // Build date condition for transactions
  let dateCondition = '';
  const dateParams = [];
  if (fromDate) {
    dateCondition += " AND date(created_at) >= ?";
    dateParams.push(fromDate);
  }
  if (toDate) {
    dateCondition += " AND date(created_at) <= ?";
    dateParams.push(toDate);
  }

  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalCampaigns = db.prepare('SELECT COUNT(*) as c FROM campaigns').get().c;
  const runningCampaigns = db.prepare("SELECT COUNT(*) as c FROM campaigns WHERE status = 'running'").get().c;

  const totalDeposits = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type = 'deposit' AND status = 'completed'${dateCondition}`).get(...dateParams).s;
  const totalRevenue = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type = 'withdraw' AND status = 'completed'${dateCondition}`).get(...dateParams).s;
  const pendingDeposits = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'deposit' AND status = 'pending'${dateCondition}`).get(...dateParams).c;
  const totalViews = db.prepare('SELECT COALESCE(SUM(views_done), 0) as s FROM campaigns').get().s;
  const pendingTickets = db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status = 'open'").get().c;

  // Recent users (last 7 days)
  const newUsersWeek = db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-7 days')").get().c;

  // Daily stats for chart
  let chartSql = `SELECT date(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
    FROM transactions WHERE 1=1${dateCondition}`;
  if (!fromDate && !toDate) {
    chartSql = `SELECT date(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM transactions WHERE created_at >= datetime('now', '-14 days')`;
  }
  chartSql += ' GROUP BY date(created_at) ORDER BY date ASC';
  const rawStats = db.prepare(chartSql).all(...(fromDate || toDate ? dateParams : []));

  // Fill missing dates so chart shows complete range
  const statsMap = {};
  rawStats.forEach(r => { statsMap[r.date] = r; });

  const dailyStats = [];
  const startStr = fromDate || (rawStats.length ? rawStats[0].date : new Date().toISOString().slice(0, 10));
  const endStr = toDate || new Date().toISOString().slice(0, 10);
  const start = new Date(startStr);
  const end = new Date(endStr);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dailyStats.push(statsMap[key] || { date: key, count: 0, total: 0 });
  }

  res.json({
    overview: {
      totalUsers, totalCampaigns, runningCampaigns,
      totalDeposits, totalRevenue, totalViews,
      pendingTickets, newUsersWeek, pendingDeposits,
    },
    dailyStats,
  });
});

// ── GET /api/admin/users ──
router.get('/users', (req, res) => {
  const db = getDb();
  const { search, role, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let sql = `SELECT u.id, u.email, u.name, u.username, u.phone, u.role, u.status, u.referral_code, u.created_at,
    (SELECT COALESCE(SUM(w.balance), 0) FROM wallets w WHERE w.user_id = u.id) as total_balance,
    (SELECT COUNT(*) FROM campaigns c WHERE c.user_id = u.id) as campaign_count
    FROM users u WHERE 1=1`;
  const params = [];

  if (search) {
    sql += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.username LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (role && role !== 'all') {
    sql += ' AND u.role = ?';
    params.push(role);
  }

  const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
  const total = db.prepare(countSql).get(...params)?.total || 0;

  sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const users = db.prepare(sql).all(...params);
  res.json({ users, total, page: Number(page), limit: Number(limit) });
});

// ── PUT /api/admin/users/:id ──
router.put('/users/:id', (req, res) => {
  const db = getDb();
  const { role, status, name, email } = req.body;

  db.prepare(`
    UPDATE users SET
      role = COALESCE(?, role),
      status = COALESCE(?, status),
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(role || null, status || null, name || null, email || null, req.params.id);

  const user = db.prepare('SELECT id, email, name, role, status FROM users WHERE id = ?').get(req.params.id);
  res.json({ message: 'Cập nhật thành công', user });
});

// ── DELETE /api/admin/users/:id ──
router.delete('/users/:id', (req, res) => {
  const db = getDb();
  if (Number(req.params.id) === req.userId) {
    return res.status(400).json({ error: 'Không thể xóa chính mình' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xóa người dùng' });
});

// ── POST /api/admin/users/:id/balance ── (Cộng/Trừ tiền)
router.post('/users/:id/balance', (req, res) => {
  const db = getDb();
  const { amount, type, walletType, note } = req.body;
  // type: 'add' or 'subtract'
  // walletType: 'main' or 'commission'

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
  }
  if (!['add', 'subtract'].includes(type)) {
    return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' });
  }

  const wType = walletType || 'main';
  const wallet = db.prepare('SELECT id, balance FROM wallets WHERE user_id = ? AND type = ?')
    .get(req.params.id, wType);

  if (!wallet) {
    return res.status(404).json({ error: 'Không tìm thấy ví của người dùng' });
  }

  if (type === 'subtract' && wallet.balance < numAmount) {
    return res.status(400).json({ error: `Số dư ví không đủ (hiện có: ${wallet.balance.toLocaleString('vi-VN')} đ)` });
  }

  // Update wallet
  const newBalance = type === 'add' ? wallet.balance + numAmount : wallet.balance - numAmount;
  db.prepare('UPDATE wallets SET balance = ? WHERE id = ?')
    .run(newBalance, wallet.id);

  // Record transaction
  const refCode = 'ADM-' + Date.now();
  const txType = type === 'add' ? 'deposit' : 'withdraw';
  const txNote = note || (type === 'add' ? 'Admin cộng tiền' : 'Admin trừ tiền');

  db.prepare(`
    INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, wType, txType, 'admin', numAmount, 'completed', refCode, txNote);

  // Notification to user
  const admin = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId);
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
  `).run(
    req.params.id,
    type === 'add' ? 'Ví được cộng tiền' : 'Ví bị trừ tiền',
    `${type === 'add' ? '+' : '-'}${numAmount.toLocaleString('vi-VN')} đ vào ví ${wType === 'main' ? 'Traffic' : 'Hoa hồng'}. Lý do: ${txNote}`,
    type === 'add' ? 'success' : 'warning'
  );

  res.json({
    message: `Đã ${type === 'add' ? 'cộng' : 'trừ'} ${numAmount.toLocaleString('vi-VN')} đ`,
    newBalance,
    refCode,
  });
});

// ── GET /api/admin/campaigns ──
router.get('/campaigns', (req, res) => {
  const db = getDb();
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let sql = `SELECT c.*, u.name as user_name, u.email as user_email
    FROM campaigns c LEFT JOIN users u ON c.user_id = u.id WHERE 1=1`;
  const params = [];

  if (search) {
    sql += ' AND (c.name LIKE ? OR c.url LIKE ? OR u.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status && status !== 'all') {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const campaigns = db.prepare(sql).all(...params);
  res.json({ campaigns });
});

// ── PUT /api/admin/campaigns/:id ──
router.put('/campaigns/:id', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  db.prepare('UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, req.params.id);
  res.json({ message: 'Đã cập nhật chiến dịch' });
});

// ── GET /api/admin/transactions ──
router.get('/transactions', (req, res) => {
  const db = getDb();
  const { type, status, fromDate, toDate, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let sql = `SELECT t.*, u.name as user_name, u.email as user_email
    FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE 1=1`;
  const params = [];

  if (type && type !== 'all') {
    sql += ' AND t.type = ?';
    params.push(type);
  }
  if (status && status !== 'all') {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  if (fromDate) {
    sql += ' AND date(t.created_at) >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND date(t.created_at) <= ?';
    params.push(toDate);
  }

  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const transactions = db.prepare(sql).all(...params);
  res.json({ transactions });
});

// ── PUT /api/admin/transactions/:id/approve ──
router.put('/transactions/:id/approve', (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

    if (!tx) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Giao dịch này đã được xử lý' });

    // Update transaction status
    db.prepare("UPDATE transactions SET status = 'completed' WHERE id = ?")
      .run(req.params.id);

    // Add money to wallet
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?')
      .run(tx.amount, tx.user_id, tx.wallet_type || 'main');

    // Notify user
    const fmt = new Intl.NumberFormat('vi-VN').format(tx.amount);
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `).run(tx.user_id, 'Nạp tiền thành công ✓', `Đơn nạp ${fmt} VND (Mã: ${tx.ref_code}) đã được admin duyệt. Tiền đã vào ví!`, 'success');

    res.json({ message: `Đã duyệt đơn nạp ${fmt} VND` });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Lỗi duyệt giao dịch: ' + err.message });
  }
});

// ── PUT /api/admin/transactions/:id/reject ──
router.put('/transactions/:id/reject', (req, res) => {
  try {
    const db = getDb();
    const { reason } = req.body;
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

    if (!tx) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Giao dịch này đã được xử lý' });

    // Update transaction status
    db.prepare("UPDATE transactions SET status = 'failed', note = ? WHERE id = ?")
      .run(reason || 'Admin từ chối', req.params.id);

    // Notify user
    const fmt = new Intl.NumberFormat('vi-VN').format(tx.amount);
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `).run(tx.user_id, 'Đơn nạp tiền bị từ chối', `Đơn nạp ${fmt} VND (Mã: ${tx.ref_code}) đã bị từ chối. Lý do: ${reason || 'Không hợp lệ'}`, 'error');

    res.json({ message: `Đã từ chối đơn nạp` });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'Lỗi từ chối giao dịch: ' + err.message });
  }
});

// ── GET /api/admin/tickets ──
router.get('/tickets', (req, res) => {
  const db = getDb();
  const tickets = db.prepare(`
    SELECT st.*, u.name as user_name, u.email as user_email
    FROM support_tickets st LEFT JOIN users u ON st.user_id = u.id
    ORDER BY st.created_at DESC LIMIT 50
  `).all();
  res.json({ tickets });
});

// ── PUT /api/admin/tickets/:id ──
router.put('/tickets/:id', (req, res) => {
  const db = getDb();
  const { status, reply } = req.body;

  if (reply !== undefined) {
    db.prepare('UPDATE support_tickets SET admin_reply = ?, replied_at = CURRENT_TIMESTAMP, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(reply, status || null, req.params.id);
  } else {
    db.prepare('UPDATE support_tickets SET status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status || null, req.params.id);
  }

  // Send notification to user
  if (reply) {
    const ticket = db.prepare('SELECT user_id, subject FROM support_tickets WHERE id = ?').get(req.params.id);
    if (ticket) {
      db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`)
        .run(ticket.user_id, `Phản hồi ticket: ${ticket.subject}`, reply, 'info');
    }
  }

  res.json({ message: 'Đã cập nhật ticket' });
});

// ── PUT /api/admin/settings/info ──
router.put('/settings/info', (req, res) => {
  try {
    const db = getDb();
    const { email, username, name } = req.body;
    const userId = req.userId;

    if (!email) return res.status(400).json({ error: 'Email là bắt buộc' });

    // Check email uniqueness (exclude self)
    const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
    if (emailExists) return res.status(409).json({ error: 'Email đã được sử dụng bởi tài khoản khác' });

    // Check username uniqueness (exclude self)
    if (username) {
      const usernameExists = db.prepare("SELECT id FROM users WHERE username = ? AND username != '' AND id != ?").get(username, userId);
      if (usernameExists) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    }

    db.prepare('UPDATE users SET email = ?, username = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(email, username || '', name || '', userId);

    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    console.error('Settings info error:', err);
    res.status(500).json({ error: 'Lỗi cập nhật: ' + err.message });
  }
});

// ── PUT /api/admin/settings/password ──
router.put('/settings/password', (req, res) => {
  try {
    const db = getDb();
    const bcrypt = require('bcryptjs');
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newHash, userId);

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('Settings password error:', err);
    res.status(500).json({ error: 'Lỗi đổi mật khẩu: ' + err.message });
  }
});

module.exports = router;
