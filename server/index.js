const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Init DB
const { initDb, getPool } = require('./db');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors({ origin: true, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'] }));
app.use(express.json());
app.use(morgan('dev'));

// ── Prevent caching for API routes ──
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ── Serve embed script & public assets ──
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  },
}));

// ── Serve uploads (avatars, etc.) ──
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d' }));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public pricing API (no auth) ──
app.get('/api/pricing', async (req, res) => {
  try {
    const { getPool } = require('./db');
    const pool = getPool();
    const [tiers] = await pool.execute('SELECT * FROM pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
    const [settings] = await pool.execute("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('discount_code','discount_percent','discount_label','discount_enabled')");
    const config = {};
    settings.forEach(s => { config[s.setting_key] = s.setting_value; });
    res.json({ tiers, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Routes ──
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/campaigns',  require('./routes/campaigns'));
app.use('/api/finance',    require('./routes/finance'));
app.use('/api/widgets',    require('./routes/widgets'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support',    require('./routes/support'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/vuot-link',  require('./routes/vuotlink'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/shortlink',  require('./routes/shortlink'));

// ── Short link redirect: GET /v/:slug ──
app.get('/v/:slug', async (req, res) => {
  try {
    const pool = getPool();
    const { slug } = req.params;

    const [rows] = await pool.execute(
      `SELECT wl.*, c.url, c.cpc, c.status, c.views_done, c.total_views, c.user_id as buyer_id
       FROM worker_links wl JOIN campaigns c ON c.id = wl.campaign_id
       WHERE wl.slug = ?`,
      [slug]
    );
    if (!rows.length) return res.status(404).send('Link không tồn tại');
    const link = rows[0];

    // Redirect immediately
    res.redirect(302, link.url);

    // Process payment async (after redirect)
    if (link.status === 'running' && link.views_done < link.total_views) {
      try {
        const cpc = Number(link.cpc) || 0;
        // Deduct from buyer's wallet
        await pool.execute(
          "UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = 'main' AND balance >= ?",
          [cpc, link.buyer_id, cpc]
        );
        // Credit worker
        await pool.execute(
          "UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = 'earning'",
          [cpc, link.worker_id]
        );
        // Update link stats
        await pool.execute(
          'UPDATE worker_links SET click_count = click_count + 1, earning = earning + ? WHERE id = ?',
          [cpc, link.id]
        );
        // Update campaign
        await pool.execute('UPDATE campaigns SET views_done = views_done + 1 WHERE id = ?', [link.campaign_id]);
        await pool.execute(
          `UPDATE campaigns SET status = 'completed' WHERE id = ? AND views_done >= total_views AND status != 'completed'`,
          [link.campaign_id]
        );
        // Record transaction
        const refCode = 'SL-' + Date.now();
        await pool.execute(
          `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
           VALUES (?, 'earning', 'earning', 'shortlink', ?, 'completed', ?, ?)`,
          [link.worker_id, cpc, refCode, `Click link /v/${slug}`]
        );
        // Record spend for buyer
        const refCode2 = 'SLC-' + Date.now();
        await pool.execute(
          `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note)
           VALUES (?, 'main', 'campaign', 'shortlink', ?, 'completed', ?, ?)`,
          [link.buyer_id, cpc, refCode2, `Chi phí click link campaign #${link.campaign_id}`]
        );
      } catch (payErr) {
        console.error('[ShortLink] Payment error:', payErr.message);
      }
    }
  } catch (err) {
    console.error('[ShortLink] Redirect error:', err.message);
    res.status(500).send('Lỗi server');
  }
});

// ── 404 handler ──
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}` });
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
});

// ── Start ──
(async () => {
  try {
    await initDb();
    await seed();
    const pool = getPool();
    try {
      await pool.execute(`ALTER TABLE vuot_link_tasks ADD COLUMN security_detail TEXT DEFAULT NULL`);
      console.log('  ✅ Added security_detail column');
    } catch (e) { }

    try {
      await pool.execute(`CREATE TABLE IF NOT EXISTS worker_links (
        id            INT PRIMARY KEY AUTO_INCREMENT,
        worker_id     INT NOT NULL,
        campaign_id   INT NOT NULL,
        slug          VARCHAR(20) NOT NULL UNIQUE,
        click_count   INT NOT NULL DEFAULT 0,
        earning       DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (worker_id)   REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      console.log('  ✅ worker_links table ready');
    } catch (e) { console.error('  ⚠ worker_links:', e.message); }

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║   🚀 Traffic68 API Server (MySQL)         ║
║   http://localhost:${PORT}                   ║
║   Health: http://localhost:${PORT}/api/health ║
╚════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
})();
