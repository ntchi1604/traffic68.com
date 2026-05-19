const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool } = require('../db');
const { authMiddleware, invalidateUserCache } = require('../middleware/auth');
const { agencyAdminMiddleware, ownerOnly, invalidateAgencyRoleCache } = require('../middleware/agencyAdmin');

const router = express.Router();
router.use(authMiddleware);
router.use(agencyAdminMiddleware);

const localDateStr = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

// ════════════════════════════════════════════════════════
//  OVERVIEW
// ════════════════════════════════════════════════════════
router.get('/overview', async (req, res) => {
  try {
    const pool = getPool();
    const aid = req.agencyId;
    const { fromDate, toDate } = req.query;

    let dateCondition = '';
    const dateParams = [];
    if (fromDate) { dateCondition += ' AND t.created_at >= ?'; dateParams.push(fromDate + ' 00:00:00'); }
    if (toDate) { dateCondition += ' AND t.created_at <= ?'; dateParams.push(toDate + ' 23:59:59'); }

    const [
      [buyers], [campaigns], [runningCamp],
      [totalDeposit], [pendingDeposit], [openTickets]
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) as c FROM users WHERE agency_id = ?', [aid]),
      pool.execute('SELECT COUNT(*) as c FROM campaigns c JOIN users u ON c.user_id = u.id WHERE u.agency_id = ?', [aid]),
      pool.execute("SELECT COUNT(*) as c FROM campaigns c JOIN users u ON c.user_id = u.id WHERE u.agency_id = ? AND c.status = 'running'", [aid]),
      pool.execute(`SELECT COALESCE(SUM(t.amount), 0) as s FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.agency_id = ? AND t.type = 'deposit' AND t.status = 'completed'${dateCondition}`, [aid, ...dateParams]),
      pool.execute(`SELECT COUNT(*) as c FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.agency_id = ? AND t.type = 'deposit' AND t.status = 'pending'`, [aid]),
      pool.execute("SELECT COUNT(*) as c FROM support_tickets st JOIN users u ON st.user_id = u.id WHERE u.agency_id = ? AND st.status = 'open'", [aid]),
    ]);

    // Chart data
    let chartSql, chartParams;
    if (fromDate || toDate) {
      chartSql = `SELECT DATE(t.created_at) as date, COUNT(*) as count, COALESCE(SUM(t.amount), 0) as total
        FROM transactions t JOIN users u ON t.user_id = u.id
        WHERE u.agency_id = ?${dateCondition} GROUP BY DATE(t.created_at) ORDER BY date ASC`;
      chartParams = [aid, ...dateParams];
    } else {
      const d14 = new Date(); d14.setDate(d14.getDate() - 14);
      const from14 = d14.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' 00:00:00';
      chartSql = `SELECT DATE(t.created_at) as date, COUNT(*) as count, COALESCE(SUM(t.amount), 0) as total
        FROM transactions t JOIN users u ON t.user_id = u.id
        WHERE u.agency_id = ? AND t.created_at >= ? GROUP BY DATE(t.created_at) ORDER BY date ASC`;
      chartParams = [aid, from14];
    }
    const [rawStats] = await pool.execute(chartSql, chartParams);

    const statsMap = {};
    rawStats.forEach(r => { statsMap[r.date instanceof Date ? localDateStr(r.date) : r.date] = r; });
    const dailyStats = [];
    const startStr = fromDate || (rawStats.length ? (rawStats[0].date instanceof Date ? localDateStr(rawStats[0].date) : rawStats[0].date) : localDateStr());
    const endStr = toDate || localDateStr();
    const start = new Date(startStr + 'T00:00:00+07:00');
    const end = new Date(endStr + 'T00:00:00+07:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = localDateStr(d);
      dailyStats.push(statsMap[key] || { date: key, count: 0, total: 0 });
    }

    res.json({
      overview: {
        totalBuyers: buyers[0].c,
        totalCampaigns: campaigns[0].c,
        runningCampaigns: runningCamp[0].c,
        totalDeposits: totalDeposit[0].s,
        pendingDeposits: pendingDeposit[0].c,
        openTickets: openTickets[0].c,
      },
      dailyStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  BUYERS
// ════════════════════════════════════════════════════════
router.get('/buyers', async (req, res) => {
  try {
    const pool = getPool();
    const aid = req.agencyId;
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT u.id, u.email, u.name, u.username, u.phone, u.status, u.agency_role, u.created_at,
      COALESCE(wm.balance, 0) as main_balance
      FROM users u
      LEFT JOIN wallets wm ON wm.user_id = u.id AND wm.type = 'main'
      WHERE u.agency_id = ?`;
    let countSql = `SELECT COUNT(*) as total FROM users u WHERE u.agency_id = ?`;
    const params = [aid];
    const countParams = [aid];

    if (search) {
      const cond = ' AND (u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
      sql += cond; countSql += cond;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.execute(countSql, countParams);
    sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const [users] = await pool.execute(sql, params);

    if (users.length === 0) return res.json({ users: [], total, page: Number(page), limit: Number(limit) });

    const uids = users.map(u => u.id);
    const ph = uids.map(() => '?').join(',');
    const [[campRows], [depRows]] = await Promise.all([
      pool.execute(`SELECT user_id, COUNT(*) as v FROM campaigns WHERE user_id IN (${ph}) GROUP BY user_id`, uids),
      pool.execute(`SELECT user_id, COALESCE(SUM(amount),0) as v FROM transactions WHERE user_id IN (${ph}) AND wallet_type='main' AND type='deposit' AND status='completed' GROUP BY user_id`, uids),
    ]);

    const toMap = (rows) => Object.fromEntries(rows.map(r => [r.user_id, Number(r.v)]));
    const campMap = toMap(campRows);
    const depMap = toMap(depRows);

    const enriched = users.map(u => ({
      ...u,
      campaign_count: campMap[u.id] || 0,
      total_deposit: depMap[u.id] || 0,
    }));

    res.json({ users: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/buyers/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { status, name } = req.body;
    const [check] = await pool.execute('SELECT id FROM users WHERE id = ? AND agency_id = ?', [req.params.id, req.agencyId]);
    if (!check.length) return res.status(404).json({ error: 'Buyer không thuộc đại lý này' });

    await pool.execute(
      'UPDATE users SET status = COALESCE(?, status), name = COALESCE(?, name) WHERE id = ?',
      [status || null, name || null, req.params.id]
    );
    if (status) invalidateUserCache(Number(req.params.id));
    res.json({ ok: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/buyers/:id/balance', async (req, res) => {
  try {
    const pool = getPool();
    const { amount, type, note } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
    if (!['add', 'subtract'].includes(type)) return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' });

    const [check] = await pool.execute('SELECT id FROM users WHERE id = ? AND agency_id = ?', [req.params.id, req.agencyId]);
    if (!check.length) return res.status(404).json({ error: 'Buyer không thuộc đại lý này' });

    const [wallets] = await pool.execute("SELECT id, balance FROM wallets WHERE user_id = ? AND type = 'main'", [req.params.id]);
    if (!wallets.length) return res.status(404).json({ error: 'Không tìm thấy ví' });
    const wallet = wallets[0];

    if (type === 'subtract' && wallet.balance < numAmount) {
      return res.status(400).json({ error: `Số dư ví không đủ (hiện có: ${Number(wallet.balance).toLocaleString('vi-VN')} đ)` });
    }

    const newBalance = type === 'add' ? Number(wallet.balance) + numAmount : Number(wallet.balance) - numAmount;
    await pool.execute('UPDATE wallets SET balance = ? WHERE id = ?', [newBalance, wallet.id]);

    const refCode = 'AGC-' + Date.now();
    const txType = type === 'add' ? 'deposit' : 'withdraw';
    const txNote = note || (type === 'add' ? 'Đại lý cộng tiền' : 'Đại lý trừ tiền');
    await pool.execute(
      'INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, 'main', txType, 'agency_admin', numAmount, 'completed', refCode, txNote]
    );

    res.json({ ok: true, message: `Đã ${type === 'add' ? 'cộng' : 'trừ'} ${numAmount.toLocaleString('vi-VN')} đ`, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/buyers/:id/change-password', async (req, res) => {
  try {
    const pool = getPool();
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });

    const [check] = await pool.execute('SELECT id, name FROM users WHERE id = ? AND agency_id = ?', [req.params.id, req.agencyId]);
    if (!check.length) return res.status(404).json({ error: 'Buyer không thuộc đại lý này' });

    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?', [hash, req.params.id]);
    invalidateUserCache(Number(req.params.id));
    res.json({ ok: true, message: `Đã đổi mật khẩu cho ${check[0].name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Owner only: set/remove sub-admin
router.put('/buyers/:id/role', ownerOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { agency_role } = req.body;
    if (agency_role && !['admin'].includes(agency_role)) return res.status(400).json({ error: 'Role không hợp lệ' });

    const [check] = await pool.execute('SELECT id, agency_role FROM users WHERE id = ? AND agency_id = ?', [req.params.id, req.agencyId]);
    if (!check.length) return res.status(404).json({ error: 'Buyer không thuộc đại lý này' });
    if (check[0].agency_role === 'owner') return res.status(400).json({ error: 'Không thể thay đổi quyền chủ đại lý' });

    await pool.execute('UPDATE users SET agency_role = ? WHERE id = ?', [agency_role || null, req.params.id]);
    invalidateAgencyRoleCache(Number(req.params.id));
    res.json({ ok: true, message: agency_role ? 'Đã cấp quyền admin' : 'Đã gỡ quyền admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  CAMPAIGNS
// ════════════════════════════════════════════════════════
router.get('/campaigns', async (req, res) => {
  try {
    const pool = getPool();
    const aid = req.agencyId;
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const todayVn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const todayStart = todayVn + ' 00:00:00';
    const todayEnd = todayVn + ' 23:59:59';

    let sql = `SELECT c.*, u.name as user_name, u.email as user_email,
      COALESCE(vt.views_today, 0) as views_today
      FROM campaigns c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN (
        SELECT campaign_id, COUNT(*) as views_today
        FROM vuot_link_tasks
        WHERE status = 'completed' AND bot_detected = 0
          AND completed_at >= ? AND completed_at <= ?
        GROUP BY campaign_id
      ) vt ON vt.campaign_id = c.id
      WHERE u.agency_id = ?`;
    const params = [todayStart, todayEnd, aid];

    let countSql = `SELECT COUNT(*) as total FROM campaigns c JOIN users u ON c.user_id = u.id WHERE u.agency_id = ?`;
    const countParams = [aid];

    if (search) {
      sql += ' AND (c.name LIKE ? OR c.url LIKE ? OR u.email LIKE ? OR c.keyword LIKE ?)';
      countSql += ' AND (c.name LIKE ? OR c.url LIKE ? OR u.email LIKE ? OR c.keyword LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') {
      sql += ' AND c.status = ?'; countSql += ' AND c.status = ?';
      params.push(status); countParams.push(status);
    }

    const [[{ total }]] = await pool.execute(countSql, countParams);
    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const [campaigns] = await pool.execute(sql, params);

    res.json({ campaigns, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaigns/:id/status', async (req, res) => {
  try {
    const pool = getPool();
    const { status } = req.body;
    if (!['running', 'paused', 'completed'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

    const [check] = await pool.execute(
      'SELECT c.id FROM campaigns c JOIN users u ON c.user_id = u.id WHERE c.id = ? AND u.agency_id = ?',
      [req.params.id, req.agencyId]
    );
    if (!check.length) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

    await pool.execute('UPDATE campaigns SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true, message: 'Cập nhật trạng thái thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/campaigns/:id/keyword-stats', async (req, res) => {
  try {
    const pool = getPool();
    const [check] = await pool.execute(
      'SELECT c.id FROM campaigns c JOIN users u ON c.user_id = u.id WHERE c.id = ? AND u.agency_id = ?',
      [req.params.id, req.agencyId]
    );
    if (!check.length) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

    const [stats] = await pool.execute(
      `SELECT keyword, COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' AND bot_detected = 0 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN bot_detected = 1 THEN 1 ELSE 0 END) as bot
      FROM vuot_link_tasks WHERE campaign_id = ? GROUP BY keyword`,
      [req.params.id]
    );
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════════
router.get('/transactions', async (req, res) => {
  try {
    const pool = getPool();
    const aid = req.agencyId;
    const { type, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT t.*, u.email, u.username, u.name as user_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE u.agency_id = ?`;
    let countSql = `SELECT COUNT(*) as total FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.agency_id = ?`;
    const params = [aid];
    const countParams = [aid];

    if (type && type !== 'all') {
      sql += ' AND t.type = ?'; countSql += ' AND t.type = ?';
      params.push(type); countParams.push(type);
    }
    if (status && status !== 'all') {
      sql += ' AND t.status = ?'; countSql += ' AND t.status = ?';
      params.push(status); countParams.push(status);
    }

    const [[{ total }]] = await pool.execute(countSql, countParams);
    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const [transactions] = await pool.execute(sql, params);

    res.json({ transactions, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/transactions/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const [txs] = await pool.execute(
      `SELECT t.* FROM transactions t JOIN users u ON t.user_id = u.id
       WHERE t.id = ? AND u.agency_id = ? AND t.type = 'deposit' AND t.status = 'pending'`,
      [req.params.id, req.agencyId]
    );
    if (!txs.length) return res.status(404).json({ error: 'Giao dịch không tồn tại hoặc đã được xử lý' });

    const tx = txs[0];
    await pool.execute("UPDATE transactions SET status = 'completed' WHERE id = ?", [tx.id]);
    await pool.execute(
      "UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?",
      [tx.amount, tx.user_id, tx.wallet_type || 'main']
    );

    res.json({ ok: true, message: 'Đã duyệt thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/transactions/:id/reject', async (req, res) => {
  try {
    const pool = getPool();
    const { reason } = req.body;
    const [txs] = await pool.execute(
      `SELECT t.* FROM transactions t JOIN users u ON t.user_id = u.id
       WHERE t.id = ? AND u.agency_id = ? AND t.type = 'deposit' AND t.status = 'pending'`,
      [req.params.id, req.agencyId]
    );
    if (!txs.length) return res.status(404).json({ error: 'Giao dịch không tồn tại hoặc đã được xử lý' });

    await pool.execute("UPDATE transactions SET status = 'failed', note = CONCAT(COALESCE(note,''), ?) WHERE id = ?",
      [reason ? ` | Lý do từ chối: ${reason}` : '', txs[0].id]);

    res.json({ ok: true, message: 'Đã từ chối giao dịch' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  TICKETS
// ════════════════════════════════════════════════════════
router.get('/tickets', async (req, res) => {
  try {
    const pool = getPool();
    const aid = req.agencyId;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT st.*, u.email, u.name as user_name
      FROM support_tickets st
      JOIN users u ON st.user_id = u.id
      WHERE u.agency_id = ?`;
    let countSql = `SELECT COUNT(*) as total FROM support_tickets st JOIN users u ON st.user_id = u.id WHERE u.agency_id = ?`;
    const params = [aid];
    const countParams = [aid];

    if (status && status !== 'all') {
      sql += ' AND st.status = ?'; countSql += ' AND st.status = ?';
      params.push(status); countParams.push(status);
    }

    const [[{ total }]] = await pool.execute(countSql, countParams);
    sql += ' ORDER BY st.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const [tickets] = await pool.execute(sql, params);

    res.json({ tickets, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tickets/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { admin_reply, status } = req.body;

    const [check] = await pool.execute(
      'SELECT st.id FROM support_tickets st JOIN users u ON st.user_id = u.id WHERE st.id = ? AND u.agency_id = ?',
      [req.params.id, req.agencyId]
    );
    if (!check.length) return res.status(404).json({ error: 'Ticket không thuộc đại lý này' });

    await pool.execute(
      'UPDATE support_tickets SET admin_reply = COALESCE(?, admin_reply), status = COALESCE(?, status) WHERE id = ?',
      [admin_reply || null, status || null, req.params.id]
    );
    res.json({ ok: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  PRICING
// ════════════════════════════════════════════════════════
router.get('/pricing', async (req, res) => {
  try {
    const pool = getPool();
    const [prices] = await pool.execute('SELECT * FROM agency_prices WHERE agency_id = ?', [req.agencyId]);
    const [defaults] = await pool.execute('SELECT * FROM pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
    res.json({ prices, defaults });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pricing', async (req, res) => {
  try {
    const { prices } = req.body;
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM agency_prices WHERE agency_id = ?', [req.agencyId]);
      for (const p of prices) {
        if (!p.traffic_type || !p.duration) continue;
        await conn.query(
          'INSERT INTO agency_prices (agency_id, traffic_type, duration, v1_price, v2_price) VALUES (?, ?, ?, ?, ?)',
          [req.agencyId, p.traffic_type, p.duration, p.v1_price || 0, p.v2_price || 0]
        );
      }
      await conn.commit();
      res.json({ ok: true, message: 'Cập nhật bảng giá thành công' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  CONFIG (owner-only for write)
// ════════════════════════════════════════════════════════
router.get('/config', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM agencies WHERE id = ?', [req.agencyId]);
    if (!rows.length) return res.status(404).json({ error: 'Agency không tồn tại' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', ownerOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { name, logo_url, primary_color, bank_name, bank_account_name, bank_account_number, contact_email, contact_phone } = req.body;
    await pool.execute(
      `UPDATE agencies SET name=COALESCE(?,name), logo_url=COALESCE(?,logo_url), primary_color=COALESCE(?,primary_color),
       bank_name=COALESCE(?,bank_name), bank_account_name=COALESCE(?,bank_account_name), bank_account_number=COALESCE(?,bank_account_number),
       contact_email=COALESCE(?,contact_email), contact_phone=COALESCE(?,contact_phone) WHERE id=?`,
      [name||null, logo_url||null, primary_color||null, bank_name||null, bank_account_name||null, bank_account_number||null, contact_email||null, contact_phone||null, req.agencyId]
    );
    res.json({ ok: true, message: 'Cập nhật cấu hình thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  SETTINGS (own profile + password)
// ════════════════════════════════════════════════════════
router.put('/settings/password', async (req, res) => {
  try {
    const pool = getPool();
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });

    const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
    if (!users.length) return res.status(404).json({ error: 'Không tìm thấy user' });

    if (currentPassword) {
      const valid = bcrypt.compareSync(currentPassword, users[0].password_hash);
      if (!valid) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?', [hash, req.userId]);
    invalidateUserCache(req.userId);
    res.json({ ok: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
