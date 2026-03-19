const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/vuot-link/task (PUBLIC) ──
// Lấy task vượt link tiếp theo cho worker (dựa vào campaign đang chạy)
router.get('/task', optionalAuth, (req, res) => {
  const db = getDb();

  // Tìm campaign đang chạy có keyword, còn view cần làm
  const campaign = db.prepare(`
    SELECT * FROM campaigns
    WHERE status = 'running'
      AND traffic_type = 'google_search'
      AND keyword != ''
      AND views_done < total_views
    ORDER BY RANDOM()
    LIMIT 1
  `).get();

  if (!campaign) {
    return res.status(404).json({ error: 'Hiện không có task vượt link nào' });
  }

  // Tạo task mới
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 phút
  const result = db.prepare(`
    INSERT INTO vuot_link_tasks (campaign_id, worker_id, keyword, target_url, target_page, status, expires_at)
    VALUES (?, ?, ?, ?, ?, 'assigned', ?)
  `).run(
    campaign.id,
    req.userId || null,
    campaign.keyword,
    campaign.url,
    campaign.target_page || '',
    expiresAt,
  );

  res.json({
    task: {
      id: result.lastInsertRowid,
      keyword: campaign.keyword,
      targetUrl: campaign.url,
      targetPage: campaign.target_page,
      cpc: campaign.cpc,
      expiresAt,
    },
  });
});

// ── PUT /api/vuot-link/task/:id/step ──
// Cập nhật tiến trình từng bước
router.put('/task/:id/step', optionalAuth, (req, res) => {
  const db = getDb();
  const { step } = req.body; // step1 | step2 | step3
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  const task = db.prepare('SELECT * FROM vuot_link_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task không tồn tại' });

  // Check expired
  if (task.expires_at && new Date(task.expires_at) < new Date()) {
    db.prepare("UPDATE vuot_link_tasks SET status = 'expired' WHERE id = ?").run(task.id);
    return res.status(410).json({ error: 'Task đã hết hạn' });
  }

  const now = new Date().toISOString();

  if (step === 'step1') {
    db.prepare("UPDATE vuot_link_tasks SET status = 'step1', step1_at = ?, ip_address = ?, user_agent = ? WHERE id = ?")
      .run(now, ip, ua, task.id);
  } else if (step === 'step2') {
    db.prepare("UPDATE vuot_link_tasks SET status = 'step2', step2_at = ? WHERE id = ?")
      .run(now, task.id);
  } else if (step === 'step3') {
    db.prepare("UPDATE vuot_link_tasks SET status = 'step3', step3_at = ? WHERE id = ?")
      .run(now, task.id);
  } else {
    return res.status(400).json({ error: 'Step không hợp lệ' });
  }

  res.json({ message: `Đã cập nhật ${step}`, status: step });
});

// ── POST /api/vuot-link/task/:id/complete ──
// Hoàn thành task (sau khi lấy mã)
router.post('/task/:id/complete', optionalAuth, (req, res) => {
  const db = getDb();
  const { timeOnSite } = req.body;

  const task = db.prepare('SELECT * FROM vuot_link_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task không tồn tại' });

  if (task.status === 'completed') {
    return res.status(400).json({ error: 'Task đã hoàn thành rồi' });
  }

  // Get campaign CPC
  const campaign = db.prepare('SELECT cpc, user_id FROM campaigns WHERE id = ?').get(task.campaign_id);
  if (!campaign) return res.status(404).json({ error: 'Campaign không tồn tại' });

  const earning = campaign.cpc;
  const code = 'CODE-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const now = new Date().toISOString();

  // Update task
  db.prepare(`
    UPDATE vuot_link_tasks SET
      status = 'completed', completed_at = ?, time_on_site = ?,
      earning = ?, code_given = ?
    WHERE id = ?
  `).run(now, timeOnSite || 0, earning, code, task.id);

  // Update campaign views_done
  db.prepare('UPDATE campaigns SET views_done = views_done + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(task.campaign_id);

  // Update traffic_logs
  const today = new Date().toISOString().slice(0, 10);
  const existingLog = db.prepare('SELECT id FROM traffic_logs WHERE campaign_id = ? AND date = ?')
    .get(task.campaign_id, today);

  if (existingLog) {
    db.prepare('UPDATE traffic_logs SET views = views + 1, clicks = clicks + 1 WHERE id = ?')
      .run(existingLog.id);
  } else {
    db.prepare('INSERT INTO traffic_logs (campaign_id, date, views, clicks, unique_ips, source) VALUES (?, ?, 1, 1, 1, ?)')
      .run(task.campaign_id, today, campaign.traffic_type || 'google_search');
  }

  // Pay worker (if logged in)
  if (task.worker_id) {
    db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = 'commission'")
      .run(earning, task.worker_id);

    const refCode = 'VL-' + Date.now();
    db.prepare(`
      INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
      VALUES (?, 'commission', 'commission', 'system', ?, 'completed', ?, ?)
    `).run(task.worker_id, earning, refCode, `Vượt link task #${task.id}`);
  }

  res.json({
    message: 'Hoàn thành vượt link!',
    code,
    earning,
  });
});

// ── Protected: Admin stats ──
router.use(authMiddleware);

// ── GET /api/vuot-link/stats ──
router.get('/stats', (req, res) => {
  const db = getDb();

  const total = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'pending' OR status = 'assigned' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'completed' THEN earning ELSE 0 END) as totalEarning
    FROM vuot_link_tasks vt
    JOIN campaigns c ON c.id = vt.campaign_id
    WHERE c.user_id = ?
  `).get(req.userId);

  const recent = db.prepare(`
    SELECT vt.*, c.name as campaign_name
    FROM vuot_link_tasks vt
    JOIN campaigns c ON c.id = vt.campaign_id
    WHERE c.user_id = ?
    ORDER BY vt.created_at DESC
    LIMIT 20
  `).all(req.userId);

  res.json({ stats: total, recent });
});

module.exports = router;
