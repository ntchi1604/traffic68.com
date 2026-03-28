const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');


const localDateStr = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });


let _web3pay = null;
function getWeb3Pay() {
  if (!_web3pay) {
    try { _web3pay = require('../lib/web3pay'); }
    catch (e) { throw new Error('Web3 module chưa sẵn sàng. Chạy: cd server && npm install ethers@6'); }
  }
  return _web3pay;
}

const router = express.Router();
router.use(authMiddleware);


router.use(async (req, res, next) => {
  const pool = getPool();
  const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.userId]);
  if (!users[0] || users[0].role !== 'admin') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập trang admin' });
  }
  next();
});


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

  
  let chartSql, chartParams;
  if (fromDate || toDate) {
    chartSql = `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM transactions WHERE 1=1${dateCondition} GROUP BY DATE(created_at) ORDER BY date ASC`;
    chartParams = dateParams;
  } else {
    chartSql = `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM transactions WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) GROUP BY DATE(created_at) ORDER BY date ASC`;
    chartParams = [];
  }
  const [rawStats] = await pool.execute(chartSql, chartParams);

  const statsMap = {};
  rawStats.forEach(r => { statsMap[r.date instanceof Date ? localDateStr(r.date) : r.date] = r; });

  const dailyStats = [];
  const startStr = fromDate || (rawStats.length ? (rawStats[0].date instanceof Date ? localDateStr(rawStats[0].date) : rawStats[0].date) : localDateStr());
  const endStr = toDate || localDateStr();
  const start = new Date(startStr + 'T00:00:00+07:00');
  const end   = new Date(endStr   + 'T00:00:00+07:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = localDateStr(d);
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
    if (req.query.include_admin === '1') {
      sql += ' AND (u.service_type = ? OR u.role = ?)'; countSql += ' AND (u.service_type = ? OR u.role = ?)';
      params.push(service_type, 'admin'); countParams.push(service_type, 'admin');
    } else {
      sql += ' AND u.service_type = ?'; countSql += ' AND u.service_type = ?';
      params.push(service_type); countParams.push(service_type);
    }
  }

  const [totalRows] = await pool.execute(countSql, countParams);
  sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const [users] = await pool.execute(sql, params);
  res.json({ users, total: totalRows[0].total, page: Number(page), limit: Number(limit) });
});


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


router.delete('/users/:id', async (req, res) => {
  const pool = getPool();
  const uid = req.params.id;
  if (Number(uid) === req.userId) return res.status(400).json({ error: 'Không thể xóa chính mình' });

  try {
    
    const [wlRows] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
    const wlIds = wlRows.map(r => r.id);

    
    if (wlIds.length > 0) {
      const ph = wlIds.map(() => '?').join(',');
      await pool.execute(`DELETE FROM vuot_link_tasks WHERE worker_link_id IN (${ph})`, wlIds);
    }
    await pool.execute('DELETE FROM vuot_link_tasks WHERE worker_id = ?', [uid]);

    
    await pool.execute('DELETE FROM worker_links WHERE worker_id = ?', [uid]);

    
    const [campRows] = await pool.execute('SELECT id FROM campaigns WHERE user_id = ?', [uid]);
    if (campRows.length > 0) {
      const cph = campRows.map(() => '?').join(',');
      const cids = campRows.map(r => r.id);
      await pool.execute(`DELETE FROM traffic_logs WHERE campaign_id IN (${cph})`, cids);
      await pool.execute(`DELETE FROM campaigns WHERE user_id = ?`, [uid]);
    }

    
    await pool.execute('DELETE FROM transactions WHERE user_id = ?', [uid]);
    await pool.execute('DELETE FROM wallets WHERE user_id = ?', [uid]);
    await pool.execute('DELETE FROM widgets WHERE user_id = ?', [uid]);
    await pool.execute('DELETE FROM api_keys WHERE user_id = ?', [uid]);
    await pool.execute('DELETE FROM notifications WHERE user_id = ?', [uid]);
    await pool.execute('DELETE FROM support_tickets WHERE user_id = ?', [uid]);

    
    await pool.execute('DELETE FROM users WHERE id = ?', [uid]);

    res.json({ message: 'Đã xóa người dùng và toàn bộ dữ liệu' });
  } catch (err) {
    console.error('[Admin] Delete user error:', err);
    res.status(500).json({ error: err.message });
  }
});


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

  const notifRole = wType === 'earning' ? 'worker' : 'buyer';
  await pool.execute(`INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`, [
    req.params.id,
    type === 'add' ? 'Ví được cộng tiền' : 'Ví bị trừ tiền',
    `${type === 'add' ? '+' : '-'}${numAmount.toLocaleString('vi-VN')} đ vào ví ${wType === 'main' ? 'Traffic' : wType === 'earning' ? 'Thu nhập' : 'Hoa hồng'}. Lý do: ${txNote}`,
    type === 'add' ? 'success' : 'warning',
    notifRole
  ]);

  res.json({ message: `Đã ${type === 'add' ? 'cộng' : 'trừ'} ${numAmount.toLocaleString('vi-VN')} đ`, newBalance, refCode });
});


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


router.put('/campaigns/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { status, name, url, url2, keyword, dailyViews, viewByHour, image1_url, image2_url, totalViews, budget, cpc, trafficType, version, timeOnSite, targetPage } = req.body;
    const n = (v) => v === undefined ? null : v;

    
    if (status && Object.keys(req.body).length === 1) {
      await pool.execute('UPDATE campaigns SET status = ? WHERE id = ?', [status, req.params.id]);
      return res.json({ message: 'Đã cập nhật trạng thái' });
    }

    await pool.execute(
      `UPDATE campaigns SET name=COALESCE(?,name), url=COALESCE(?,url), url2=COALESCE(?,url2), keyword=COALESCE(?,keyword),
       daily_views=COALESCE(?,daily_views), view_by_hour=COALESCE(?,view_by_hour), image1_url=COALESCE(?,image1_url), image2_url=COALESCE(?,image2_url),
       total_views=COALESCE(?,total_views), budget=COALESCE(?,budget), cpc=COALESCE(?,cpc),
       traffic_type=COALESCE(?,traffic_type), version=COALESCE(?,version), time_on_site=COALESCE(?,time_on_site),
       target_page=COALESCE(?,target_page), status=COALESCE(?,status) WHERE id = ?`,
      [n(name), n(url), n(url2), n(keyword), n(dailyViews), n(viewByHour), n(image1_url), n(image2_url),
      n(totalViews), n(budget), n(cpc), n(trafficType), n(version), n(timeOnSite), n(targetPage), n(status), req.params.id]
    );
    const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cập nhật thành công', campaign: campaigns[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/transactions', async (req, res) => {
  const pool = getPool();
  const { type, status, fromDate, toDate, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let baseWhere = `WHERE 1=1`;
  const params = [];
  const filterParams = [];
  let filterCondition = '';
  if (type && type !== 'all') { baseWhere += ' AND t.type = ?'; params.push(type); filterCondition += ' AND t.type = ?'; filterParams.push(type); }
  if (status && status !== 'all') { baseWhere += ' AND t.status = ?'; params.push(status); filterCondition += ' AND t.status = ?'; filterParams.push(status); }
  if (fromDate) { baseWhere += ' AND DATE(t.created_at) >= ?'; params.push(fromDate); filterCondition += ' AND DATE(t.created_at) >= ?'; filterParams.push(fromDate); }
  if (toDate) { baseWhere += ' AND DATE(t.created_at) <= ?'; params.push(toDate); filterCondition += ' AND DATE(t.created_at) <= ?'; filterParams.push(toDate); }

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as c FROM transactions t ${baseWhere}`, params
  );
  const total = countRows[0].c;

  const sql = `SELECT t.*, u.name as user_name, u.email as user_email FROM transactions t LEFT JOIN users u ON t.user_id = u.id ${baseWhere} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
  const [transactions] = await pool.execute(sql, [...params, Number(limit), offset]);

  
  const [depRows] = await pool.execute(
    `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t WHERE t.status = 'completed' AND t.type IN ('deposit','earning','commission','refund')${filterCondition}`,
    filterParams
  );
  const [wdRows] = await pool.execute(
    `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t WHERE t.status = 'completed' AND t.type IN ('withdraw','campaign')${filterCondition}`,
    filterParams
  );

  res.json({ transactions, total, totalDeposit: Number(depRows[0].total), totalWithdraw: Number(wdRows[0].total) });
});



router.put('/transactions/:id/approve', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [txs] = await conn.execute('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [req.params.id]);
    if (txs.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
    }
    const tx = txs[0];
    if (tx.status !== 'pending') {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Giao dịch này đã được xử lý' });
    }

    
    await conn.execute("UPDATE transactions SET status = 'completed' WHERE id = ?", [req.params.id]);
    await conn.execute(
      'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
      [tx.amount, tx.user_id, tx.wallet_type || 'main']
    );

    const fmt = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id, 'Nạp tiền thành công ✓', `Đơn nạp ${fmt} VND (Mã: ${tx.ref_code}) đã được admin duyệt. Tiền đã vào ví!`, 'success', 'buyer']
    );

    
    if ((tx.wallet_type || 'main') === 'main' && tx.type === 'deposit') {
      
      const [depositorRows] = await conn.execute(
        'SELECT referred_by FROM users WHERE id = ?',
        [tx.user_id]
      );
      const referrerId = depositorRows[0]?.referred_by;

      if (referrerId) {
        
        const [settingRows] = await conn.execute(
          "SELECT setting_value FROM site_settings WHERE setting_key = 'referral_commission_buyer'",
          []
        );
        const commPct = Number(settingRows[0]?.setting_value || 0);

        if (commPct > 0) {
          const commAmount = Math.floor(tx.amount * commPct / 100);

          if (commAmount > 0) {
            
            const [wRes] = await conn.execute(
              'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = "commission"',
              [commAmount, referrerId]
            );
            if (wRes.affectedRows === 0) {
              await conn.execute(
                'INSERT INTO wallets (user_id, type, balance) VALUES (?, "commission", ?)',
                [referrerId, commAmount]
              );
            }

            const refCode = `COMM-BUYER-${Date.now()}`;
            await conn.execute(
              `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
               VALUES (?, 'commission', 'commission', 'referral', ?, 'completed', ?, ?)`,
              [referrerId, commAmount, refCode, `Hoa hồng ${commPct}% từ buyer nạp ${fmt} VND`]
            );

            const fmtComm = new Intl.NumberFormat('vi-VN').format(commAmount);
            await conn.execute(
              `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
              [referrerId, 'Hoa hồng giới thiệu 🎉', `Bạn nhận được ${fmtComm} VND hoa hồng (${commPct}%) từ người bạn giới thiệu vừa nạp tiền.`, 'success', 'buyer']
            );
          }
        }
      }
    }

    await conn.commit();
    conn.release();
    res.json({ message: `Đã duyệt đơn nạp ${fmt} VND` });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Lỗi duyệt giao dịch: ' + err.message });
  }
});



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
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id, 'Đơn nạp tiền bị từ chối', `Đơn nạp ${fmt} VND (Mã: ${tx.ref_code}) đã bị từ chối. Lý do: ${reason || 'Không hợp lệ'}`, 'error', 'buyer']
    );
    res.json({ message: 'Đã từ chối đơn nạp' });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'Lỗi từ chối giao dịch: ' + err.message });
  }
});


router.get('/tickets', async (req, res) => {
  const pool = getPool();
  const [tickets] = await pool.execute(`SELECT st.*, u.name as user_name, u.email as user_email FROM support_tickets st LEFT JOIN users u ON st.user_id = u.id ORDER BY st.created_at DESC LIMIT 50`);
  res.json({ tickets });
});


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
      await pool.execute(`INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`, [tickets[0].user_id, `Phản hồi ticket: ${tickets[0].subject}`, reply, 'info', 'all']);
    }
  }
  res.json({ message: 'Đã cập nhật ticket' });
});


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


router.get('/pricing', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
    res.json({ tiers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


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


router.get('/worker-pricing', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM worker_pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
    res.json({ tiers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put('/worker-pricing/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { v1_price, v2_price } = req.body;
    await pool.execute(
      'UPDATE worker_pricing_tiers SET v1_price=?, v2_price=? WHERE id=?',
      [v1_price, v2_price, req.params.id]
    );
    res.json({ message: 'Cập nhật giá worker thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


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


router.put('/settings/site', async (req, res) => {
  try {
    const pool = getPool();
    const { settings } = req.body;
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




router.get('/security/init', async (req, res) => {
  try {
    const pool = getPool();
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
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/security/user/:uid/ban', async (req, res) => {
  try {
    const pool = getPool();
    const { action } = req.body; 
    const status = action === 'ban' ? 'banned' : 'active';
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, req.params.uid]);
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/security/users', async (req, res) => {
  try {
    const pool = getPool();
    const { search, page = 1, limit = 20, from, to, sort = 'ok' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];

    let searchWhere = '';
    if (search) {
      searchWhere = ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    
    let timeWhere = '';
    const timeParams = [];
    if (from) { timeWhere += ` AND vt.created_at >= ?`; timeParams.push(from); }
    if (to) { timeWhere += ` AND vt.created_at <= ?`; timeParams.push(to + ' 23:59:59'); }

    
    const [cnt] = await pool.execute(
      `SELECT COUNT(*) as total FROM users u WHERE 1=1${searchWhere}`, params
    );

    
    const sortMap = { ok: 'ok', blocked: 'blocked', earned: 'earned', total: 'total', last_at: 'last_at' };
    const orderCol = sortMap[sort] || 'ok';

    
    const [rows] = await pool.execute(
      `SELECT
         u.id as worker_id,
         u.name,
         u.email,
         u.status,
         u.avatar_url,
         COUNT(DISTINCT vt.id) as total,
         COALESCE(SUM(CASE WHEN vt.status = 'completed' THEN 1 ELSE 0 END), 0) as ok,
         COALESCE(SUM(CASE WHEN vt.bot_detected = 1 THEN 1 ELSE 0 END), 0) as blocked,
         COALESCE(SUM(CASE WHEN vt.status = 'expired' THEN 1 ELSE 0 END), 0) as expired,
         COALESCE(SUM(CASE WHEN vt.status IN ('pending','step1','step2','step3') THEN 1 ELSE 0 END), 0) as pending,
         COALESCE(SUM(vt.earning), 0) as earned,
         MAX(vt.created_at) as last_at,
         GROUP_CONCAT(DISTINCT vt.ip_address SEPARATOR ',') as ips
       FROM users u
       LEFT JOIN vuot_link_tasks vt ON (vt.worker_id = u.id OR vt.worker_link_id IN (SELECT wl.id FROM worker_links wl WHERE wl.worker_id = u.id))${timeWhere}
       WHERE 1=1${searchWhere}
       GROUP BY u.id
       ORDER BY ${orderCol} DESC, last_at DESC
       LIMIT ? OFFSET ?`,
      [...timeParams, ...params, Number(limit), offset]
    );

    
    const ids = rows.map(r => r.worker_id).filter(Boolean);
    const secMap = {};
    if (ids.length > 0) {
      
      for (const uid of ids) {
        try {
          const [ipRows] = await pool.execute(
            `SELECT DISTINCT ip_address FROM vuot_link_tasks
             WHERE worker_id = ? OR worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?)`,
            [uid, uid]
          );
          const ips = ipRows.map(r => r.ip_address).filter(Boolean);
          if (ips.length > 0) {
            const ph = ips.map(() => '?').join(',');
            const [cnt2] = await pool.execute(
              `SELECT COUNT(*) as cnt FROM security_logs WHERE ip_address IN (${ph}) AND reason != 'completed'`, ips
            );
            if (cnt2[0].cnt > 0) secMap[uid] = Number(cnt2[0].cnt);
          }
        } catch { }
      }
    }

    res.json({
      users: rows.map(r => ({
        id: r.worker_id,
        name: r.name,
        email: r.email,
        status: r.status,
        avatar_url: r.avatar_url,
        total: Number(r.total),
        ok: Number(r.ok),
        blocked: Number(r.blocked),
        expired: Number(r.expired),
        pending: Number(r.pending),
        earned: Number(r.earned),
        last_at: r.last_at,
        ips: (r.ips || '').split(',').filter(Boolean).slice(0, 5),
        events: secMap[r.worker_id] || 0,
      })),
      total: cnt[0].total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error('[AntiCheat] users error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/security/user/:uid/tasks', async (req, res) => {
  try {
    const pool = getPool();
    const uid = req.params.uid;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [cnt] = await pool.execute(
      `SELECT COUNT(*) as total FROM vuot_link_tasks
       WHERE worker_id = ? OR worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?)`, [uid, uid]
    );

    const [rows] = await pool.execute(
      `SELECT vt.id, vt.campaign_id, vt.status, vt.ip_address, vt.user_agent,
              vt.visitor_id, vt.bot_detected, vt.earning, vt.time_on_site,
              vt.security_detail, vt.created_at, vt.completed_at,
              vt.keyword, vt.target_url, vt.worker_link_id,
              c.name as campaign_name,
              wl.slug as gateway_slug
       FROM vuot_link_tasks vt
       LEFT JOIN campaigns c ON c.id = vt.campaign_id
       LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
       WHERE vt.worker_id = ? OR vt.worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?)
       ORDER BY vt.created_at DESC
       LIMIT ? OFFSET ?`,
      [uid, uid, Number(limit), offset]
    );

    res.json({
      tasks: rows.map(r => {
        let sd = {};
        try { sd = JSON.parse(r.security_detail || '{}'); } catch { }
        return { ...r, security_detail: sd };
      }),
      total: cnt[0].total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error('[AntiCheat] user tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/security/user/:uid/ips', async (req, res) => {
  try {
    const pool = getPool();
    const uid = req.params.uid;

    
    const [ipStats] = await pool.execute(
      `SELECT
         ip_address,
         COUNT(*) as total_tasks,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN bot_detected = 1 THEN 1 ELSE 0 END) as bots,
         MAX(created_at) as last_seen
       FROM vuot_link_tasks
       WHERE ip_address IS NOT NULL AND ip_address != ''
         AND (worker_id = ? OR worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?))
       GROUP BY ip_address
       ORDER BY completed DESC, total_tasks DESC`,
      [uid, uid]
    );

    if (!ipStats.length) return res.json({ ips: [] });

    
    const ipList = ipStats.map(r => r.ip_address);
    const ph = ipList.map(() => '?').join(',');
    const [sharedRows] = await pool.execute(
      `SELECT vt.ip_address,
              COUNT(DISTINCT COALESCE(vt.worker_id, wl.worker_id)) as worker_count,
              GROUP_CONCAT(DISTINCT COALESCE(u.name, u.email) ORDER BY u.name SEPARATOR ', ') as worker_names
       FROM vuot_link_tasks vt
       LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
       LEFT JOIN users u ON u.id = COALESCE(vt.worker_id, wl.worker_id)
       WHERE vt.ip_address IN (${ph})
         AND COALESCE(vt.worker_id, wl.worker_id) != ?
         AND COALESCE(vt.worker_id, wl.worker_id) IS NOT NULL
       GROUP BY vt.ip_address`,
      [...ipList, uid]
    );

    const sharedMap = {};
    sharedRows.forEach(r => {
      sharedMap[r.ip_address] = {
        worker_count: Number(r.worker_count),
        worker_names: r.worker_names || '',
      };
    });

    const ips = ipStats.map(r => ({
      ip: r.ip_address,
      total: Number(r.total_tasks),
      completed: Number(r.completed),
      bots: Number(r.bots),
      last_seen: r.last_seen,
      shared: sharedMap[r.ip_address] || null,
    }));

    res.json({ ips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get('/security/user/:uid/events', async (req, res) => {
  try {
    const pool = getPool();
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [ipRows] = await pool.execute(
      `SELECT DISTINCT ip_address FROM vuot_link_tasks
       WHERE worker_id = ? OR worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?)`,
      [req.params.uid, req.params.uid]
    );
    const ips = ipRows.map(r => r.ip_address).filter(Boolean);
    if (!ips.length) return res.json({ events: [], total: 0, page: Number(page), limit: Number(limit) });

    const ph = ips.map(() => '?').join(',');
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM security_logs WHERE ip_address IN (${ph}) AND reason != 'completed'`, ips
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT id, source, reason, ip_address, user_agent, visitor_id, details, created_at
       FROM security_logs
       WHERE ip_address IN (${ph}) AND reason != 'completed'
       ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...ips, Number(limit), offset]
    );
    res.json({ events: rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('[AntiCheat] user events error:', err);
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




router.delete('/security/clear-all', async (req, res) => {
  try {
    const pool = getPool();
    const [r1] = await pool.execute(`DELETE FROM security_logs`);
    const [r2] = await pool.execute(`UPDATE vuot_link_tasks SET security_detail = NULL, bot_detected = 0 WHERE bot_detected = 1 OR security_detail IS NOT NULL`);
    res.json({
      message: 'Đã xóa toàn bộ dữ liệu anti-cheat',
      deletedLogs: r1.affectedRows,
      resetTasks: r2.affectedRows,
    });
  } catch (e) {
    console.error('[Admin] clear-all error:', e);
    res.status(500).json({ error: e.message });
  }
});


router.get('/security/ip/:ip', async (req, res) => {

  try {
    const pool = getPool();
    const ip = req.params.ip;

    
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

    
    const [dailyBreakdown] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as tasks,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM vuot_link_tasks WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at) ORDER BY date DESC`,
      [ip]
    );

    
    const [workers] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.status, SUM(x.cnt) as task_count
       FROM (
         SELECT worker_id as uid, COUNT(*) as cnt
         FROM vuot_link_tasks
         WHERE ip_address = ? AND worker_id IS NOT NULL
         GROUP BY worker_id
         UNION ALL
         SELECT wl.worker_id as uid, COUNT(*) as cnt
         FROM vuot_link_tasks t
         JOIN worker_links wl ON wl.id = t.worker_link_id
         WHERE t.ip_address = ? AND t.worker_link_id IS NOT NULL
         GROUP BY wl.worker_id
       ) x
       JOIN users u ON u.id = x.uid
       GROUP BY u.id
       ORDER BY task_count DESC LIMIT 20`,
      [ip, ip]
    );


    
    const [secEvents] = await pool.execute(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN reason IN ('creep_detected','automation_probes','mouse_bot','bot_ua','ip_rate_limit','bot_behavior') THEN 1 ELSE 0 END) as blocked,
       SUM(CASE WHEN reason = 'suspicious' THEN 1 ELSE 0 END) as suspicious
       FROM security_logs WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [ip]
    );

    
    const [allTime] = await pool.execute(
      `SELECT COUNT(*) as total, MIN(created_at) as first_seen FROM vuot_link_tasks WHERE ip_address = ?`,
      [ip]
    );

    
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

    
    const stats = taskStats[0];
    const sec = secEvents[0];
    let riskScore = 0;
    const risks = [];

    
    if (stats.unique_workers > 3) {
      riskScore += 25;
      risks.push({ type: 'multi_worker', label: `${stats.unique_workers} worker dùng chung IP`, severity: 'high' });
    } else if (stats.unique_workers > 1) {
      riskScore += 10;
      risks.push({ type: 'multi_worker', label: `${stats.unique_workers} worker dùng chung IP`, severity: 'medium' });
    }

    
    if (stats.total > 50) {
      riskScore += 20;
      risks.push({ type: 'high_volume', label: `${stats.total} tasks trong 7 ngày`, severity: 'high' });
    } else if (stats.total > 20) {
      riskScore += 10;
      risks.push({ type: 'high_volume', label: `${stats.total} tasks trong 7 ngày`, severity: 'medium' });
    }

    
    if (sec.blocked > 0) {
      riskScore += 30;
      risks.push({ type: 'blocked', label: `${sec.blocked} lần bị chặn`, severity: 'high' });
    }
    if (sec.suspicious > 3) {
      riskScore += 15;
      risks.push({ type: 'suspicious', label: `${sec.suspicious} sự kiện đáng ngờ`, severity: 'medium' });
    }

    
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
        botDetected: sec.blocked || 0,
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



router.get('/worker-tasks', async (req, res) => {
  try {
    const pool = getPool();

    
    await pool.execute(
      `UPDATE vuot_link_tasks SET status = 'expired'
       WHERE status IN ('pending','step1','step2','step3')
       AND expires_at IS NOT NULL AND expires_at < NOW()`
    );
    const { page = 1, limit = 30, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = '1=1';
    const params = [];
    if (status && status !== 'all') { where += ' AND t.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countR] = await pool.execute(
      `SELECT COUNT(*) as c FROM vuot_link_tasks t
       LEFT JOIN users u ON t.worker_id = u.id
       LEFT JOIN worker_links wl ON t.worker_link_id = wl.id
       LEFT JOIN users u2 ON wl.worker_id = u2.id
       LEFT JOIN campaigns c ON t.campaign_id = c.id
       WHERE ${where}`, params);
    const [tasks] = await pool.execute(
      `SELECT t.id, t.keyword, t.status, t.earning, t.completed_at, t.created_at,
       c.name as campaign_name, c.url as campaign_url,
       COALESCE(u.name, u2.name) as worker_name,
       COALESCE(u.email, u2.email) as worker_email
       FROM vuot_link_tasks t
       LEFT JOIN campaigns c ON t.campaign_id = c.id
       LEFT JOIN users u ON t.worker_id = u.id
       LEFT JOIN worker_links wl ON t.worker_link_id = wl.id
       LEFT JOIN users u2 ON wl.worker_id = u2.id
       WHERE ${where}
       ORDER BY t.created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
      params
    );

    res.json({ tasks, total: countR[0].c, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/worker-withdrawals', async (req, res) => {
  try {
    const pool = getPool();
    const { status, page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = "t.type = 'withdraw' AND t.wallet_type = 'earning'";
    const params = [];
    if (status && status !== 'all') { where += ' AND t.status = ?'; params.push(status); }

    const [countR] = await pool.execute(
      `SELECT COUNT(*) as c FROM transactions t WHERE ${where}`, params
    );
    const [rows] = await pool.execute(
      `SELECT t.*, u.name as user_name, u.email as user_email
       FROM transactions t LEFT JOIN users u ON t.user_id = u.id
       WHERE ${where} ORDER BY t.created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
      params
    );
    res.json({ withdrawals: rows, total: countR[0].c, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.put('/worker-withdrawals/bulk', async (req, res) => {
  const pool = getPool();
  const { action, ids, privateKey } = req.body; 
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Hành động không hợp lệ' });
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Danh sách trống' });

  const conn = await pool.getConnection();
  
  let pk = (privateKey || '').trim();
  if (pk.length === 64 && /^[0-9a-fA-F]{64}$/.test(pk)) pk = '0x' + pk;
  
  const w3config = await getWeb3Pay().getPaymentSettings();
  const isWeb3Active = action === 'approve' && w3config.web3_enabled === 'true' && w3config.web3_auto_approve === 'true' && pk;

  const processedIds = [];
  const cryptoIdsToPay = [];

  try {
    await conn.beginTransaction();
    for (const id of ids) {
      const [txs] = await conn.execute(
        'SELECT * FROM transactions WHERE id = ? AND type = ? AND wallet_type = ? FOR UPDATE',
        [id, 'withdraw', 'earning']
      );
      if (!txs[0] || txs[0].status !== 'pending') continue;

      const tx = txs[0];
      const isCrypto = (tx.note || '').includes('[Crypto]');

      
      if (isWeb3Active && isCrypto) {
        cryptoIdsToPay.push(tx.id);
        processedIds.push(id);
        continue; 
      }

      
      const newStatus = action === 'approve' ? 'completed' : 'rejected';
      await conn.execute('UPDATE transactions SET status = ? WHERE id = ?', [newStatus, tx.id]);

      if (action === 'reject') {
        
        await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?', [tx.amount, tx.user_id, 'earning']);
      }

      
      const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [
          tx.user_id,
          action === 'approve' ? 'Rút tiền thành công' : 'Rút tiền bị từ chối',
          action === 'approve' ? `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) đã được duyệt.` : `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) bị từ chối. Số tiền đã hoàn lại ví.`,
          action === 'approve' ? 'success' : 'warning',
          'worker'
        ]
      );
      processedIds.push(id);
    }
    await conn.commit();
    conn.release();

    
    res.json({ 
      message: `Đã xử lý ${processedIds.length} yêu cầu${cryptoIdsToPay.length > 0 ? ` (${cryptoIdsToPay.length} lệnh Crypto đang chuyển ngầm)` : ''}`, 
      ids: processedIds 
    });

    
    if (cryptoIdsToPay.length > 0) {
      (async () => {
        for (const cryptoId of cryptoIdsToPay) {
          try {
            await getWeb3Pay().processAutoPayment(cryptoId, pk);
          } catch (e) {
            console.error(`[Web3 Auto-Pay Bulk] Lỗi gửi Crypto ID ${cryptoId}:`, e.message);
          }
          
          await new Promise(r => setTimeout(r, 2000));
        }
      })();
    }

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('[WorkerBulkWithdraw] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


router.put('/worker-withdrawals/:id', async (req, res) => {
  const pool = getPool();
  const { action } = req.body; 
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  try {
    
    if (action === 'approve') {
      const [txsCheck] = await pool.execute('SELECT note FROM transactions WHERE id = ?', [req.params.id]);
      if (txsCheck.length > 0 && (txsCheck[0].note || '').includes('[Crypto]')) {
        const w3config = await getWeb3Pay().getPaymentSettings();
        if (w3config.web3_enabled === 'true' && w3config.web3_auto_approve === 'true') {
          let pk = (req.body.privateKey || '').trim();
          if (pk.length === 64 && /^[0-9a-fA-F]{64}$/.test(pk)) pk = '0x' + pk;

          if (!pk) return res.status(400).json({ error: 'Bạn đang bật tự động gửi USDT, vui lòng nhập Private Key trong tab Web3 để tiếp tục.' });
          
          
          
          const result = await getWeb3Pay().processAutoPayment(Number(req.params.id), pk);
          return res.json({ message: 'Đã chuyển Crypto thành công và duyệt hoàn tất', result });
        }
      }
    }

    
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    const [txs] = await conn.execute('SELECT * FROM transactions WHERE id = ? AND type = ? AND wallet_type = ? FOR UPDATE', [req.params.id, 'withdraw', 'earning']);
    if (!txs[0]) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Không tìm thấy' }); }
    const tx = txs[0];
    if (tx.status !== 'pending') { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Đã xử lý rồi' }); }

    const newStatus = action === 'approve' ? 'completed' : 'rejected';
    await conn.execute('UPDATE transactions SET status = ? WHERE id = ?', [newStatus, tx.id]);

    if (action === 'reject') {
      
      await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?', [tx.amount, tx.user_id, 'earning']);
    }

    
    const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id,
      action === 'approve' ? 'Rút tiền thành công' : 'Rút tiền bị từ chối',
      action === 'approve' ? `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) đã được duyệt.` : `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) bị từ chối. Số tiền đã hoàn lại ví.`,
      action === 'approve' ? 'success' : 'warning',
        'worker']
    );

    await conn.commit();
    conn.release();
    res.json({ message: action === 'approve' ? 'Đã duyệt bằng tay (Không tự động chuyển USDT)' : 'Đã từ chối và hoàn tiền' });
  } catch (err) {
    if (err.message === 'Transaction đã được xử lý') {
      return res.status(400).json({ error: 'Giao dịch này đã được hoàn tất trước đó.' });
    }
    console.error('[WithdrawalAction] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});




router.post('/web3/status', async (req, res) => {
  try {
    const config = await getWeb3Pay().getPaymentSettings();
    let pk = (req.body.privateKey || '').trim();
    if (pk.length === 64 && /^[0-9a-fA-F]{64}$/.test(pk)) pk = '0x' + pk;

    if (config.web3_enabled !== 'true' || !pk) {
      return res.json({ enabled: false });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
      return res.status(400).json({ error: 'Private Key không hợp lệ. Phải bao gồm 64 ký tự hex (có hoặc không có 0x).' });
    }
    const walletInfo = await getWeb3Pay().getHotWalletInfo(pk);

    const pool = getPool();
    const [pending] = await pool.execute(
      `SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='withdraw' AND wallet_type='earning' AND status='pending' AND note LIKE '%[Crypto]%'`
    );
    const [recent] = await pool.execute(
      `SELECT COUNT(*) as c, COALESCE(SUM(amount_crypto), 0) as total_crypto FROM web3_payments WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    res.json({
      enabled: true, hotWallet: walletInfo,
      pendingWithdrawals: { count: pending[0].c, totalVND: Number(pending[0].total) },
      last24h: { count: recent[0].c, totalCrypto: Number(recent[0].total_crypto) },
      vndRate: config.web3_vnd_rate || null,
      autoApprove: config.web3_auto_approve === 'true',
      gasLimit: config.web3_gas_limit || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/web3/pay/:id', async (req, res) => {
  try {
    let pk = (req.body.privateKey || '').trim();
    if (pk.length === 64 && /^[0-9a-fA-F]{64}$/.test(pk)) pk = '0x' + pk;
    if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return res.status(400).json({ error: 'Private Key không hợp lệ.' });

    const result = await getWeb3Pay().processAutoPayment(Number(req.params.id), pk);
    res.json({ message: 'Thanh toán USDT thành công', result });
  } catch (err) {
    console.error('[Web3Pay] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


router.post('/web3/batch-pay', async (req, res) => {
  try {
    let pk = (req.body.privateKey || '').trim();
    if (pk.length === 64 && /^[0-9a-fA-F]{64}$/.test(pk)) pk = '0x' + pk;
    if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return res.status(400).json({ error: 'Private Key không hợp lệ.' });

    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id FROM transactions WHERE type='withdraw' AND wallet_type='earning' AND status='pending' AND note LIKE '%[Crypto]%' ORDER BY created_at ASC`
    );

    const results = [];
    for (const row of rows) {
      try {
        const r = await getWeb3Pay().processAutoPayment(row.id, privateKey);
        results.push({ id: row.id, status: 'success', txHash: r.txHash });
      } catch (err) {
        results.push({ id: row.id, status: 'error', error: err.message });
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    res.json({
      message: `Đã xử lý ${results.length} giao dịch`,
      total: rows.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/web3/payments', async (req, res) => {
  try {
    const pool = getPool();
    const { page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [count] = await pool.execute('SELECT COUNT(*) as c FROM web3_payments');
    const [rows] = await pool.execute(
      `SELECT wp.*, u.name as user_name, u.email as user_email
       FROM web3_payments wp
       LEFT JOIN users u ON wp.user_id = u.id
       ORDER BY wp.created_at DESC LIMIT ? OFFSET ?`,
      [Number(limit), offset]
    );

    res.json({
      payments: rows,
      total: count[0].c,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/web3/convert', async (req, res) => {
  try {
    const { amount } = req.query;
    if (!amount) return res.status(400).json({ error: 'Missing amount' });

    const config = await getWeb3Pay().getPaymentSettings();
    const customRate = config.web3_vnd_rate ? parseFloat(config.web3_vnd_rate) : null;

    const conversion = await getWeb3Pay().convertVndToUSDT(Number(amount), customRate);
    res.json(conversion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get('/referrals/:type', async (req, res) => {
  try {
    const pool = getPool();
    const type = req.params.type; 
    const serviceType = type === 'workers' ? 'shortlink' : 'traffic';
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = 'r.service_type = ?';
    const params = [serviceType];
    if (search) {
      where += ' AND (r.name LIKE ? OR r.email LIKE ? OR r.referral_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRow] = await pool.execute(
      `SELECT COUNT(*) as c FROM users r WHERE ${where}`, params
    );

    const [referrers] = await pool.execute(
      `SELECT r.id, r.name, r.email, r.referral_code, r.service_type, r.referred_by,
       (SELECT COUNT(*) FROM users WHERE referred_by = r.id) as ref_count,
       (SELECT name FROM users WHERE id = r.referred_by) as referred_by_name,
       (SELECT email FROM users WHERE id = r.referred_by) as referred_by_email
       FROM users r
       WHERE ${where}
       ORDER BY ref_count DESC, r.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${offset}`,
      params
    );

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
      total: countRow[0].c,
      page: Number(page),
      limit: Number(limit),
      totalReferrers: totalReferrers[0].c,
      totalReferred: totalReferred[0].c,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/referrals/:type/:userId', async (req, res) => {
  try {
    const pool = getPool();
    const [referred] = await pool.execute(
      'SELECT id, name, email, service_type, status, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json({ referred });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.get('/security/canvas-clusters', async (req, res) => {
  try {
    const pool = getPool();
    const { days = 30, minCount = 3 } = req.query;

    
    const [rows] = await pool.execute(
      `SELECT
         JSON_UNQUOTE(JSON_EXTRACT(security_detail, '$.canvas.hash1')) as canvas_hash,
         COUNT(DISTINCT COALESCE(worker_id,
           (SELECT worker_id FROM worker_links WHERE id = worker_link_id LIMIT 1)
         )) as worker_count,
         COUNT(*) as task_count,
         GROUP_CONCAT(DISTINCT ip_address SEPARATOR ', ') as ips,
         GROUP_CONCAT(DISTINCT COALESCE(
           (SELECT name FROM users WHERE id = worker_id LIMIT 1),
           (SELECT name FROM users WHERE id = (SELECT worker_id FROM worker_links WHERE id = worker_link_id LIMIT 1) LIMIT 1)
         ) SEPARATOR ', ') as worker_names
       FROM vuot_link_tasks
       WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
         AND security_detail IS NOT NULL
         AND security_detail != 'null'
         AND JSON_EXTRACT(security_detail, '$.canvas.hash1') IS NOT NULL
         AND JSON_EXTRACT(security_detail, '$.canvas.hash1') != 'null'
       GROUP BY canvas_hash
       HAVING worker_count >= ?
       ORDER BY worker_count DESC, task_count DESC
       LIMIT 50`,
      [Number(days), Number(minCount)]
    );

    res.json({
      clusters: rows.map(r => ({
        canvasHash: r.canvas_hash,
        workerCount: Number(r.worker_count),
        taskCount: Number(r.task_count),
        ips: (r.ips || '').split(', ').filter(Boolean).slice(0, 10),
        workerNames: (r.worker_names || '').split(', ').filter(Boolean).slice(0, 10),
      })),
      total: rows.length,
    });
  } catch (err) {
    console.error('[AntiCheat] canvas-clusters error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/security/delayed-ban-audit', async (req, res) => {
  try {
    const pool = getPool();
    const { threshold = 3 } = req.query; 

    
    const [suspects] = await pool.execute(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.status,
         COUNT(DISTINCT CASE WHEN vt.bot_detected = 1 THEN vt.id END) as bot_tasks,
         COUNT(DISTINCT CASE WHEN vt.status = 'completed' AND vt.bot_detected = 1 THEN vt.id END) as bot_completed,
         COALESCE(SUM(CASE WHEN vt.status = 'completed' AND vt.bot_detected = 1 THEN vt.earning END), 0) as suspicious_earning,
         COALESCE(SUM(CASE WHEN vt.status = 'completed' THEN vt.earning END), 0) as total_earning,
         (SELECT balance FROM wallets WHERE user_id = u.id AND type = 'earning' LIMIT 1) as pending_balance,
         (SELECT COUNT(*) FROM transactions WHERE user_id = u.id AND type = 'withdraw' AND status = 'pending' AND wallet_type = 'earning') as pending_withdrawals,
         MAX(vt.created_at) as last_activity
       FROM users u
       LEFT JOIN vuot_link_tasks vt
         ON (vt.worker_id = u.id OR vt.worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = u.id))
       WHERE u.status != 'banned'
       GROUP BY u.id
       HAVING bot_tasks >= ?
       ORDER BY bot_completed DESC, suspicious_earning DESC
       LIMIT 100`,
      [Number(threshold)]
    );

    
    const result = [];
    for (const row of suspects) {
      const [detectionTypes] = await pool.execute(
        `SELECT JSON_EXTRACT(security_detail, '$.detectionLog') as dl_raw
         FROM vuot_link_tasks
         WHERE (worker_id = ? OR worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?))
           AND bot_detected = 1
           AND security_detail IS NOT NULL
         LIMIT 20`,
        [row.id, row.id]
      );

      const detectionCounts = {};
      detectionTypes.forEach(r => {
        try {
          const dl = JSON.parse(r.dl_raw || '[]');
          if (Array.isArray(dl)) {
            dl.forEach(d => { detectionCounts[d] = (detectionCounts[d] || 0) + 1; });
          }
        } catch {}
      });

      result.push({
        id: row.id,
        name: row.name,
        email: row.email,
        status: row.status,
        botTasks: Number(row.bot_tasks),
        botCompleted: Number(row.bot_completed),
        suspiciousEarning: Number(row.suspicious_earning),
        totalEarning: Number(row.total_earning),
        pendingBalance: Number(row.pending_balance || 0),
        pendingWithdrawals: Number(row.pending_withdrawals),
        lastActivity: row.last_activity,
        detectionTypes: detectionCounts,
        riskScore: Math.min(100,
          Number(row.bot_tasks) * 5 +
          Number(row.bot_completed) * 10 +
          (Number(row.pending_withdrawals) > 0 ? 20 : 0)
        ),
      });
    }

    
    const highRisk = result.filter(r => r.riskScore >= 50);
    const totalSuspiciousEarning = result.reduce((s, r) => s + r.suspiciousEarning, 0);
    const totalPendingBalance = result.filter(r => r.pendingWithdrawals > 0).reduce((s, r) => s + r.pendingBalance, 0);

    res.json({
      suspects: result,
      summary: {
        total: result.length,
        highRisk: highRisk.length,
        totalSuspiciousEarning,
        totalAtRiskBalance: totalPendingBalance,
      },
    });
  } catch (err) {
    console.error('[AntiCheat] delayed-ban-audit error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.post('/security/batch-ban', async (req, res) => {
  try {
    const pool = getPool();
    const { userIds, rejectWithdrawals = true } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds required' });
    }

    const results = [];
    for (const uid of userIds) {
      if (Number(uid) === req.userId) continue; 
      try {
        
        await pool.execute("UPDATE users SET status = 'banned' WHERE id = ?", [uid]);

        
        let rejectedWithdrawals = 0;
        if (rejectWithdrawals) {
          const [txs] = await pool.execute(
            "SELECT id, amount FROM transactions WHERE user_id = ? AND type = 'withdraw' AND status = 'pending' AND wallet_type = 'earning'",
            [uid]
          );
          for (const tx of txs) {
            await pool.execute("UPDATE transactions SET status = 'rejected', note = 'Từ chối tự động - tài khoản gian lận' WHERE id = ?", [tx.id]);
            
            rejectedWithdrawals++;
          }
        }

        
        await pool.execute(
          `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
          [uid, 'Tài khoản bị khóa', 'Tài khoản của bạn đã bị khóa do vi phạm điều khoản sử dụng.', 'error', 'worker']
        );

        results.push({ uid, status: 'banned', rejectedWithdrawals });
      } catch (e) {
        results.push({ uid, status: 'error', error: e.message });
      }
    }

    res.json({
      message: `Đã xử lý ${results.length} tài khoản`,
      results,
      banned: results.filter(r => r.status === 'banned').length,
    });
  } catch (err) {
    console.error('[AntiCheat] batch-ban error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/security/fingerprint-clusters', async (req, res) => {
  try {
    const pool = getPool();
    const { days = 30, minCount = 2 } = req.query;

    const [rows] = await pool.execute(
      `SELECT
         JSON_UNQUOTE(JSON_EXTRACT(security_detail, '$.audioHash')) as audio_hash,
         COUNT(DISTINCT COALESCE(worker_id,
           (SELECT worker_id FROM worker_links WHERE id = worker_link_id LIMIT 1)
         )) as worker_count,
         COUNT(*) as task_count,
         GROUP_CONCAT(DISTINCT ip_address ORDER BY ip_address SEPARATOR ', ') as ips
       FROM vuot_link_tasks
       WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
         AND security_detail IS NOT NULL
         AND JSON_EXTRACT(security_detail, '$.audioHash') IS NOT NULL
       GROUP BY audio_hash
       HAVING worker_count >= ?
       ORDER BY worker_count DESC
       LIMIT 30`,
      [Number(days), Number(minCount)]
    );

    res.json({ clusters: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
