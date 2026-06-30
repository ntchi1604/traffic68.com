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
    const [[campRows], [depRows], [campSpentRows], [trafficRows]] = await Promise.all([
      pool.execute(`SELECT user_id, COUNT(*) as v FROM campaigns WHERE user_id IN (${ph}) GROUP BY user_id`, uids),
      pool.execute(`SELECT user_id, COALESCE(SUM(amount),0) as v FROM transactions WHERE user_id IN (${ph}) AND wallet_type='main' AND type='deposit' AND status='completed' GROUP BY user_id`, uids),
      pool.execute(`SELECT user_id, COALESCE(SUM(amount),0) as v FROM transactions WHERE user_id IN (${ph}) AND wallet_type='main' AND type='campaign' AND status='completed' GROUP BY user_id`, uids),
      pool.execute(`SELECT user_id, COALESCE(SUM(views_done),0) as v FROM campaigns WHERE user_id IN (${ph}) GROUP BY user_id`, uids),
    ]);

    const toMap = (rows) => Object.fromEntries(rows.map(r => [r.user_id, Number(r.v)]));
    const campMap = toMap(campRows);
    const depMap = toMap(depRows);
    const campSpentMap = toMap(campSpentRows);
    const trafficMap = toMap(trafficRows);

    const enriched = users.map(u => ({
      ...u,
      balance: Number(u.main_balance) || 0,
      campaign_count: campMap[u.id] || 0,
      campaigns: campMap[u.id] || 0,
      total_deposit: depMap[u.id] || 0,
      total_campaign_spent: campSpentMap[u.id] || 0,
      total_traffic_done: trafficMap[u.id] || 0,
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
const getAgencyCampaign = async (pool, campaignId, agencyId, select = 'c.*') => {
  const [rows] = await pool.execute(
    `SELECT ${select} FROM campaigns c JOIN users u ON c.user_id = u.id WHERE c.id = ? AND u.agency_id = ?`,
    [campaignId, agencyId]
  );
  return rows[0] || null;
};

router.get('/campaigns', async (req, res) => {
  try {
    const pool = getPool();
    const aid = req.agencyId;
    const { search, status, page = 1, limit = 20, sync } = req.query;
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

    if (sync === '1') {
      try {
        const ids = campaigns.map(c => c.id);
        if (ids.length > 0) {
          const ph = ids.map(() => '?').join(',');
          try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch { /* column already exists */ }

          await pool.execute(
            `UPDATE campaigns c
             JOIN users u ON c.user_id = u.id
             SET c.views_done = (
               SELECT COUNT(*) FROM vuot_link_tasks
               WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0
             )
             WHERE c.id IN (${ph}) AND u.agency_id = ? AND c.views_done < (
               SELECT COUNT(*) FROM vuot_link_tasks
               WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0
             )`,
            [...ids, aid]
          );

          await pool.execute(
            `UPDATE campaigns c
             JOIN users u ON c.user_id = u.id
             SET c.status = 'running'
             WHERE c.id IN (${ph}) AND u.agency_id = ? AND c.status = 'completed'
               AND c.views_done < c.total_views AND COALESCE(c.manually_completed, 0) = 0`,
            [...ids, aid]
          ).catch(() => { });

          const [updated] = await pool.execute(sql, params);
          return res.json({ campaigns: updated, total, page: Number(page), limit: Number(limit) });
        }
      } catch { /* best-effort sync */ }
    }

    res.json({ campaigns, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaigns/:id', async (req, res) => {
  try {
    const pool = getPool();
    const campaign = await getAgencyCampaign(pool, req.params.id, req.agencyId);
    if (!campaign) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

    const { status, name, url, url2, keyword, keyword_config, dailyViews, viewByHour, image1_url, image2_url, totalViews, budget, cpc, trafficType, version, timeOnSite, targetPage, device, note } = req.body;
    const n = (v) => v === undefined ? null : v;

    if (status && Object.keys(req.body).length === 1) {
      if (!['running', 'paused', 'completed'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch { /* column already exists */ }
      const manuallyCompleted = status === 'completed' ? 1 : 0;
      await pool.execute(
        'UPDATE campaigns SET status = ?, manually_completed = ? WHERE id = ?',
        [status, manuallyCompleted, req.params.id]
      );
      return res.json({ message: 'Đã cập nhật trạng thái' });
    }

    // ── Khi totalViews thay đổi → tự động tính lại budget ──
    let newBudget = n(budget);
    if (totalViews !== undefined) {
      const [old] = await pool.execute('SELECT total_views, cpc FROM campaigns WHERE id = ?', [req.params.id]);
      if (old.length > 0 && Number(totalViews) !== Number(old[0].total_views)) {
        const cpcValue = Number(old[0].cpc) || 0;
        if (cpcValue > 0) newBudget = Math.round(Number(totalViews) * cpcValue);
      }
    }

    await pool.execute(
      `UPDATE campaigns SET name=COALESCE(?,name), url=COALESCE(?,url), url2=COALESCE(?,url2), keyword=COALESCE(?,keyword), keyword_config=COALESCE(?,keyword_config),
       daily_views=COALESCE(?,daily_views), view_by_hour=COALESCE(?,view_by_hour), image1_url=COALESCE(?,image1_url), image2_url=COALESCE(?,image2_url),
       total_views=COALESCE(?,total_views), budget=COALESCE(?,budget), cpc=COALESCE(?,cpc),
       traffic_type=COALESCE(?,traffic_type), version=COALESCE(?,version), time_on_site=COALESCE(?,time_on_site),
       target_page=COALESCE(?,target_page), status=COALESCE(?,status), device=COALESCE(?,device), note=COALESCE(?,note) WHERE id = ?`,
      [n(name), n(url), n(url2), n(keyword), n(keyword_config), n(dailyViews), n(viewByHour), n(image1_url), n(image2_url),
      n(totalViews), newBudget, n(cpc), n(trafficType), n(version), n(timeOnSite), n(targetPage), n(status), n(device), n(note), req.params.id]
    );
    const [campaigns] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cập nhật thành công', campaign: campaigns[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaigns/:id/status', async (req, res) => {
  try {
    const pool = getPool();
    const { status } = req.body;
    if (!['running', 'paused', 'completed'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

    const campaign = await getAgencyCampaign(pool, req.params.id, req.agencyId, 'c.id');
    if (!campaign) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

    try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch { /* column already exists */ }
    const manuallyCompleted = status === 'completed' ? 1 : 0;
    await pool.execute('UPDATE campaigns SET status = ?, manually_completed = ? WHERE id = ?', [status, manuallyCompleted, req.params.id]);
    res.json({ ok: true, message: 'Cập nhật trạng thái thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaigns/:id/priority', async (req, res) => {
  try {
    const pool = getPool();
    const priority = Number(req.body.priority);
    if (![0, 1, 2, 3, 4, 5].includes(priority)) {
      return res.status(400).json({ error: 'Priority phải là 0 (mặc định) hoặc 1-5' });
    }

    const campaign = await getAgencyCampaign(pool, req.params.id, req.agencyId, 'c.id, c.name');
    if (!campaign) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

    const dbValue = priority === 0 ? null : priority;
    await pool.execute('UPDATE campaigns SET priority = ? WHERE id = ?', [dbValue, req.params.id]);
    res.json({ ok: true, campaignId: Number(req.params.id), priority: dbValue, campaignName: campaign.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns/:id/renew', async (req, res) => {
  try {
    const pool = getPool();
    const { extraViews } = req.body;
    const addViews = parseInt(extraViews, 10);
    if (!addViews || addViews <= 0) return res.status(400).json({ error: 'Số view gia hạn phải lớn hơn 0' });

    const camp = await getAgencyCampaign(pool, req.params.id, req.agencyId);
    if (!camp) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

    try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN manually_completed TINYINT(1) NOT NULL DEFAULT 0`); } catch { /* column already exists */ }

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

    await pool.execute(
      `UPDATE campaigns SET total_views = ?, budget = ?, status = 'running', manually_completed = 0, keyword_config = ? WHERE id = ?`,
      [newTotal, newBudget, newKeywordConfig, camp.id]
    );

    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [camp.user_id, 'Chiến dịch được gia hạn',
      `Chiến dịch "${camp.name}" đã được đại lý gia hạn thêm ${addViews.toLocaleString()} view và tiếp tục chạy.`,
        'success', 'buyer']
    ).catch(() => { });

    const [updated] = await pool.execute('SELECT * FROM campaigns WHERE id = ?', [camp.id]);
    res.json({ message: `Đã gia hạn thêm ${addViews.toLocaleString()} view`, campaign: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns/:id/sync-views', async (req, res) => {
  try {
    const pool = getPool();
    const cid = req.params.id;

    if (cid === 'all') {
      const [rows] = await pool.execute(
        `SELECT c.id, c.views_done as old_views,
                COALESCE((SELECT COUNT(*) FROM vuot_link_tasks WHERE campaign_id = c.id AND status = 'completed' AND bot_detected = 0), 0) as real_views
         FROM campaigns c
         JOIN users u ON c.user_id = u.id
         WHERE u.agency_id = ?`,
        [req.agencyId]
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

    const campaign = await getAgencyCampaign(pool, cid, req.agencyId, 'c.id, c.views_done');
    if (!campaign) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

    const [rows] = await pool.execute(
      `SELECT COUNT(*) as real_views FROM vuot_link_tasks WHERE campaign_id = ? AND status = 'completed' AND bot_detected = 0`,
      [cid]
    );
    const realViews = rows[0].real_views;
    const oldViews = campaign.views_done || 0;

    if (Number(oldViews) < Number(realViews)) {
      await pool.execute('UPDATE campaigns SET views_done = ? WHERE id = ?', [realViews, cid]);
    }
    res.json({ message: `Đã đồng bộ: ${oldViews} -> ${Math.max(Number(oldViews), Number(realViews))}`, oldViews, newViews: Math.max(Number(oldViews), Number(realViews)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/campaigns/:id/keyword-stats', async (req, res) => {
  try {
    const pool = getPool();
    const campaign = await getAgencyCampaign(pool, req.params.id, req.agencyId, 'c.id, c.views_done');
    if (!campaign) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

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
      [req.params.id]
    );

    const realViews = rows.reduce((s, r) => s + Number(r.completed), 0);
    if (Number(campaign.views_done) < realViews) {
      await pool.execute('UPDATE campaigns SET views_done = ? WHERE id = ?', [realViews, req.params.id]);
    }

    res.json({ keywords: rows, stats: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/campaigns/:id/detailed-stats', async (req, res) => {
  try {
    const pool = getPool();
    const campaign = await getAgencyCampaign(pool, req.params.id, req.agencyId, 'c.id');
    if (!campaign) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

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
      } catch { /* fallback to campaign daily limit */ }

      return {
        date: localDateStr(new Date(r.date)),
        keyword: r.keyword,
        total: r.total,
        completed: r.completed,
        cost: r.cost,
        daily_views: kwDailyViews,
      };
    });
    res.json({ detailed: safeData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/campaigns/:id/tasks-export', async (req, res) => {
  try {
    const pool = getPool();
    const cid = req.params.id;
    const camp = await getAgencyCampaign(pool, cid, req.agencyId, 'c.id, c.cpc');
    if (!camp) return res.status(404).json({ error: 'Chiến dịch không thuộc đại lý này' });

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
    const PARALLEL = 5;

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

    const cpc = Number(camp.cpc) || 0;
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

// ════════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════════
router.get('/transactions', async (req, res) => {
  try {
    const pool = getPool();
    const aid = req.agencyId;
    const { type, status, search: txSearch, fromDate, toDate, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = 'WHERE u.agency_id = ?';
    const params = [aid];
    const filterParams = [aid];
    let filterWhere = 'WHERE u.agency_id = ?';

    if (txSearch) {
      const q = `%${txSearch}%`;
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR t.ref_code LIKE ?)';
      filterWhere += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR t.ref_code LIKE ?)';
      params.push(q, q, q, q);
      filterParams.push(q, q, q, q);
    }

    if (type && type !== 'all') {
      where += ' AND t.type = ?';
      filterWhere += ' AND t.type = ?';
      params.push(type);
      filterParams.push(type);
    }
    if (status && status !== 'all') {
      where += ' AND t.status = ?';
      filterWhere += ' AND t.status = ?';
      params.push(status);
      filterParams.push(status);
    }
    if (fromDate) {
      where += ' AND t.created_at >= ?';
      filterWhere += ' AND t.created_at >= ?';
      params.push(fromDate + ' 00:00:00');
      filterParams.push(fromDate + ' 00:00:00');
    }
    if (toDate) {
      where += ' AND t.created_at <= ?';
      filterWhere += ' AND t.created_at <= ?';
      params.push(toDate + ' 23:59:59');
      filterParams.push(toDate + ' 23:59:59');
    }

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM transactions t JOIN users u ON t.user_id = u.id ${where}`,
      params
    );
    const [transactions] = await pool.execute(
      `SELECT t.*, u.email as user_email, u.username, u.name as user_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       ${where}
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[depRows], [wdRows]] = await Promise.all([
      pool.execute(
        `SELECT COALESCE(SUM(t.amount), 0) as total
         FROM transactions t JOIN users u ON t.user_id = u.id
         ${filterWhere} AND t.status = 'completed' AND t.type IN ('deposit','earning','commission','refund')`,
        filterParams
      ),
      pool.execute(
        `SELECT COALESCE(SUM(t.amount), 0) as total
         FROM transactions t JOIN users u ON t.user_id = u.id
         ${filterWhere} AND t.status = 'completed' AND t.type IN ('withdraw','campaign')`,
        filterParams
      ),
    ]);

    res.json({
      transactions,
      total,
      page: Number(page),
      limit: Number(limit),
      totalDeposit: Number(depRows[0].total),
      totalWithdraw: Number(wdRows[0].total),
    });
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
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id, 'Nạp tiền thành công', `Đơn nạp ${Number(tx.amount).toLocaleString('vi-VN')} VND đã được đại lý duyệt.`, 'success', 'buyer']
    ).catch(() => { });

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

    await pool.execute("UPDATE transactions SET status = 'rejected', note = ? WHERE id = ?",
      [reason || 'Đại lý từ chối', txs[0].id]);
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [txs[0].user_id, 'Đơn nạp tiền bị từ chối', `Đơn nạp ${Number(txs[0].amount).toLocaleString('vi-VN')} VND bị từ chối. Lý do: ${reason || 'Không hợp lệ'}`, 'error', 'buyer']
    ).catch(() => { });

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

    let sql = `SELECT st.*, st.description as message, u.email as user_email, u.name as user_name
      FROM support_tickets st
      JOIN users u ON st.user_id = u.id
      WHERE u.agency_id = ?`;
    let countSql = `SELECT COUNT(*) as total FROM support_tickets st JOIN users u ON st.user_id = u.id WHERE u.agency_id = ?`;
    const params = [aid];
    const countParams = [aid];

    if (status && status !== 'all') {
      if (status === 'pending') {
        sql += " AND st.status IN ('open','in_progress')";
        countSql += " AND st.status IN ('open','in_progress')";
      } else {
        sql += ' AND st.status = ?'; countSql += ' AND st.status = ?';
        params.push(status); countParams.push(status);
      }
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
    const { admin_reply, reply, status } = req.body;
    const finalReply = admin_reply !== undefined ? admin_reply : reply;

    const [check] = await pool.execute(
      'SELECT st.id, st.user_id, st.subject FROM support_tickets st JOIN users u ON st.user_id = u.id WHERE st.id = ? AND u.agency_id = ?',
      [req.params.id, req.agencyId]
    );
    if (!check.length) return res.status(404).json({ error: 'Ticket không thuộc đại lý này' });

    if (finalReply !== undefined) {
      await pool.execute(
        'UPDATE support_tickets SET admin_reply = ?, replied_at = NOW(), status = COALESCE(?, status) WHERE id = ?',
        [finalReply, status || null, req.params.id]
      );
      if (finalReply) {
        await pool.execute(
          `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
          [check[0].user_id, `Phản hồi ticket: ${check[0].subject}`, finalReply, 'info', 'buyer']
        ).catch(() => { });
      }
    } else {
      await pool.execute(
        'UPDATE support_tickets SET status = COALESCE(?, status) WHERE id = ?',
        [status || null, req.params.id]
      );
    }

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
    const a = rows[0];
    let pc = null;
    try { pc = a.payment_config ? (typeof a.payment_config === 'string' ? JSON.parse(a.payment_config) : a.payment_config) : null; } catch { pc = null; }
    res.json({ ...a, payment_config: pc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', ownerOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { name, logo_url, favicon_url, primary_color, bank_name, bank_account_name, bank_account_number, contact_email, contact_phone, payment_config } = req.body;

    let pcJson = null;
    if (payment_config !== undefined) {
      try {
        const pc = typeof payment_config === 'string' ? JSON.parse(payment_config) : payment_config;
        if (pc && typeof pc === 'object') pcJson = JSON.stringify(pc);
      } catch { return res.status(400).json({ error: 'payment_config không hợp lệ (JSON)' }); }
    }

    await pool.execute(
      `UPDATE agencies SET name=COALESCE(?,name), logo_url=COALESCE(?,logo_url), favicon_url=COALESCE(?,favicon_url), primary_color=COALESCE(?,primary_color),
       bank_name=COALESCE(?,bank_name), bank_account_name=COALESCE(?,bank_account_name), bank_account_number=COALESCE(?,bank_account_number),
       contact_email=COALESCE(?,contact_email), contact_phone=COALESCE(?,contact_phone),
       payment_config=COALESCE(?,payment_config) WHERE id=?`,
      [name||null, logo_url===undefined?null:logo_url, favicon_url===undefined?null:favicon_url, primary_color||null, bank_name===undefined?null:bank_name, bank_account_name===undefined?null:bank_account_name, bank_account_number===undefined?null:bank_account_number, contact_email===undefined?null:contact_email, contact_phone===undefined?null:contact_phone, pcJson, req.agencyId]
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
