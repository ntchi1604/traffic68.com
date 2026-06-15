const express = require('express');
const { getPool } = require('../db');
const { authMiddleware, invalidateUserCache } = require('../middleware/auth');
const cache = require('../lib/cache');
const { clearSettingsCache: clearVuotlinkCache } = require('./vuotlink');
const { clearSettingsCache: clearWidgetCache } = require('./widgets');

const localDateStr = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

// ── In-memory cache role admin (tránh query DB mỗi request) ──
// TTL 30s — đủ nhanh để phản ánh thay đổi quyền, đủ hiệu quả giảm load
const adminRoleCache = new Map();
const ADMIN_ROLE_TTL = 30 * 1000;
function getCachedAdminRole(userId) {
  const e = adminRoleCache.get(userId);
  if (!e || Date.now() > e.expiry) { adminRoleCache.delete(userId); return null; }
  return e.role;
}
function setCachedAdminRole(userId, role) {
  adminRoleCache.set(userId, { role, expiry: Date.now() + ADMIN_ROLE_TTL });
}
function invalidateAdminRoleCache(userId) {
  adminRoleCache.delete(userId);
}
// Dọn cache định kỳ 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of adminRoleCache.entries()) if (now > v.expiry) adminRoleCache.delete(k);
}, 5 * 60 * 1000);

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
  // Check cache trước — chỉ query DB khi cache miss
  let role = getCachedAdminRole(req.userId);
  if (!role) {
    const pool = getPool();
    const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.userId]);
    role = users[0] ? users[0].role : null;
    if (role) setCachedAdminRole(req.userId, role);
  }
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập trang admin' });
  }
  next();
});


router.get('/overview', async (req, res) => {
  const { fromDate, toDate } = req.query;
  const cacheKey = `admin:overview:${fromDate || ''}:${toDate || ''}`;
  try {
    const data = await cache.get(
      cacheKey,
      async () => {
        const pool = getPool();
        // Dùng range thay vì DATE() — cho phép MySQL dùng index trên created_at
        let dateCondition = '';
        const dateParams = [];
        if (fromDate) { dateCondition += ' AND created_at >= ?'; dateParams.push(fromDate + ' 00:00:00'); }
        if (toDate) { dateCondition += ' AND created_at <= ?'; dateParams.push(toDate + ' 23:59:59'); }

        // Chạy tất cả queries SONG SONG
        const [tuR, tcR, rcR, tdR, trR, pdR, tvR, ptR, nuwR] = await Promise.all([
          pool.execute('SELECT COUNT(*) as c FROM users'),
          pool.execute('SELECT COUNT(*) as c FROM campaigns'),
          pool.execute("SELECT COUNT(*) as c FROM campaigns WHERE status = 'running'"),
          pool.execute(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type = 'deposit' AND status = 'completed'${dateCondition}`, dateParams),
          pool.execute(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type = 'withdraw' AND status = 'completed'${dateCondition}`, dateParams),
          pool.execute(`SELECT COUNT(*) as c FROM transactions WHERE type = 'deposit' AND status = 'pending'${dateCondition}`, dateParams),
          pool.execute('SELECT COALESCE(SUM(views_done), 0) as s FROM campaigns'),
          pool.execute("SELECT COUNT(*) as c FROM support_tickets WHERE status = 'open'"),
          pool.execute("SELECT COUNT(*) as c FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"),
        ]);
        const [tu] = tuR, [tc] = tcR, [rc] = rcR, [td] = tdR, [tr] = trR, [pd] = pdR, [tv] = tvR, [pt] = ptR, [nuw] = nuwR;

        let chartSql, chartParams;
        if (fromDate || toDate) {
          chartSql = `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM transactions WHERE 1=1${dateCondition} GROUP BY DATE(created_at) ORDER BY date ASC`;
          chartParams = dateParams;
        } else {
          const d14 = new Date(); d14.setDate(d14.getDate() - 14);
          const from14 = d14.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' 00:00:00';
          chartSql = `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM transactions WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date ASC`;
          chartParams = [from14];
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

        return {
          overview: {
            totalUsers: tu[0].c, totalCampaigns: tc[0].c, runningCampaigns: rc[0].c,
            totalDeposits: td[0].s, totalRevenue: tr[0].s, totalViews: tv[0].s,
            pendingTickets: pt[0].c, newUsersWeek: nuw[0].c, pendingDeposits: pd[0].c,
          },
          dailyStats,
        };
      },
      30 * 1000,  // 30s TTL — admin dashboard
      20 * 1000   // stale-while-revalidate sau 20s
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Tổng hợp tài chính toàn hệ thống ──
router.get('/finance/summary', async (req, res) => {
  try {
    const pool = getPool();

    const [
      // Số dư hiện tại trong các ví (toàn bộ user)
      [balMain],
      [balEarning],
      [balCommission],
      // Buyer: tổng nạp đã duyệt
      [totalDeposit],
      // Buyer: tổng chi campaign đã khấu trừ
      [totalCampaignSpent],
      // Worker: tổng đã rút (completed)
      [totalWithdrawWorker],
      // Buyer commission: tổng đã rút (completed)
      [totalWithdrawCommission],
      // Pending: rút chờ duyệt (đã trừ ví, chưa completed)
      [pendingWithdrawWorker],
      [pendingWithdrawCommission],
      // Pending: nạp chờ duyệt (chưa vào ví)
      [pendingDeposit],
      // Worker: tổng đã kiếm được (earning tasks)
      [totalWorkerEarned],
      // Hoa hồng referral đã trả
      [totalCommissionPaid],
    ] = await Promise.all([
      pool.execute(`SELECT COALESCE(SUM(balance), 0) as total FROM wallets WHERE type = 'main'`),
      pool.execute(`SELECT COALESCE(SUM(balance), 0) as total FROM wallets WHERE type = 'earning'`),
      pool.execute(`SELECT COALESCE(SUM(balance), 0) as total FROM wallets WHERE type = 'commission'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE wallet_type = 'main' AND type = 'deposit' AND status = 'completed'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE wallet_type = 'main' AND type = 'campaign' AND status = 'completed'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE wallet_type = 'earning' AND type = 'withdraw' AND status = 'completed'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE wallet_type = 'commission' AND type = 'withdraw' AND status = 'completed'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM transactions WHERE wallet_type = 'earning' AND type = 'withdraw' AND status = 'pending'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM transactions WHERE wallet_type = 'commission' AND type = 'withdraw' AND status = 'pending'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM transactions WHERE type = 'deposit' AND status = 'pending'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE wallet_type = 'earning' AND type = 'earning' AND status = 'completed'`),
      pool.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE wallet_type = 'commission' AND type = 'commission' AND status = 'completed'`),
    ]);

    // Số lượng user theo loại ví
    const [[userCounts]] = await pool.execute(`
      SELECT
        COUNT(DISTINCT CASE WHEN u.service_type = 'traffic' THEN u.id END) as buyer_count,
        COUNT(DISTINCT CASE WHEN u.service_type = 'shortlink' THEN u.id END) as worker_count,
        COALESCE(SUM(CASE WHEN u.service_type = 'traffic'   THEN w.balance ELSE 0 END), 0) as buyer_main_balance,
        COALESCE(SUM(CASE WHEN u.service_type = 'shortlink' THEN we.balance ELSE 0 END), 0) as worker_earning_balance
      FROM users u
      LEFT JOIN wallets w  ON w.user_id  = u.id AND w.type  = 'main'
      LEFT JOIN wallets we ON we.user_id = u.id AND we.type = 'earning'
    `);

    res.json({
      // ── Số dư hiện tại trong hệ thống ──
      currentBalances: {
        main: Number(balMain[0].total),       // Ví Traffic (buyer)
        earning: Number(balEarning[0].total),    // Ví Thu nhập (worker)
        commission: Number(balCommission[0].total), // Ví Hoa hồng (tất cả)
        total: Number(balMain[0].total) + Number(balEarning[0].total) + Number(balCommission[0].total),
      },
      // ── Tổng chi: tiền đã ra khỏi ví buyer sang worker ──
      totalSpent: {
        campaign: Number(totalCampaignSpent[0].total), // Buyer đã trả cho views
      },
      // ── Tổng rút: tiền đã ra khỏi hệ thống ──
      totalWithdrawn: {
        worker: Number(totalWithdrawWorker[0].total),     // Worker rút ví earning
        commission: Number(totalWithdrawCommission[0].total), // Buyer/worker rút ví commission
        total: Number(totalWithdrawWorker[0].total) + Number(totalWithdrawCommission[0].total),
      },
      // ── Đang chờ xử lý (chưa ra khỏi hệ thống, ví đã bị trừ) ──
      pending: {
        withdrawWorker: { amount: Number(pendingWithdrawWorker[0].total), count: Number(pendingWithdrawWorker[0].cnt) },
        withdrawCommission: { amount: Number(pendingWithdrawCommission[0].total), count: Number(pendingWithdrawCommission[0].cnt) },
        deposit: { amount: Number(pendingDeposit[0].total), count: Number(pendingDeposit[0].cnt) },
      },
      // ── Tổng nạp vào hệ thống (đã duyệt) ──
      totalDeposited: Number(totalDeposit[0].total),
      // ── Tổng worker đã kiếm + hoa hồng đã trả ──
      totalWorkerEarned: Number(totalWorkerEarned[0].total),
      totalCommissionPaid: Number(totalCommissionPaid[0].total),
      // ── Breakdown theo loại user ──
      breakdown: {
        buyer: { count: Number(userCounts.buyer_count), mainBalance: Number(userCounts.buyer_main_balance) },
        worker: { count: Number(userCounts.worker_count), earningBalance: Number(userCounts.worker_earning_balance) },
      },
    });
  } catch (err) {
    console.error('[Admin] finance/summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Top 10 Buyers nạp nhiều nhất trong tháng ──
router.get('/finance/top-buyers', async (req, res) => {
  try {
    const pool = getPool();
    const month = req.query.month || localDateStr(new Date()).slice(0, 7); // YYYY-MM VN
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email,
              COALESCE(w.balance, 0) as current_balance,
              COALESCE(SUM(t.amount), 0) as month_deposit
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN wallets w ON w.user_id = u.id AND w.type = 'main'
       WHERE t.wallet_type = 'main' AND t.type = 'deposit' AND t.status = 'completed'
         AND DATE_FORMAT(t.created_at, '%Y-%m') = ?
       GROUP BY u.id, u.name, u.email, w.balance
       ORDER BY month_deposit DESC
       LIMIT ?`,
      [month, limit]
    );
    res.json({ month, data: rows.map(r => ({ ...r, month_deposit: Number(r.month_deposit), current_balance: Number(r.current_balance) })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Top 10 Workers doanh thu cao nhất trong tháng ──
router.get('/finance/top-workers', async (req, res) => {
  try {
    const pool = getPool();
    const month = req.query.month || localDateStr(new Date()).slice(0, 7);
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    // Dùng UNION ALL để gộp cả 2 nguồn earning của worker:
    //   1. Task trực tiếp: worker_id = u.id (không qua gateway link)
    //   2. Task qua gateway link: worker_link_id → worker_links.worker_id = u.id
    // Giống logic trong /worker/stats (wlCondition = worker_id OR worker_link_id IN ...)
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email,
              COALESCE(we.balance, 0) as current_balance,
              COALESCE(SUM(combined.earning), 0) as month_earning,
              COUNT(*) as month_tasks
       FROM (
         SELECT worker_id as uid, earning
         FROM vuot_link_tasks
         WHERE worker_link_id IS NULL AND worker_id IS NOT NULL
           AND status = 'completed' AND bot_detected = 0 AND is_over_limit = 0
           AND DATE_FORMAT(completed_at, '%Y-%m') = ?
         UNION ALL
         SELECT wl.worker_id as uid, vt.earning
         FROM vuot_link_tasks vt
         JOIN worker_links wl ON wl.id = vt.worker_link_id
         WHERE vt.worker_link_id IS NOT NULL
           AND vt.status = 'completed' AND vt.bot_detected = 0 AND vt.is_over_limit = 0
           AND DATE_FORMAT(vt.completed_at, '%Y-%m') = ?
       ) combined
       JOIN users u ON u.id = combined.uid
       LEFT JOIN wallets we ON we.user_id = u.id AND we.type = 'earning'
       GROUP BY u.id, u.name, u.email, we.balance
       HAVING month_earning > 0
       ORDER BY month_earning DESC
       LIMIT ?`,
      [month, month, limit]
    );
    res.json({ month, data: rows.map(r => ({ ...r, month_earning: Number(r.month_earning), current_balance: Number(r.current_balance), month_tasks: Number(r.month_tasks) })) });
  } catch (err) {

    res.status(500).json({ error: err.message });
  }
});

// ── Danh sách user sắp xếp theo số dư ví từ cao đến thấp ──
router.get('/finance/wallet-ranking', async (req, res) => {
  try {
    const pool = getPool();
    const walletType = ['main', 'earning', 'commission'].includes(req.query.type) ? req.query.type : 'main';
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.status,
              w.balance,
              COALESCE(td.total_deposit, 0) as total_deposit,
              COALESCE(ts.total_spent, 0) as total_spent
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN (
         SELECT user_id, SUM(amount) as total_deposit
         FROM transactions WHERE wallet_type = ? AND type = 'deposit' AND status = 'completed'
         GROUP BY user_id
       ) td ON td.user_id = u.id
       LEFT JOIN (
         SELECT user_id, SUM(amount) as total_spent
         FROM transactions WHERE wallet_type = ? AND type IN ('campaign','withdraw') AND status = 'completed'
         GROUP BY user_id
       ) ts ON ts.user_id = u.id
       WHERE w.type = ? AND w.balance > 0
       ORDER BY w.balance DESC
       LIMIT ?`,
      [walletType, walletType, walletType, limit]
    );
    res.json({
      walletType,
      data: rows.map(r => ({ ...r, balance: Number(r.balance), total_deposit: Number(r.total_deposit), total_spent: Number(r.total_spent) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Source Approval: stats ──

router.get('/source-approval/stats', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN source_status = 'pending' OR source_status IS NULL OR source_status = '' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN source_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN source_status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM users
      WHERE source_url IS NOT NULL AND source_url != ''
    `);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', async (req, res) => {
  const pool = getPool();
  const { search, role, service_type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  // ── Bước 1: Lấy danh sách user + wallet balances (fast, indexed) ──
  let sql = `SELECT u.id, u.email, u.name, u.username, u.phone, u.role, u.service_type, u.status, u.trusted, u.bonus_mode, u.referral_code, u.created_at, u.source_status, u.source_url,
    COALESCE(wm.balance, 0) as main_balance,
    COALESCE(we.balance, 0) as earning_balance,
    COALESCE(wc.balance, 0) as commission_balance
    FROM users u
    LEFT JOIN wallets wm ON wm.user_id = u.id AND wm.type = 'main'
    LEFT JOIN wallets we ON we.user_id = u.id AND we.type = 'earning'
    LEFT JOIN wallets wc ON wc.user_id = u.id AND wc.type = 'commission'
    WHERE 1=1`;
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
  const { source_status } = req.query;
  if (source_status && source_status !== 'all') {
    if (source_status === 'pending') {
      const pCond = " AND (u.source_status = 'pending' OR u.source_status IS NULL OR u.source_status = '')";
      sql += pCond; countSql += pCond;
    } else {
      sql += ' AND u.source_status = ?'; countSql += ' AND u.source_status = ?';
      params.push(source_status); countParams.push(source_status);
    }
  }
  const { has_source } = req.query;
  if (has_source === '1') {
    const hsCond = " AND u.source_url IS NOT NULL AND u.source_url != ''";
    sql += hsCond; countSql += hsCond;
  }

  const [[{ total }]] = await pool.execute(countSql, countParams);
  sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const [users] = await pool.execute(sql, params);

  if (users.length === 0) {
    return res.json({ users: [], total, page: Number(page), limit: Number(limit) });
  }

  // ── Bước 2: Batch-fetch stats cho đúng user IDs trên trang này (O(N) queries → O(1)) ──
  const uids = users.map(u => u.id);
  const ph = uids.map(() => '?').join(',');

  // Chạy song song tất cả stats queries
  const [
    [campRows], [depRows], [campSpentRows], [trafficRows],
    [taskDirectRows], [taskLinkRows], [withdrawRows], [wlRows]
  ] = await Promise.all([
    // Buyer: số campaign
    pool.execute(`SELECT user_id, COUNT(*) as v FROM campaigns WHERE user_id IN (${ph}) GROUP BY user_id`, uids),
    // Buyer: tổng nạp
    pool.execute(`SELECT user_id, COALESCE(SUM(amount),0) as v FROM transactions WHERE user_id IN (${ph}) AND wallet_type='main' AND type='deposit' AND status='completed' GROUP BY user_id`, uids),
    // Buyer: tổng chi campaign
    pool.execute(`SELECT user_id, COALESCE(SUM(amount),0) as v FROM transactions WHERE user_id IN (${ph}) AND wallet_type='main' AND type='campaign' AND status='completed' GROUP BY user_id`, uids),
    // Buyer: tổng traffic
    pool.execute(`SELECT user_id, COALESCE(SUM(views_done),0) as v FROM campaigns WHERE user_id IN (${ph}) GROUP BY user_id`, uids),
    // Worker: task trực tiếp
    pool.execute(`SELECT worker_id as user_id, COUNT(*) as v FROM vuot_link_tasks WHERE worker_id IN (${ph}) AND status='completed' AND bot_detected=0 GROUP BY worker_id`, uids),
    // Worker: task qua gateway link
    pool.execute(`SELECT wl.worker_id as user_id, COUNT(*) as v FROM vuot_link_tasks vt JOIN worker_links wl ON wl.id = vt.worker_link_id WHERE wl.worker_id IN (${ph}) AND vt.status='completed' AND vt.bot_detected=0 GROUP BY wl.worker_id`, uids),
    // Worker: tổng rút
    pool.execute(`SELECT user_id, COALESCE(SUM(amount),0) as v FROM transactions WHERE user_id IN (${ph}) AND wallet_type='earning' AND type='withdraw' AND status='completed' GROUP BY user_id`, uids),
    // Worker: tổng worker links
    pool.execute(`SELECT worker_id as user_id, COUNT(*) as v FROM worker_links WHERE worker_id IN (${ph}) GROUP BY worker_id`, uids),
  ]);

  // Map thành object để lookup O(1)
  const toMap = (rows) => Object.fromEntries(rows.map(r => [r.user_id, Number(r.v)]));
  const campMap = toMap(campRows);
  const depMap = toMap(depRows);
  const campSpentMap = toMap(campSpentRows);
  const trafficMap = toMap(trafficRows);
  const taskDirectMap = toMap(taskDirectRows);
  const taskLinkMap = toMap(taskLinkRows);
  const withdrawMap = toMap(withdrawRows);
  const wlMap = toMap(wlRows);

  // Gắn stats vào mỗi user
  const enriched = users.map(u => ({
    ...u,
    campaign_count: campMap[u.id] || 0,
    total_deposit: depMap[u.id] || 0,
    total_campaign_spent: campSpentMap[u.id] || 0,
    total_traffic_done: trafficMap[u.id] || 0,
    task_count: (taskDirectMap[u.id] || 0) + (taskLinkMap[u.id] || 0),
    total_withdraw: withdrawMap[u.id] || 0,
    total_worker_links: wlMap[u.id] || 0,
  }));

  res.json({ users: enriched, total, page: Number(page), limit: Number(limit) });
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

router.put('/users/:id/trusted', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT trusted FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy user' });
    const newVal = rows[0].trusted ? 0 : 1;
    await pool.execute('UPDATE users SET trusted = ? WHERE id = ?', [newVal, req.params.id]);
    res.json({ ok: true, trusted: newVal });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Toggle bonus_mode cho worker user
// bonus_mode = 1: IP hết lượt vẫn nhận task (không trừ tiền buyer, không trả worker, NHƯNG TÍNH view)
router.put('/users/:id/bonus-mode', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT bonus_mode FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy user' });
    const newVal = rows[0].bonus_mode ? 0 : 1;
    await pool.execute('UPDATE users SET bonus_mode = ? WHERE id = ?', [newVal, req.params.id]);
    console.log(`[Admin] User ${req.params.id} bonus_mode set to ${newVal} by admin ${req.userId}`);
    res.json({ ok: true, bonus_mode: newVal });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/approve-source', async (req, res) => {
  try {
    const pool = getPool();
    const { pricing_group_id } = req.body || {};
    await pool.execute(
      `UPDATE users SET source_status = 'approved'${pricing_group_id ? ', pricing_group_id = ?' : ''} WHERE id = ?`,
      pricing_group_id ? [pricing_group_id, req.params.id] : [req.params.id]
    );
    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, '✅ Nguồn đã được duyệt', 'Tài khoản của bạn đã được duyệt nguồn. Bạn có thể tạo link rút gọn ngay bây giờ!', 'success', 'worker']
      );
    } catch (_) { }
    res.json({ ok: true, message: 'Đã duyệt nguồn' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/reject-source', async (req, res) => {
  try {
    const pool = getPool();
    const { reason } = req.body || {};
    await pool.execute(
      "UPDATE users SET source_status = 'rejected' WHERE id = ?",
      [req.params.id]
    );
    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, '❌ Nguồn bị từ chối', `Yêu cầu xét duyệt nguồn của bạn bị từ chối${reason ? ': ' + reason : ''}. Vui lòng cập nhật lại nguồn và gửi lại.`, 'error', 'worker']
      );
    } catch (_) { }
    res.json({ ok: true, message: 'Đã từ chối nguồn' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  const pool = getPool();
  const uid = req.params.id;
  if (Number(uid) === req.userId) return res.status(400).json({ error: 'Không thể xóa chính mình' });

  try {

    const [wlRows] = await pool.execute('SELECT id FROM worker_links WHERE worker_id = ?', [uid]);
    const wlIds = wlRows.map(r => r.id);

    // ── Trừ views_done cho các campaign trước khi xóa tasks ──
    // Đếm task completed (không phải bot) theo campaign_id
    let adjustQuery = `SELECT campaign_id, COUNT(*) as cnt FROM vuot_link_tasks WHERE worker_id = ? AND status = 'completed' AND bot_detected = 0 GROUP BY campaign_id`;
    const [adjRows1] = await pool.execute(adjustQuery, [uid]);
    if (wlIds.length > 0) {
      const ph = wlIds.map(() => '?').join(',');
      const [adjRows2] = await pool.execute(
        `SELECT campaign_id, COUNT(*) as cnt FROM vuot_link_tasks WHERE worker_link_id IN (${ph}) AND status = 'completed' AND bot_detected = 0 GROUP BY campaign_id`, wlIds
      );
      adjRows2.forEach(r => {
        const existing = adjRows1.find(x => x.campaign_id === r.campaign_id);
        if (existing) existing.cnt += r.cnt;
        else adjRows1.push(r);
      });
    }
    for (const r of adjRows1) {
      await pool.execute('UPDATE campaigns SET views_done = GREATEST(0, COALESCE(views_done, 0) - ?) WHERE id = ?', [r.cnt, r.campaign_id]);
    }

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

// ── Admin: Đổi mật khẩu người dùng ──────────────────────────────────────────
router.post('/users/:id/change-password', async (req, res) => {
  try {
    const pool = getPool();
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
    }
    const [users] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [req.params.id]);
    if (!users.length) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    console.log(`[Admin] Password changed for user #${req.params.id} (${users[0].email}) by admin #${req.userId}`);
    res.json({ ok: true, message: `Đã đổi mật khẩu cho ${users[0].name}` });
  } catch (err) {
    console.error('[Admin] change-password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});





router.get('/campaigns', async (req, res) => {
  const pool = getPool();
  const { search, status, page = 1, limit = 20, sync } = req.query;
  const offset = (page - 1) * limit;
  const todayVnAdmin = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const todayStartAdmin = todayVnAdmin + ' 00:00:00';
  const todayEndAdmin   = todayVnAdmin + ' 23:59:59';

  // Dùng LEFT JOIN aggregate thay correlated subquery → 1 query thay N queries
  let sql = `SELECT c.*, u.name as user_name, u.email as user_email,
    COALESCE(vt.views_today, 0) as views_today
    FROM campaigns c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) as views_today
      FROM vuot_link_tasks
      WHERE status = 'completed' AND bot_detected = 0
        AND completed_at >= ? AND completed_at <= ?
      GROUP BY campaign_id
    ) vt ON vt.campaign_id = c.id
    WHERE 1=1`;
  const params = [todayStartAdmin, todayEndAdmin];
  if (search) { sql += ' AND (c.name LIKE ? OR c.url LIKE ? OR u.email LIKE ? OR c.keyword LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (status && status !== 'all') { sql += ' AND c.status = ?'; params.push(status); }
  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const [campaigns] = await pool.execute(sql, params);

  if (sync === '1') {
    try {
      const ids = campaigns.map(c => c.id);
      if (ids.length > 0) {
        const ph = ids.map(() => '?').join(',');

        // Đảm bảo cột manually_completed tồn tại
        try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch (_) { }

        await pool.execute(
          `UPDATE campaigns c SET views_done = (
            SELECT COUNT(*) FROM vuot_link_tasks WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0
          ) WHERE c.id IN (${ph}) AND c.views_done < (
            SELECT COUNT(*) FROM vuot_link_tasks WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0
          )`, ids
        );
        // Chỉ auto-revert nếu không được đánh dấu hoàn thành thủ công
        try {
          await pool.execute(
            `UPDATE campaigns SET status = 'running' WHERE id IN (${ph}) AND status = 'completed' AND views_done < total_views AND COALESCE(manually_completed, 0) = 0`, ids
          );
        } catch (_) { }
        const [updated] = await pool.execute(sql, params);
        return res.json({ campaigns: updated });
      }
    } catch (_) { /* ignore sync errors */ }
  }

  res.json({ campaigns });
});


router.put('/campaigns/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { status, name, url, url2, keyword, keyword_config, dailyViews, viewByHour, image1_url, image2_url, totalViews, budget, cpc, trafficType, version, timeOnSite, targetPage, device } = req.body;
    const n = (v) => v === undefined ? null : v;


    if (status && Object.keys(req.body).length === 1) {
      // Khi admin đánh dấu completed thủ công → set flag manually_completed
      // Luôn tạo cột trước để tránh fallback không lưu flag
      try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch (_) { }
      const manuallyCompleted = status === 'completed' ? 1 : 0;
      await pool.execute(
        'UPDATE campaigns SET status = ?, manually_completed = ? WHERE id = ?',
        [status, manuallyCompleted, req.params.id]
      );
      return res.json({ message: 'Đã cập nhật trạng thái' });
    }

    await pool.execute(
      `UPDATE campaigns SET name=COALESCE(?,name), url=COALESCE(?,url), url2=COALESCE(?,url2), keyword=COALESCE(?,keyword), keyword_config=COALESCE(?,keyword_config),
       daily_views=COALESCE(?,daily_views), view_by_hour=COALESCE(?,view_by_hour), image1_url=COALESCE(?,image1_url), image2_url=COALESCE(?,image2_url),
       total_views=COALESCE(?,total_views), budget=COALESCE(?,budget), cpc=COALESCE(?,cpc),
       traffic_type=COALESCE(?,traffic_type), version=COALESCE(?,version), time_on_site=COALESCE(?,time_on_site),
       target_page=COALESCE(?,target_page), status=COALESCE(?,status), device=COALESCE(?,device) WHERE id = ?`,
      [n(name), n(url), n(url2), n(keyword), n(keyword_config), n(dailyViews), n(viewByHour), n(image1_url), n(image2_url),
      n(totalViews), n(budget), n(cpc), n(trafficType), n(version), n(timeOnSite), n(targetPage), n(status), n(device), req.params.id]
    );
    const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cập nhật thành công', campaign: campaigns[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaigns/:id/priority', async (req, res) => {
  try {
    const pool = getPool();
    const priority = Number(req.body.priority);
    if (![0, 1, 2, 3, 4, 5].includes(priority)) {
      return res.status(400).json({ error: 'Priority phải là 0 (mặc định) hoặc 1–5' });
    }
    const [check] = await pool.execute('SELECT id, name FROM campaigns WHERE id = ?', [req.params.id]);
    if (!check.length) return res.status(404).json({ error: 'Không tìm thấy campaign' });
    const dbValue = priority === 0 ? null : priority;
    await pool.execute('UPDATE campaigns SET priority = ? WHERE id = ?', [dbValue, req.params.id]);
    console.log(`[Admin] Campaign ${req.params.id} priority set to ${dbValue ?? 'NULL(default)'} by admin ${req.userId}`);
    res.json({ ok: true, campaignId: Number(req.params.id), priority: dbValue, campaignName: check[0].name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaigns/:id/bonus-mode', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT id, name, bonus_mode FROM campaigns WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy campaign' });
    const newVal = rows[0].bonus_mode ? 0 : 1;
    await pool.execute('UPDATE campaigns SET bonus_mode = ? WHERE id = ?', [newVal, req.params.id]);
    console.log(`[Admin] Campaign ${req.params.id} bonus_mode set to ${newVal} by admin ${req.userId}`);
    res.json({ ok: true, campaignId: Number(req.params.id), bonus_mode: newVal, campaignName: rows[0].name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ── Admin: Gia hạn chiến dịch (không trừ tiền buyer, chỉ cộng view) ──────────
router.post('/campaigns/:id/renew', async (req, res) => {
  try {
    const pool = getPool();
    const { extraViews } = req.body;
    const addViews = parseInt(extraViews, 10);
    if (!addViews || addViews <= 0) return res.status(400).json({ error: 'Số view gia hạn phải lớn hơn 0' });

    const [existing] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });

    const camp = existing[0];
    const cpcValue = Number(camp.cpc) || 0;
    const newTotal = Number(camp.total_views) + addViews;
    const newBudget = cpcValue > 0 ? Math.round(newTotal * cpcValue) : Number(camp.budget);

    // Cập nhật keyword_config: phân bổ extraViews vào keyword đầu tiên
    let newKeywordConfig = camp.keyword_config;
    try {
      const cfg = camp.keyword_config ? JSON.parse(camp.keyword_config) : null;
      if (Array.isArray(cfg) && cfg.length > 0) {
        cfg[0].views = Number(cfg[0].views || 0) + addViews;
        newKeywordConfig = JSON.stringify(cfg);
      }
    } catch (_) { }

    // Cộng view, reset manually_completed = 0 để cho phép chạy lại
    await pool.execute(
      `UPDATE campaigns SET total_views = ?, budget = ?, status = 'running', manually_completed = 0, keyword_config = ? WHERE id = ?`,
      [newTotal, newBudget, newKeywordConfig, camp.id]
    );

    // Thông báo cho buyer
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [camp.user_id, 'Chiến dịch được gia hạn',
      `Chiến dịch "${camp.name}" đã được admin gia hạn thêm ${addViews.toLocaleString()} view và tiếp tục chạy.`,
        'success', 'buyer']
    ).catch(() => { });

    console.log(`[Admin] Campaign ${camp.id} renewed +${addViews} views by admin ${req.userId}`);
    const [updated] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [camp.id]);
    res.json({ message: `Đã gia hạn thêm ${addViews.toLocaleString()} view`, campaign: updated[0] });
  } catch (err) {
    console.error('[Admin] Campaign renew error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.post('/campaigns/:id/sync-views', async (req, res) => {
  try {
    const pool = getPool();
    const cid = req.params.id;

    if (cid === 'all') {
      // Sync tất cả campaigns
      const [rows] = await pool.execute(
        `SELECT c.id, c.views_done as old_views,
                COALESCE((SELECT COUNT(*) FROM vuot_link_tasks WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0), 0) as real_views
         FROM campaigns c`
      );
      let fixed = 0;
      for (const r of rows) {
        if (Number(r.old_views) < Number(r.real_views)) {
          await pool.execute('UPDATE campaigns SET views_done = ? WHERE id = ?', [r.real_views, r.id]);
          fixed++;
        }
      }
      return res.json({ message: `Đã đồng bộ ${fixed}/${rows.length} chiến dịch`, fixed, total: rows.length });
    }

    // Sync 1 campaign
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as real_views FROM vuot_link_tasks WHERE campaign_id = ? AND status = 'completed' AND bot_detected = 0`,
      [cid]
    );
    const realViews = rows[0].real_views;
    const [camp] = await pool.execute('SELECT views_done FROM campaigns WHERE id = ?', [cid]);
    const oldViews = camp[0] ? camp[0].views_done || 0 : 0;

    if (Number(oldViews) < Number(realViews)) {
      await pool.execute('UPDATE campaigns SET views_done = ? WHERE id = ?', [realViews, cid]);
    }
    res.json({ message: `Đã đồng bộ: ${oldViews} → ${Math.max(Number(oldViews), Number(realViews))}`, oldViews, newViews: Math.max(Number(oldViews), Number(realViews)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/campaigns/:id/keyword-stats', async (req, res) => {
  try {
    const pool = getPool();
    const cid = req.params.id;
    const [rows] = await pool.execute(
      `SELECT
         keyword,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' AND bot_detected = 0 THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status IN ('pending','step1','step2','step3') THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
         SUM(CASE WHEN bot_detected = 1 THEN 1 ELSE 0 END) as blocked,
         COALESCE(SUM(earning), 0) as cost
       FROM vuot_link_tasks
       WHERE campaign_id = ?
       GROUP BY keyword
       ORDER BY completed DESC`,
      [cid]
    );

    // ── Auto-sync views_done nếu chênh lệch ──
    const realViews = rows.reduce((s, r) => s + Number(r.completed), 0);
    const [camp] = await pool.execute('SELECT views_done FROM campaigns WHERE id = ?', [cid]);
    if (camp[0] && Number(camp[0].views_done) < realViews) {
      await pool.execute('UPDATE campaigns SET views_done = ? WHERE id = ?', [realViews, cid]);
    }

    res.json({ keywords: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/campaigns/:id/detailed-stats', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.execute(
      `SELECT DATE(vlt.created_at) as date, vlt.keyword, c.daily_views as campaign_daily_views,
              c.keyword_config,
              COUNT(*) as total,
              SUM(CASE WHEN vlt.status = 'completed' AND vlt.bot_detected = 0 THEN 1 ELSE 0 END) as completed,
              COALESCE(SUM(vlt.earning), 0) as cost
       FROM vuot_link_tasks vlt
       JOIN campaigns c ON c.id = vlt.campaign_id
       WHERE vlt.campaign_id = ?
       GROUP BY date, c.daily_views, c.keyword_config, vlt.keyword
       ORDER BY date DESC, completed DESC`,
      [req.params.id]
    );

    // — Tính per-keyword daily_views từ keyword_config —
    const safeData = data.map(r => {
      let kwDailyViews = Number(r.campaign_daily_views) || 0;
      try {
        const cfg = r.keyword_config ? JSON.parse(r.keyword_config) : null;
        if (Array.isArray(cfg) && cfg.length > 0) {
          const kwEntry = cfg.find(k => k.keyword === r.keyword);
          if (kwEntry && Number(kwEntry.daily_views) > 0) {
            kwDailyViews = Number(kwEntry.daily_views);
          } else if (kwEntry && !(Number(kwEntry.daily_views) > 0)) {
            const explicit = cfg.filter(k => Number(k.daily_views) > 0);
            const totalExplicit = explicit.reduce((s, k) => s + Number(k.daily_views), 0);
            const unsetCount = cfg.filter(k => !(Number(k.daily_views) > 0)).length;
            const remaining = Math.max(0, Number(r.campaign_daily_views) - totalExplicit);
            kwDailyViews = unsetCount > 0 && Number(r.campaign_daily_views) > 0
              ? Math.floor(remaining / unsetCount) : 0;
          }
        }
      } catch (_) { /* fallback to campaign_daily_views */ }

      const { keyword_config, campaign_daily_views, ...rest } = r;
      return { ...rest, date: localDateStr(new Date(r.date)), daily_views: kwDailyViews };
    });
    res.json({ detailed: safeData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Export tasks for a campaign (với geo lookup, cpc, giống hệt buyer export) ──
router.get('/campaigns/:id/tasks-export', async (req, res) => {
  try {
    const pool = getPool();
    const cid = req.params.id;
    const detectDevice = (ua) => {
      if (!ua) return 'Unknown';
      if (/mobile|android|iphone|ipad/i.test(ua)) return 'Mobile';
      if (/tablet/i.test(ua)) return 'Tablet';
      return 'Desktop';
    };
    const [rows] = await pool.execute(
      `SELECT vlt.id, vlt.keyword, vlt.ip_address, vlt.user_agent, vlt.ip_country,
              vlt.created_at, vlt.completed_at
       FROM vuot_link_tasks vlt
       WHERE vlt.campaign_id = ? AND vlt.status = 'completed' AND vlt.bot_detected = 0
       ORDER BY vlt.completed_at DESC`,
      [cid]
    );

    // Lấy cpc để tính chi tiêu buyer
    const [campRows] = await pool.execute('SELECT cpc FROM campaigns WHERE id = ?', [cid]);
    const cpc = Number(campRows[0] ? campRows[0].cpc : 0) || 0;

    // ── Geo lookup: batch via ip-api.com ──
    const geoip = require('geoip-lite');
    const uniqueIps = [...new Set(
      rows.map(r => r.ip_address).filter(ip => {
        if (!ip) return false;
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fe80)/i.test(ip)) return false;
        return true;
      })
    )];
    const geoMap = {};
    const BATCH = 100;
    const PARALLEL = 5; // tối đa 5 batch song song

    // Helper: gọi 1 batch IP-API
    const callIpApi = (batch) => new Promise((resolve) => {
      const body = JSON.stringify(batch.map(ip => ({ query: ip, fields: 'query,country,city,status' })));
      const options = {
        hostname: 'ip-api.com',
        path: '/batch?fields=query,country,city,status',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      };
      const req2 = require('http').request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve([]); } });
      });
      req2.on('error', () => resolve([]));
      req2.setTimeout(5000, () => { req2.destroy(); resolve([]); });
      req2.write(body);
      req2.end();
    });

    // Chạy song song theo nhóm PARALLEL batches
    const batches = [];
    for (let i = 0; i < uniqueIps.length; i += BATCH) batches.push(uniqueIps.slice(i, i + BATCH));
    for (let i = 0; i < batches.length; i += PARALLEL) {
      const group = batches.slice(i, i + PARALLEL);
      const results = await Promise.all(group.map(b => callIpApi(b).catch(() => [])));
      results.forEach(result => {
        if (Array.isArray(result)) {
          result.forEach(r => {
            if (r.status === 'success' && r.query) geoMap[r.query] = { country: r.country || '', city: r.city || '' };
          });
        }
      });
    }
    uniqueIps.forEach(ip => {
      if (!geoMap[ip]) {
        const geo = geoip.lookup(ip);
        if (geo) geoMap[ip] = { country: geo.country || '', city: geo.city || '' };
      }
    });

    const tasks = rows.map((r, i) => {
      const geo = geoMap[r.ip_address] || {};
      const country = r.ip_country || geo.country || '';
      const city = geo.city || '';
      return {
        stt: i + 1,
        id: r.id,
        keyword: r.keyword || '',
        ip: r.ip_address || '',
        country,
        city,
        device: detectDevice(r.user_agent),
        userAgent: r.user_agent || '',
        spending: cpc,
        createdAt: r.created_at,
        completedAt: r.completed_at || null,
      };
    });
    res.json({ tasks, campaignId: cid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/transactions', async (req, res) => {
  const pool = getPool();
  const { type, status, search: txSearch, fromDate, toDate, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let baseWhere = `WHERE 1=1`;
  const params = [];
  const filterParams = [];
  let filterCondition = '';
  if (txSearch) { baseWhere += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${txSearch}%`, `%${txSearch}%`); filterCondition += ' AND (u.name LIKE ? OR u.email LIKE ?)'; filterParams.push(`%${txSearch}%`, `%${txSearch}%`); }
  if (type && type !== 'all') { baseWhere += ' AND t.type = ?'; params.push(type); filterCondition += ' AND t.type = ?'; filterParams.push(type); }
  if (status && status !== 'all') { baseWhere += ' AND t.status = ?'; params.push(status); filterCondition += ' AND t.status = ?'; filterParams.push(status); }
  // Dùng range thay vì DATE() — cho phép MySQL dùng index trên created_at
  if (fromDate) { baseWhere += ' AND t.created_at >= ?'; params.push(fromDate + ' 00:00:00'); filterCondition += ' AND t.created_at >= ?'; filterParams.push(fromDate + ' 00:00:00'); }
  if (toDate) { baseWhere += ' AND t.created_at <= ?'; params.push(toDate + ' 23:59:59'); filterCondition += ' AND t.created_at <= ?'; filterParams.push(toDate + ' 23:59:59'); }

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as c FROM transactions t LEFT JOIN users u ON t.user_id = u.id ${baseWhere}`, params
  );
  const total = countRows[0].c;

  const sql = `SELECT t.*, u.name as user_name, u.email as user_email FROM transactions t LEFT JOIN users u ON t.user_id = u.id ${baseWhere} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
  const [transactions] = await pool.execute(sql, [...params, Number(limit), offset]);


  const [depRows] = await pool.execute(
    `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.status = 'completed' AND t.type IN ('deposit','earning','commission','refund')${filterCondition}`,
    filterParams
  );
  const [wdRows] = await pool.execute(
    `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.status = 'completed' AND t.type IN ('withdraw','campaign')${filterCondition}`,
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

    // Chỉ cộng tiền vào ví cho deposit/refund.
    // Với withdraw: tiền đã bị trừ khi worker TẠO đơn → duyệt chỉ confirm đã chuyển, KHÔNG cộng lại.
    if (tx.type !== 'withdraw') {
      await conn.execute(
        'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
        [tx.amount, tx.user_id, tx.wallet_type || 'main']
      );
    }

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
      const referrerId = depositorRows[0] ? depositorRows[0].referred_by : null;

      if (referrerId) {

        const [settingRows] = await conn.execute(
          "SELECT setting_value FROM site_settings WHERE setting_key = 'referral_commission_buyer'",
          []
        );
        const commPct = Number(settingRows[0] ? settingRows[0].setting_value || 0 : 0);

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

    // ── Auto-cancel các pending deposits khác của cùng user + cùng amount ──
    // Tránh watcher auto-approve trùng lặp
    try {
      await conn.execute(
        `UPDATE transactions SET status = 'cancelled', note = CONCAT(COALESCE(note,''), ' | Tự động hủy: đã duyệt đơn khác cùng giá trị')
         WHERE user_id = ? AND type = 'deposit' AND status = 'pending' AND amount = ? AND id != ?`,
        [tx.user_id, tx.amount, req.params.id]
      );
    } catch (_) { /* không critical */ }

    await conn.commit();
    conn.release();
    const actionLabel = tx.type === 'withdraw' ? 'rút tiền' : 'nạp tiền';
    res.json({ message: `Đã duyệt đơn ${actionLabel} ${fmt} VND` });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Lỗi duyệt giao dịch: ' + err.message });
  }
});



router.put('/transactions/:id/reject', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { reason } = req.body;
    const [txs] = await conn.execute('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [req.params.id]);
    if (txs.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Không tìm thấy giao dịch' }); }
    const tx = txs[0];
    if (tx.status !== 'pending') { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Giao dịch này đã được xử lý' }); }

    await conn.execute("UPDATE transactions SET status = 'rejected', note = ? WHERE id = ?", [reason || 'Admin từ chối', req.params.id]);

    const fmt = new Intl.NumberFormat('vi-VN').format(tx.amount);

    // Nếu là đơn RÚT TIỀN bị từ chối → hoàn tiền lại vào ví (tiền đã bị trừ khi tạo đơn)
    if (tx.type === 'withdraw') {
      await conn.execute(
        'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
        [tx.amount, tx.user_id, tx.wallet_type || 'earning']
      );
      // Ghi transaction hoàn tiền
      await conn.execute(
        `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, 'refund', 'admin', ?, 'completed', ?, ?)`,
        [tx.user_id, tx.wallet_type || 'earning', tx.amount, 'REFUND-' + tx.ref_code, `Hoàn tiền đơn rút bị từ chối (${tx.ref_code}). Lý do: ${reason || 'Không hợp lệ'}`]
      );
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [tx.user_id, '❌ Đơn rút tiền bị từ chối', `Đơn rút ${fmt} VND (Mã: ${tx.ref_code}) bị từ chối. Lý do: ${reason || 'Không hợp lệ'}. Tiền đã được hoàn lại vào ví.`, 'error', 'worker']
      );
    } else {
      // Deposit bị từ chối: không cần hoàn tiền (chưa cộng vào ví)
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [tx.user_id, '❌ Đơn nạp tiền bị từ chối', `Đơn nạp ${fmt} VND (Mã: ${tx.ref_code}) đã bị từ chối. Lý do: ${reason || 'Không hợp lệ'}`, 'error', 'buyer']
      );
    }

    await conn.commit();
    conn.release();
    const actionLabel = tx.type === 'withdraw' ? 'rút tiền (đã hoàn tiền vào ví)' : 'nạp tiền';
    res.json({ message: `Đã từ chối đơn ${actionLabel}` });
  } catch (err) {
    await conn.rollback();
    conn.release();
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
    // Clear in-memory caches immediately so new settings take effect without waiting 60s
    try { clearVuotlinkCache(); } catch (_) { }
    try { clearWidgetCache(); } catch (_) { }
    res.json({ message: 'Cập nhật cài đặt thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Manual deposit scan trigger ──
router.post('/deposit/scan', async (req, res) => {
  try {
    const w3 = getWeb3Pay();
    w3.resetDepositScanner(10000); // Re-scan last ~50 mins
    await w3.processIncomingDeposits();
    res.json({ message: 'Deposit scan hoàn tất. Kiểm tra PM2 logs để xem kết quả.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ══════════════════════════════════════════════════════════════
// ── Admin: Worker Links Management ──────────────────────────
// ══════════════════════════════════════════════════════════════

// GET /admin/worker-links — danh sách tất cả worker links với filter
router.get('/worker-links', async (req, res) => {
  try {
    const pool = getPool();
    const { search = '', workerId = '', hidden = 'all', page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = 'WHERE 1=1';
    const params = [];

    if (workerId) {
      where += ' AND wl.worker_id = ?'; params.push(workerId);
    }
    if (hidden !== 'all') {
      where += ' AND wl.hidden = ?'; params.push(hidden === '1' ? 1 : 0);
    }
    if (search) {
      where += ' AND (wl.slug LIKE ? OR wl.title LIKE ? OR wl.destination_url LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      const sq = `%${search}%`;
      params.push(sq, sq, sq, sq, sq);
    }

    const countSql = `SELECT COUNT(*) as c FROM worker_links wl LEFT JOIN users u ON u.id = wl.worker_id ${where}`;
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0].c;

    const sql = `
      SELECT wl.id, wl.worker_id, wl.slug, wl.title, wl.destination_url,
             wl.click_count, wl.completed_count, wl.earning, wl.hidden, wl.created_at,
             u.name as worker_name, u.email as worker_email
      FROM worker_links wl
      LEFT JOIN users u ON u.id = wl.worker_id
      ${where}
      ORDER BY wl.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [links] = await pool.execute(sql, [...params, Number(limit), offset]);

    // Stats tổng quan
    const [stats] = await pool.execute(`
      SELECT
        COUNT(*) as total_links,
        SUM(click_count) as total_clicks,
        SUM(completed_count) as total_completed,
        COALESCE(SUM(earning), 0) as total_earning,
        SUM(hidden) as total_hidden
      FROM worker_links
    `);

    res.json({ links, total, stats: stats[0], page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/worker-links/:id — xóa link
router.delete('/worker-links/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.execute('DELETE FROM worker_links WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy link' });
    res.json({ message: 'Đã xóa link' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/worker-links/:id/toggle-hidden — ẩn/hiện link
router.put('/worker-links/:id/toggle-hidden', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT hidden FROM worker_links WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy link' });
    const newHidden = rows[0].hidden ? 0 : 1;
    await pool.execute('UPDATE worker_links SET hidden = ? WHERE id = ?', [newHidden, req.params.id]);
    res.json({ ok: true, hidden: newHidden });
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
    // Xóa cache ngay để ban có hiệu lực tức thì
    invalidateUserCache(Number(req.params.uid));
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
      const s = search.trim();
      const isIp = /^[\d.:a-f]+$/i.test(s) && (s.includes('.') || s.includes(':'));
      const isVisitorId = s.length > 20;
      const isSlug = /^[a-z0-9_-]{3,20}$/.test(s) && !s.includes('@') && !isIp;
      if (isIp) {
        searchWhere = ` AND u.id IN (SELECT DISTINCT COALESCE(vt2.worker_id, wl2.worker_id) FROM vuot_link_tasks vt2 LEFT JOIN worker_links wl2 ON wl2.id = vt2.worker_link_id WHERE vt2.ip_address LIKE ?)`;
        params.push(`%${s}%`);
      } else if (isVisitorId) {
        searchWhere = ` AND u.id IN (SELECT DISTINCT COALESCE(vt2.worker_id, wl2.worker_id) FROM vuot_link_tasks vt2 LEFT JOIN worker_links wl2 ON wl2.id = vt2.worker_link_id WHERE vt2.visitor_id = ?)`;
        params.push(s);
      } else if (isSlug) {
        searchWhere = ` AND (u.name LIKE ? OR u.email LIKE ? OR u.id IN (SELECT worker_id FROM worker_links WHERE slug = ?))`;
        params.push(`%${s}%`, `%${s}%`, s);
      } else {
        searchWhere = ` AND (u.name LIKE ? OR u.email LIKE ?)`;
        params.push(`%${s}%`, `%${s}%`);
      }
    }

    let timeWhere = '';
    const timeParams = [];
    if (from) { timeWhere += ` AND vt.created_at >= ?`; timeParams.push(from); }
    if (to) { timeWhere += ` AND vt.created_at <= ?`; timeParams.push(to + ' 23:59:59'); }


    const sortMap = { ok: 'ok', blocked: 'blocked', earned: 'earned', total: 'total', last_at: 'last_at' };
    const orderCol = sortMap[sort] || 'ok';

    let cnt;
    let rows;
    if (!search) {
      [cnt] = await pool.execute(
        `SELECT COUNT(*) as total
         FROM (
           SELECT COALESCE(vt.worker_id, wl.worker_id) as actual_worker_id
           FROM vuot_link_tasks vt
           LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
           WHERE COALESCE(vt.worker_id, wl.worker_id) IS NOT NULL${timeWhere}
           GROUP BY actual_worker_id
         ) active_workers`,
        timeParams
      );

      [rows] = await pool.execute(
        `SELECT
           u.id as worker_id,
           u.name,
           u.email,
           u.status,
           u.avatar_url,
           vt_aggr.total,
           vt_aggr.ok,
           vt_aggr.blocked,
           vt_aggr.expired,
           vt_aggr.pending,
           vt_aggr.earned,
           vt_aggr.last_at,
           vt_aggr.ips
         FROM (
           SELECT
             COALESCE(vt.worker_id, wl.worker_id) as actual_worker_id,
             COUNT(*) as total,
             CAST(SUM(CASE WHEN vt.status = 'completed' THEN 1 ELSE 0 END) AS UNSIGNED) as ok,
             CAST(SUM(CASE WHEN vt.bot_detected = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as blocked,
             CAST(SUM(CASE WHEN vt.status = 'expired' THEN 1 ELSE 0 END) AS UNSIGNED) as expired,
             CAST(SUM(CASE WHEN vt.status IN ('pending','step1','step2','step3') THEN 1 ELSE 0 END) AS UNSIGNED) as pending,
             SUM(vt.earning) as earned,
             MAX(vt.created_at) as last_at,
             GROUP_CONCAT(DISTINCT vt.ip_address SEPARATOR ',') as ips
           FROM vuot_link_tasks vt
           LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
           WHERE COALESCE(vt.worker_id, wl.worker_id) IS NOT NULL${timeWhere}
           GROUP BY actual_worker_id
           ORDER BY ${orderCol} DESC, last_at DESC
           LIMIT ? OFFSET ?
         ) vt_aggr
         JOIN users u ON u.id = vt_aggr.actual_worker_id
         ORDER BY ${orderCol} DESC, last_at DESC`,
        [...timeParams, Number(limit), offset]
      );
    } else {
      [cnt] = await pool.execute(
        `SELECT COUNT(*) as total FROM users u WHERE 1=1${searchWhere}`, params
      );

      [rows] = await pool.execute(
        `SELECT
           u.id as worker_id,
           u.name,
           u.email,
           u.status,
           u.avatar_url,
           COALESCE(vt_aggr.total, 0) as total,
           COALESCE(vt_aggr.ok, 0) as ok,
           COALESCE(vt_aggr.blocked, 0) as blocked,
           COALESCE(vt_aggr.expired, 0) as expired,
           COALESCE(vt_aggr.pending, 0) as pending,
           COALESCE(vt_aggr.earned, 0) as earned,
           vt_aggr.last_at,
           vt_aggr.ips
         FROM users u
         LEFT JOIN (
             SELECT
               COALESCE(vt.worker_id, wl.worker_id) as actual_worker_id,
               COUNT(*) as total,
               CAST(SUM(CASE WHEN vt.status = 'completed' THEN 1 ELSE 0 END) AS UNSIGNED) as ok,
               CAST(SUM(CASE WHEN vt.bot_detected = 1 THEN 1 ELSE 0 END) AS UNSIGNED) as blocked,
               CAST(SUM(CASE WHEN vt.status = 'expired' THEN 1 ELSE 0 END) AS UNSIGNED) as expired,
               CAST(SUM(CASE WHEN vt.status IN ('pending','step1','step2','step3') THEN 1 ELSE 0 END) AS UNSIGNED) as pending,
               SUM(vt.earning) as earned,
               MAX(vt.created_at) as last_at,
               GROUP_CONCAT(DISTINCT vt.ip_address SEPARATOR ',') as ips
             FROM vuot_link_tasks vt
             LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
             WHERE 1=1 ${timeWhere}
             GROUP BY actual_worker_id
         ) vt_aggr ON vt_aggr.actual_worker_id = u.id
         WHERE 1=1${searchWhere}
         ORDER BY ${orderCol} DESC, last_at DESC
         LIMIT ? OFFSET ?`,
        [...timeParams, ...params, Number(limit), offset]
      );
    }


    const ids = rows.map(r => r.worker_id).filter(Boolean);
    const secMap = {};
    if (ids.length > 0) {
      const ph = ids.map(() => '?').join(',');
      let vtDateWhere = '';
      let slDateWhere = '';
      const vtDateParams = [];
      const slDateParams = [];
      if (from) { vtDateWhere += ` AND vt.created_at >= ?`; vtDateParams.push(from); slDateWhere += ` AND sl.created_at >= ?`; slDateParams.push(from); }
      if (to) { vtDateWhere += ` AND vt.created_at <= ?`; vtDateParams.push(to + ' 23:59:59'); slDateWhere += ` AND sl.created_at <= ?`; slDateParams.push(to + ' 23:59:59'); }

      // ── Batch 1: Bot tasks gắn đúng với worker (không qua IP) ──
      const [botTaskRows] = await pool.execute(
        `SELECT COALESCE(vt.worker_id, wl.worker_id) as uid,
                COUNT(DISTINCT CONCAT(vt.ip_address, '|', COALESCE(vt.visitor_id,''))) as cnt
         FROM vuot_link_tasks vt
         LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
         WHERE COALESCE(vt.worker_id, wl.worker_id) IN (${ph})
           AND vt.bot_detected = 1${vtDateWhere}
         GROUP BY uid`,
        [...ids, ...vtDateParams]
      );
      botTaskRows.forEach(r => { if (r.uid) secMap[r.uid] = Number(r.cnt); });

      // ── Batch 2: Security logs theo cặp IP/visitor của page hiện tại ──
      const [slRows] = await pool.execute(
        `SELECT pairs.uid,
                COUNT(DISTINCT CONCAT(sl.ip_address, '|', COALESCE(sl.visitor_id,''))) as cnt
         FROM (
           SELECT COALESCE(vt.worker_id, wl.worker_id) as uid,
                  vt.ip_address,
                  COALESCE(vt.visitor_id, '') as visitor_id,
                  MAX(CASE WHEN vt.bot_detected = 1 THEN 1 ELSE 0 END) as has_bot
           FROM vuot_link_tasks vt
           LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
           WHERE COALESCE(vt.worker_id, wl.worker_id) IN (${ph})
             AND vt.ip_address IS NOT NULL
             AND vt.ip_address != ''${vtDateWhere}
           GROUP BY uid, vt.ip_address, COALESCE(vt.visitor_id, '')
         ) pairs
         JOIN security_logs sl
           ON sl.ip_address = pairs.ip_address
          AND COALESCE(sl.visitor_id, '') = pairs.visitor_id
         WHERE pairs.has_bot = 0
           AND sl.reason != 'completed'${slDateWhere}
         GROUP BY pairs.uid`,
        [...ids, ...vtDateParams, ...slDateParams]
      );
      slRows.forEach(r => {
        if (r.uid) secMap[r.uid] = (secMap[r.uid] || 0) + Number(r.cnt);
      });
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
    const { page = 1, limit = 50, ip, visitorId, slug, from, to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const baseWhere = `(vt.worker_id = ? OR vt.worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?))`;
    const baseParams = [uid, uid];
    let extraWhere = '';
    const extraParams = [];
    if (ip) { extraWhere += ` AND vt.ip_address LIKE ?`; extraParams.push(`%${ip.trim()}%`); }
    if (visitorId) { extraWhere += ` AND vt.visitor_id = ?`; extraParams.push(visitorId.trim()); }
    if (slug) { extraWhere += ` AND wl.slug = ?`; extraParams.push(slug.trim()); }
    if (from) { extraWhere += ` AND vt.created_at >= ?`; extraParams.push(from); }
    if (to) { extraWhere += ` AND vt.created_at <= ?`; extraParams.push(to + ' 23:59:59'); }

    const [cnt] = await pool.execute(
      `SELECT COUNT(*) as total FROM vuot_link_tasks vt
       LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
       WHERE ${baseWhere}${extraWhere}`,
      [...baseParams, ...extraParams]
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
       WHERE ${baseWhere}${extraWhere}
       ORDER BY vt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...baseParams, ...extraParams, Number(limit), offset]
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
    const uid = req.params.uid;
    const { page = 1, limit = 50, from, to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let ipDateWhere = '';
    const ipDateParams = [uid, uid];
    if (from) { ipDateWhere += ` AND created_at >= ?`; ipDateParams.push(from); }
    if (to) { ipDateWhere += ` AND created_at <= ?`; ipDateParams.push(to + ' 23:59:59'); }

    const [ipRows] = await pool.execute(
      `SELECT DISTINCT ip_address FROM vuot_link_tasks
       WHERE (worker_id = ? OR worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?))${ipDateWhere}`,
      ipDateParams
    );
    const ips = ipRows.map(r => r.ip_address).filter(Boolean);

    let allEvents = [];

    if (ips.length) {
      const ph = ips.map(() => '?').join(',');
      // Thêm filter ngày cho security_logs
      let slDateWhere = '';
      const slDateParams = [];
      if (from) { slDateWhere += ` AND sl.created_at >= ?`; slDateParams.push(from); }
      if (to) { slDateWhere += ` AND sl.created_at <= ?`; slDateParams.push(to + ' 23:59:59'); }

      const [logRows] = await pool.execute(
        `SELECT sl.id, sl.source, sl.reason, sl.ip_address, sl.user_agent, sl.visitor_id,
                sl.details, sl.created_at,
                vt.target_url,
                wl.slug as gateway_slug
         FROM security_logs sl
         LEFT JOIN vuot_link_tasks vt ON (
           vt.ip_address = sl.ip_address
           AND (vt.visitor_id = sl.visitor_id OR (vt.visitor_id IS NULL AND sl.visitor_id IS NULL))
           AND ABS(TIMESTAMPDIFF(SECOND, vt.created_at, sl.created_at)) < 300
           AND (vt.worker_id = ? OR vt.worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?))
         )
         LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
         WHERE sl.ip_address IN (${ph}) AND sl.reason != 'completed'${slDateWhere}
         ORDER BY sl.created_at DESC LIMIT 500`,
        [uid, uid, ...ips, ...slDateParams]
      );
      allEvents.push(...logRows);
    }

    // Thêm filter ngày cho bot tasks
    let btDateWhere = '';
    const btDateParams = [uid, uid];
    if (from) { btDateWhere += ` AND vt.created_at >= ?`; btDateParams.push(from); }
    if (to) { btDateWhere += ` AND vt.created_at <= ?`; btDateParams.push(to + ' 23:59:59'); }

    const [botTaskRows] = await pool.execute(
      `SELECT vt.id, 'vuotlink' as source,
              vt.ip_address, vt.user_agent, vt.visitor_id,
              vt.security_detail as details,
              vt.created_at, vt.target_url, wl.slug as gateway_slug
       FROM vuot_link_tasks vt
       LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
       WHERE (vt.worker_id = ? OR vt.worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?))
         AND vt.bot_detected = 1${btDateWhere}
         AND NOT EXISTS (
           SELECT 1 FROM security_logs sl
           WHERE sl.ip_address = vt.ip_address
             AND sl.reason LIKE '%Bot%'
             AND ABS(TIMESTAMPDIFF(SECOND, sl.created_at, vt.created_at)) < 300
         )
       ORDER BY vt.created_at DESC LIMIT 200`,
      btDateParams
    );

    botTaskRows.forEach(r => {
      allEvents.push({ ...r, reason: 'Phát hiện Bot (task)' });
    });

    allEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // ── Dedup: gộp events cùng IP + visitor_id thành 1 dòng ──
    const groupMap = new Map();
    for (const ev of allEvents) {
      const key = `${ev.ip_address}|${ev.visitor_id || ''}`;
      if (groupMap.has(key)) {
        groupMap.get(key).occurrences.push({
          id: ev.id, created_at: ev.created_at, details: ev.details,
          target_url: ev.target_url, gateway_slug: ev.gateway_slug,
          reason: ev.reason,
        });
        groupMap.get(key).count++;
      } else {
        groupMap.set(key, {
          ...ev,
          count: 1,
          occurrences: [{
            id: ev.id, created_at: ev.created_at, details: ev.details,
            target_url: ev.target_url, gateway_slug: ev.gateway_slug,
            reason: ev.reason,
          }],
        });
      }
    }
    const dedupedEvents = Array.from(groupMap.values());
    dedupedEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = dedupedEvents.length;
    const events = dedupedEvents.slice(offset, offset + Number(limit));

    res.json({ events, total, page: Number(page), limit: Number(limit) });
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
    const { status, page = 1, limit = 30, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Include both worker earning withdrawals AND buyer commission withdrawals
    let where = "t.type = 'withdraw' AND t.wallet_type IN ('earning', 'commission')";
    const params = [];
    if (status && status !== 'all') { where += ' AND t.status = ?'; params.push(status); }
    if (search.trim()) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR t.ref_code LIKE ? OR t.note LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    const [countR] = await pool.execute(
      `SELECT COUNT(*) as c FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE ${where}`, params
    );
    const [rows] = await pool.execute(
      `SELECT t.*, u.name as user_name, u.email as user_email, u.service_type
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
        "SELECT * FROM transactions WHERE id = ? AND type = 'withdraw' AND wallet_type IN ('earning','commission') FOR UPDATE",
        [id]
      );
      if (!txs[0] || txs[0].status !== 'pending') continue;

      const tx = txs[0];
      const isCrypto = (tx.note || '').includes('[Crypto]');
      const isCommission = tx.wallet_type === 'commission';

      // Auto crypto payment only for worker earning withdrawals
      if (isWeb3Active && isCrypto && !isCommission) {
        cryptoIdsToPay.push(tx.id);
        processedIds.push(id);
        continue;
      }


      const newStatus = action === 'approve' ? 'completed' : 'rejected';
      await conn.execute('UPDATE transactions SET status = ? WHERE id = ?', [newStatus, tx.id]);

      if (action === 'reject') {
        // Refund to correct wallet
        await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?', [tx.amount, tx.user_id, tx.wallet_type]);
      }


      const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [
          tx.user_id,
          action === 'approve'
            ? (isCommission ? 'Rút hoa hồng thành công' : 'Rút tiền thành công')
            : (isCommission ? 'Rút hoa hồng bị từ chối' : 'Rút tiền bị từ chối'),
          action === 'approve'
            ? `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) đã được duyệt.`
            : `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) bị từ chối. Số tiền đã hoàn lại ví.`,
          action === 'approve' ? 'success' : 'warning',
          isCommission ? 'buyer' : 'worker',
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
      const [txsCheck] = await pool.execute('SELECT note, wallet_type FROM transactions WHERE id = ?', [req.params.id]);
      // Only attempt auto crypto payment for earning wallet (worker), not commission
      if (txsCheck.length > 0 && txsCheck[0].wallet_type === 'earning' && (txsCheck[0].note || '').includes('[Crypto]')) {
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

    // Support both earning (worker) and commission (buyer) withdrawals
    const [txs] = await conn.execute(
      "SELECT * FROM transactions WHERE id = ? AND type = 'withdraw' AND wallet_type IN ('earning','commission') FOR UPDATE",
      [req.params.id]
    );
    if (!txs[0]) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Không tìm thấy' }); }
    const tx = txs[0];
    if (tx.status !== 'pending') { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Đã xử lý rồi' }); }

    const newStatus = action === 'approve' ? 'completed' : 'rejected';
    await conn.execute('UPDATE transactions SET status = ? WHERE id = ?', [newStatus, tx.id]);

    if (action === 'reject') {
      // Refund to the correct wallet (earning for worker, commission for buyer)
      await conn.execute(
        'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
        [tx.amount, tx.user_id, tx.wallet_type]
      );
      // Ghi lại transaction hoàn tiền để tính số dư từ transactions luôn đúng
      await conn.execute(
        `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
         VALUES (?, ?, 'deposit', 'refund', ?, 'completed', ?, ?)`,
        [tx.user_id, tx.wallet_type, tx.amount, 'REFUND-' + tx.ref_code,
        `Hoàn tiền rút bị từ chối (${tx.ref_code})`]
      );
    }

    const isCommission = tx.wallet_type === 'commission';
    const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id,
      action === 'approve'
        ? (isCommission ? 'Rút hoa hồng thành công' : 'Rút tiền thành công')
        : (isCommission ? 'Rút hoa hồng bị từ chối' : 'Rút tiền bị từ chối'),
      action === 'approve'
        ? `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) đã được duyệt.`
        : `Yêu cầu rút ${fmtAmount} đ (${tx.ref_code}) bị từ chối. Số tiền đã hoàn lại ví.`,
      action === 'approve' ? 'success' : 'warning',
      isCommission ? 'buyer' : 'worker',
      ]
    );

    await conn.commit();
    conn.release();
    res.json({ message: action === 'approve' ? 'Đã duyệt' : 'Đã từ chối và hoàn tiền' });
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
        const r = await getWeb3Pay().processAutoPayment(row.id, pk);
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
       (SELECT email FROM users WHERE id = r.referred_by) as referred_by_email,
       COALESCE((
         SELECT SUM(t.amount) FROM transactions t
         WHERE t.user_id = r.id AND t.wallet_type = 'commission'
           AND t.type = 'commission' AND t.status = 'completed'
       ), 0) as total_commission
       FROM users r
       WHERE ${where}
       ORDER BY total_commission DESC, ref_count DESC, r.created_at DESC
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
    const [[commRow]] = await pool.execute(
      `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t
       INNER JOIN users u ON t.user_id = u.id
       WHERE u.service_type = ? AND t.wallet_type = 'commission'
         AND t.type = 'commission' AND t.status = 'completed'`,
      [serviceType]
    );

    res.json({
      referrers,
      total: countRow[0].c,
      page: Number(page),
      limit: Number(limit),
      totalReferrers: totalReferrers[0].c,
      totalReferred: totalReferred[0].c,
      totalCommissionPaid: Number(commRow.total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/referrals/:type/:userId', async (req, res) => {
  try {
    const pool = getPool();
    const [referred] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.service_type, u.status, u.created_at,
       COALESCE((
         SELECT SUM(t.amount) FROM transactions t
         WHERE t.user_id = ? AND t.wallet_type = 'commission'
           AND t.type = 'commission' AND t.status = 'completed'
           AND t.note LIKE CONCAT('%', u.email, '%')
       ), 0) as contributed_commission
       FROM users u WHERE u.referred_by = ? ORDER BY u.created_at DESC`,
      [req.params.userId, req.params.userId]
    );
    // Also get referrer's total commission
    const [[commRow]] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE user_id = ? AND wallet_type = 'commission' AND type = 'commission' AND status = 'completed'`,
      [req.params.userId]
    );
    res.json({ referred, totalCommission: Number(commRow.total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Withdrawal addresses: admin xem & phát hiện trùng lặp ──
router.get('/withdrawal-addresses', async (req, res) => {
  try {
    const pool = getPool();
    const { duplicates_only } = req.query;

    // Lấy tất cả địa chỉ rút tiền gần nhất từ note của transactions
    const [rows] = await pool.execute(
      `SELECT
         u.id as user_id, u.name as user_name, u.email as user_email,
         t.method,
         t.note,
         t.created_at as last_used
       FROM transactions t
       INNER JOIN users u ON t.user_id = u.id
       WHERE t.type = 'withdraw' AND t.wallet_type = 'earning'
         AND t.note IS NOT NULL
       ORDER BY t.created_at DESC`
    );

    // Tổng tiền rút theo user_id (all statuses & completed only)
    const [withdrawTotals] = await pool.execute(
      `SELECT
         user_id,
         COALESCE(SUM(amount), 0) as total_all,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_completed,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
         COUNT(*) as withdraw_count
       FROM transactions
       WHERE type = 'withdraw' AND wallet_type = 'earning'
       GROUP BY user_id`
    );
    const withdrawMap = {};
    withdrawTotals.forEach(r => {
      withdrawMap[r.user_id] = {
        total_all: Number(r.total_all),
        total_completed: Number(r.total_completed),
        total_pending: Number(r.total_pending),
        withdraw_count: Number(r.withdraw_count),
      };
    });

    // Parse địa chỉ từ note
    const addressMap = {}; // address -> [{user_id, user_name, user_email, method, last_used}]
    const userLatest = {}; // user_id+method -> already captured

    for (const row of rows) {
      const note = row.note || '';
      let address = null;
      let displayInfo = null;

      if (note.startsWith('[Bank]')) {
        // [Bank] BankName - AccountNumber - AccountName | Nguồn: ...
        const match = note.match(/^\[Bank\]\s*(.+?)\s*\|/);
        if (match) {
          const parts = match[1].split(' - ');
          address = parts[1] ? parts[1].trim() : ''; // account number
          displayInfo = match[1].trim();
        }
      } else if (note.startsWith('[Crypto]')) {
        // [Crypto] Network - WalletAddress | Nguồn: ...
        const match = note.match(/^\[Crypto\]\s*(.+?)\s*\|/);
        if (match) {
          const parts = match[1].split(' - ');
          address = parts[1] ? parts[1].trim() : ''; // wallet address
          displayInfo = match[1].trim();
        }
      }

      if (!address) continue;
      const key = `${row.user_id}-${row.method}`;
      if (userLatest[key]) continue; // chỉ lấy giao dịch mới nhất mỗi user/method
      userLatest[key] = true;

      const wStats = withdrawMap[row.user_id] || { total_all: 0, total_completed: 0, total_pending: 0, withdraw_count: 0 };

      if (!addressMap[address]) addressMap[address] = [];
      addressMap[address].push({
        user_id: row.user_id,
        user_name: row.user_name,
        user_email: row.user_email,
        method: row.method,
        display_info: displayInfo,
        address,
        last_used: row.last_used,
        total_withdrawn: wStats.total_all,
        total_withdrawn_completed: wStats.total_completed,
        total_withdrawn_pending: wStats.total_pending,
        withdraw_count: wStats.withdraw_count,
      });
    }

    const allAddresses = Object.entries(addressMap).map(([addr, users]) => ({
      address: addr,
      users,
      count: users.length,
      is_duplicate: users.length > 1,
      method: users[0] ? users[0].method : undefined,
    }));

    const result = duplicates_only === '1'
      ? allAddresses.filter(a => a.is_duplicate)
      : allAddresses;

    result.sort((a, b) => b.count - a.count || b.address.localeCompare(a.address));

    res.json({
      addresses: result,
      total: result.length,
      duplicateCount: allAddresses.filter(a => a.is_duplicate).length,
    });
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

    // ── Batch fetch detectionTypes cho tất cả suspects (tránh N+1 loop) ──
    const suspectIds = suspects.map(r => r.id);
    const detectionMap = {}; // userId -> { detectionType: count }
    if (suspectIds.length > 0) {
      const ph = suspectIds.map(() => '?').join(',');
      const [detRows] = await pool.execute(
        `SELECT COALESCE(vt.worker_id, wl.worker_id) as uid,
                JSON_EXTRACT(vt.security_detail, '$.detectionLog') as dl_raw
         FROM vuot_link_tasks vt
         LEFT JOIN worker_links wl ON wl.id = vt.worker_link_id
         WHERE COALESCE(vt.worker_id, wl.worker_id) IN (${ph})
           AND vt.bot_detected = 1
           AND vt.security_detail IS NOT NULL`,
        suspectIds
      );
      detRows.forEach(r => {
        if (!r.uid) return;
        if (!detectionMap[r.uid]) detectionMap[r.uid] = {};
        try {
          const dl = JSON.parse(r.dl_raw || '[]');
          if (Array.isArray(dl)) {
            dl.forEach(d => { detectionMap[r.uid][d] = (detectionMap[r.uid][d] || 0) + 1; });
          }
        } catch { }
      });
    }

    const result = suspects.map(row => ({
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
      detectionTypes: detectionMap[row.id] || {},
      riskScore: Math.min(100,
        Number(row.bot_tasks) * 5 +
        Number(row.bot_completed) * 10 +
        (Number(row.pending_withdrawals) > 0 ? 20 : 0)
      ),
    }));


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
        // Xóa cache ngay để ban có hiệu lực tức thì
        invalidateUserCache(Number(uid));


        let rejectedWithdrawals = 0;
        if (rejectWithdrawals) {
          const [txs] = await pool.execute(
            "SELECT id, amount FROM transactions WHERE user_id = ? AND type = 'withdraw' AND status = 'pending' AND wallet_type = 'earning'",
            [uid]
          );
          for (const tx of txs) {
            await pool.execute(
              "UPDATE transactions SET status = 'rejected', note = 'Từ chối tự động - tài khoản gian lận' WHERE id = ?",
              [tx.id]
            );
            // Hoàn tiền lại ví earning vì tiền đã bị trừ khi worker tạo lệnh rút
            await pool.execute(
              'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
              [tx.amount, uid, 'earning']
            );
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


// ─────────────────────────────────────────────────────────────────────
// WORKER PRICING GROUPS — CRUD + member assignment
// ─────────────────────────────────────────────────────────────────────

// Auto-create table nếu chưa có (chạy 1 lần khi route được dùng)
let _pgTableReady = false;
async function ensurePgTables(pool) {
  if (_pgTableReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS worker_pricing_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS worker_pricing_group_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      traffic_type VARCHAR(50) NOT NULL,
      duration VARCHAR(20) NOT NULL,
      v1_price DECIMAL(15,0) DEFAULT 0,
      v2_price DECIMAL(15,0) DEFAULT 0,
      UNIQUE KEY uniq_rate (group_id, traffic_type, duration),
      FOREIGN KEY (group_id) REFERENCES worker_pricing_groups(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Add pricing_group_id to users if missing
  try {
    await pool.execute(`ALTER TABLE users ADD COLUMN pricing_group_id INT NULL DEFAULT NULL`);
  } catch (e) { /* column already exists */ }
  _pgTableReady = true;
}

// GET /admin/pricing-groups — list all groups with member count
router.get('/pricing-groups', async (req, res) => {
  const pool = getPool();
  try {
    await ensurePgTables(pool);
    const [groups] = await pool.execute(`
      SELECT g.*, COUNT(u.id) as member_count
      FROM worker_pricing_groups g
      LEFT JOIN users u ON u.pricing_group_id = g.id
      GROUP BY g.id ORDER BY g.created_at DESC`);
    res.json({ groups });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /admin/pricing-groups — create group
router.post('/pricing-groups', async (req, res) => {
  const pool = getPool();
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Tên nhóm không được để trống' });
  try {
    await ensurePgTables(pool);
    const [r] = await pool.execute(
      'INSERT INTO worker_pricing_groups (name, description) VALUES (?, ?)',
      [name.trim(), description || '']
    );
    // Clone default rates from worker_pricing_tiers
    let tiers = [];
    try {
      [tiers] = await pool.execute('SELECT * FROM worker_pricing_tiers');
    } catch (e) { }
    for (const t of tiers) {
      await pool.execute(
        'INSERT IGNORE INTO worker_pricing_group_rates (group_id, traffic_type, duration, v1_price, v2_price) VALUES (?,?,?,?,?)',
        [r.insertId, t.traffic_type, t.duration, t.v1_price || 0, t.v2_price || 0]
      );
    }
    const [rows] = await pool.execute('SELECT * FROM worker_pricing_groups WHERE id = ?', [r.insertId]);
    res.status(201).json({ group: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /admin/pricing-groups/:id — rename/desc group
router.put('/pricing-groups/:id', async (req, res) => {
  const pool = getPool();
  const { name, description } = req.body;
  try {
    await pool.execute('UPDATE worker_pricing_groups SET name=COALESCE(?,name), description=COALESCE(?,description) WHERE id=?',
      [name || null, description !== undefined ? description : null, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /admin/pricing-groups/:id — delete group (unassign members)
router.delete('/pricing-groups/:id', async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('UPDATE users SET pricing_group_id = NULL WHERE pricing_group_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM worker_pricing_groups WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/pricing-groups/:id/rates — get rates for group
router.get('/pricing-groups/:id/rates', async (req, res) => {
  const pool = getPool();
  try {
    await ensurePgTables(pool);
    const [rates] = await pool.execute(
      'SELECT * FROM worker_pricing_group_rates WHERE group_id = ? ORDER BY traffic_type, CAST(REPLACE(duration,\'s\',\'\') AS UNSIGNED)',
      [req.params.id]
    );
    res.json({ rates });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /admin/pricing-groups/:id/rates — bulk update rates
router.put('/pricing-groups/:id/rates', async (req, res) => {
  const pool = getPool();
  const { rates } = req.body; // [{traffic_type, duration, v1_price, v2_price}]
  if (!Array.isArray(rates)) return res.status(400).json({ error: 'rates must be array' });
  try {
    await ensurePgTables(pool);
    for (const r of rates) {
      await pool.execute(
        `INSERT INTO worker_pricing_group_rates (group_id, traffic_type, duration, v1_price, v2_price)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE v1_price=VALUES(v1_price), v2_price=VALUES(v2_price)`,
        [req.params.id, r.traffic_type, r.duration, Number(r.v1_price) || 0, Number(r.v2_price) || 0]
      );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/pricing-groups/:id/members — list workers in group
router.get('/pricing-groups/:id/members', async (req, res) => {
  const pool = getPool();
  try {
    const [members] = await pool.execute(
      `SELECT id, name, email, created_at FROM users WHERE pricing_group_id = ? ORDER BY name ASC`,
      [req.params.id]
    );
    res.json({ members });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /admin/pricing-groups/:id/members — assign worker(s) to group
router.post('/pricing-groups/:id/members', async (req, res) => {
  const pool = getPool();
  const { userIds } = req.body; // array of user IDs
  if (!Array.isArray(userIds) || userIds.length === 0)
    return res.status(400).json({ error: 'userIds array required' });
  try {
    const ph = userIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE users SET pricing_group_id = ? WHERE id IN (${ph})`,
      [req.params.id, ...userIds]
    );
    res.json({ ok: true, updated: userIds.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /admin/pricing-groups/:id/members/:userId — remove worker from group
router.delete('/pricing-groups/:id/members/:userId', async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute(
      'UPDATE users SET pricing_group_id = NULL WHERE id = ? AND pricing_group_id = ?',
      [req.params.userId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/pricing-groups/workers-without-group — users not in any group
router.get('/pricing-groups-unassigned', async (req, res) => {
  const pool = getPool();
  const search = (req.query.search || '').trim();
  try {
    await ensurePgTables(pool);
    let sql = `SELECT id, name, email FROM users WHERE (pricing_group_id IS NULL)`;
    const params = [];
    if (search) { sql += ' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY name ASC LIMIT 50';
    const [rows] = await pool.execute(sql, params);
    res.json({ users: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/pricing-groups-all-workers — all workers with current group info (for move assignment)
router.get('/pricing-groups-all-workers', async (req, res) => {
  const pool = getPool();
  const search = (req.query.search || '').trim();
  try {
    await ensurePgTables(pool);
    let sql = `SELECT u.id, u.name, u.email, u.pricing_group_id,
                 g.name as group_name
               FROM users u
               LEFT JOIN worker_pricing_groups g ON g.id = u.pricing_group_id
               WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY u.name ASC LIMIT 100';
    const [rows] = await pool.execute(sql, params);
    res.json({ users: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// Blog Management
// ═══════════════════════════════════════════════════════

async function ensureBlogCmsColumns(pool) {
  const columns = [
    ['seo_title', 'TEXT DEFAULT NULL'],
    ['seo_description', 'TEXT DEFAULT NULL'],
    ['focus_keyword', 'VARCHAR(255) DEFAULT NULL'],
    ['cover_alt', 'VARCHAR(500) DEFAULT NULL'],
    ['category', 'VARCHAR(100) DEFAULT NULL'],
    ['content_assets', 'LONGTEXT DEFAULT NULL'],
    ['scheduled_at', 'DATETIME DEFAULT NULL'],
  ];
  for (const [name, definition] of columns) {
    try { await pool.execute(`ALTER TABLE blog_posts ADD COLUMN ${name} ${definition}`); } catch (_) { }
  }
}

function getBlogUploadTools() {
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'blog');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const safeName = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 50) || 'image';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'blog-' + safeName + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
  });
  return {
    fs,
    uploadsDir,
    upload: multer({
      storage,
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Chỉ chấp nhận file ảnh')),
    })
  };
}

// POST /admin/upload-image — upload blog/media image
router.post('/upload-image', async (req, res) => {
  try {
    const { upload } = getBlogUploadTools();
    upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'Không có file được upload' });
      const url = '/uploads/blog/' + req.file.filename;
      res.json({
        url,
        asset: { url, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size, type: req.file.mimetype }
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/media/blog', async (req, res) => {
  try {
    const { fs, uploadsDir } = getBlogUploadTools();
    const files = fs.readdirSync(uploadsDir)
      .filter(name => /\.(png|jpe?g|gif|webp|svg)$/i.test(name))
      .map(name => {
        const stat = fs.statSync(require('path').join(uploadsDir, name));
        return { filename: name, url: '/uploads/blog/' + name, size: stat.size, createdAt: stat.mtime };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 80);
    res.json({ assets: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/blog — list all blog posts
router.get('/blog', async (req, res) => {
  const pool = getPool();
  try {
    await ensureBlogCmsColumns(pool);
    const [posts] = await pool.execute(
      'SELECT * FROM blog_posts ORDER BY created_at DESC'
    );
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/blog/:id — get single post
router.get('/blog/:id', async (req, res) => {
  const pool = getPool();
  try {
    await ensureBlogCmsColumns(pool);
    const [posts] = await pool.execute(
      'SELECT * FROM blog_posts WHERE id = ?',
      [req.params.id]
    );
    if (posts.length === 0) {
      return res.status(404).json({ error: 'Bài viết không tồn tại' });
    }
    res.json({ post: posts[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/blog — create new post
router.post('/blog', async (req, res) => {
  const pool = getPool();
  const {
    title, slug, excerpt, content, cover, tag, tag_color,
    author, read_time, gradient, status,
    seo_title, seo_description, focus_keyword, cover_alt,
    category, content_assets, scheduled_at
  } = req.body;

  try {
    await ensureBlogCmsColumns(pool);
    // Check if slug already exists
    const [existing] = await pool.execute(
      'SELECT id FROM blog_posts WHERE slug = ?',
      [slug]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Slug đã tồn tại' });
    }

    const published_at = status === 'published' ? new Date() : null;
    const scheduledAt = scheduled_at || null;

    const [result] = await pool.execute(
      `INSERT INTO blog_posts
       (title, slug, excerpt, content, cover, tag, tag_color, author, read_time, gradient, status, published_at, seo_title, seo_description, focus_keyword, cover_alt, category, content_assets, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, excerpt, content, cover || null, tag, tag_color, author, read_time, gradient, status, published_at, seo_title || null, seo_description || null, focus_keyword || null, cover_alt || null, category || null, content_assets || null, scheduledAt]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/blog/:id — update post
router.put('/blog/:id', async (req, res) => {
  const pool = getPool();
  const {
    title, slug, excerpt, content, cover, tag, tag_color,
    author, read_time, gradient, status,
    seo_title, seo_description, focus_keyword, cover_alt,
    category, content_assets, scheduled_at
  } = req.body;

  try {
    await ensureBlogCmsColumns(pool);
    // Check if slug exists for other posts
    const [existing] = await pool.execute(
      'SELECT id FROM blog_posts WHERE slug = ? AND id != ?',
      [slug, req.params.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Slug đã tồn tại' });
    }

    // Get current post to check if status changed
    const [current] = await pool.execute(
      'SELECT status, published_at FROM blog_posts WHERE id = ?',
      [req.params.id]
    );
    if (current.length === 0) {
      return res.status(404).json({ error: 'Bài viết không tồn tại' });
    }

    // Update published_at if status changed to published
    let published_at = current[0].published_at;
    if (status === 'published' && current[0].status !== 'published') {
      published_at = new Date();
    } else if (status === 'draft') {
      published_at = null;
    }

    const scheduledAt = scheduled_at || null;

    await pool.execute(
      `UPDATE blog_posts SET
       title = ?, slug = ?, excerpt = ?, content = ?, cover = ?,
       tag = ?, tag_color = ?, author = ?, read_time = ?, gradient = ?,
       status = ?, published_at = ?, seo_title = ?, seo_description = ?, focus_keyword = ?, cover_alt = ?, category = ?, content_assets = ?, scheduled_at = ?
       WHERE id = ?`,
      [title, slug, excerpt, content, cover || null, tag, tag_color, author, read_time, gradient, status, published_at, seo_title || null, seo_description || null, focus_keyword || null, cover_alt || null, category || null, content_assets || null, scheduledAt, req.params.id]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/blog/:id — delete post
router.delete('/blog/:id', async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/check-missing-payments — kiểm tra các task completed nhưng thiếu payment
router.get('/check-missing-payments', async (req, res) => {
  const pool = getPool();
  const hours = parseInt(req.query.hours) || 24;

  try {
    // 1. Tổng số task có earning
    const [totalStats] = await pool.execute(
      `SELECT COUNT(*) as total_tasks, SUM(earning) as total_earning
       FROM vuot_link_tasks
       WHERE status = 'completed'
         AND completed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND bot_detected = 0
         AND is_over_limit = 0
         AND earning > 0`,
      [hours]
    );

    // 2. Tìm task thiếu payment (Case 1: Direct worker)
    const [missingDirect] = await pool.execute(
      `SELECT t.id, t.worker_id, t.earning, t.completed_at, t.keyword, c.name as campaign_name
       FROM vuot_link_tasks t
       JOIN campaigns c ON t.campaign_id = c.id
       WHERE t.status = 'completed'
         AND t.completed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND t.bot_detected = 0
         AND t.is_over_limit = 0
         AND t.earning > 0
         AND t.worker_id IS NOT NULL
         AND t.worker_link_id IS NULL
         AND NOT EXISTS (
             SELECT 1 FROM transactions tx
             WHERE tx.user_id = t.worker_id
               AND tx.wallet_type = 'earning'
               AND tx.note LIKE CONCAT('%#', t.id)
               AND tx.status = 'completed'
         )
       ORDER BY t.completed_at DESC
       LIMIT 50`,
      [hours]
    );

    // 3. Tìm task thiếu payment (Case 2: Gateway link)
    const [missingGateway] = await pool.execute(
      `SELECT t.id, t.worker_link_id, wl.worker_id as gateway_owner, wl.slug,
              t.earning, t.completed_at, t.keyword
       FROM vuot_link_tasks t
       JOIN worker_links wl ON t.worker_link_id = wl.id
       WHERE t.status = 'completed'
         AND t.completed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND t.bot_detected = 0
         AND t.is_over_limit = 0
         AND t.earning > 0
         AND t.worker_link_id IS NOT NULL
         AND NOT EXISTS (
             SELECT 1 FROM transactions tx
             WHERE tx.user_id = wl.worker_id
               AND tx.wallet_type = 'earning'
               AND tx.note LIKE CONCAT('%#', t.id)
               AND tx.status = 'completed'
         )
       ORDER BY t.completed_at DESC
       LIMIT 50`,
      [hours]
    );

    // 4. Tìm task có earning = 0 (có thể do thiếu pricing group)
    const [zeroEarning] = await pool.execute(
      `SELECT t.id, t.worker_id, t.worker_link_id, t.ref_worker_id,
              t.completed_at, t.keyword, c.name as campaign_name,
              c.traffic_type, c.time_on_site, u.pricing_group_id
       FROM vuot_link_tasks t
       JOIN campaigns c ON t.campaign_id = c.id
       LEFT JOIN users u ON u.id = COALESCE(t.worker_id, t.ref_worker_id)
       WHERE t.status = 'completed'
         AND t.completed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND t.bot_detected = 0
         AND t.is_over_limit = 0
         AND t.earning = 0
         AND (t.worker_id IS NOT NULL OR t.worker_link_id IS NOT NULL OR t.ref_worker_id IS NOT NULL)
       LIMIT 50`,
      [hours]
    );

    res.json({
      summary: {
        hours,
        total_tasks: totalStats[0].total_tasks,
        total_earning: totalStats[0].total_earning,
        missing_direct: missingDirect.length,
        missing_gateway: missingGateway.length,
        zero_earning: zeroEarning.length,
        total_missing_amount: missingDirect.reduce((sum, t) => sum + Number(t.earning), 0) +
                              missingGateway.reduce((sum, t) => sum + Number(t.earning), 0)
      },
      missing_direct: missingDirect,
      missing_gateway: missingGateway,
      zero_earning: zeroEarning
    });
  } catch (err) {
    console.error('[Admin] Check missing payments error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

