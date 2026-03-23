require('dotenv').config({ path: require('path').join(__dirname, '.env') });
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
    const [settings] = await pool.execute("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('discount_code','discount_percent','discount_label','discount_enabled','worker_cpc')");
    const config = {};
    settings.forEach(s => { config[s.setting_key] = s.setting_value; });
    res.json({ tiers, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public worker pricing API (no auth) ──
app.get('/api/worker-pricing', async (req, res) => {
  try {
    const { getPool } = require('./db');
    const pool = getPool();
    const [tiers] = await pool.execute('SELECT * FROM worker_pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
    res.json({ tiers });
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
app.use('/api/quicklink',  require('./routes/quicklink'));


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

    // worker_links: link locker where visitors complete a vượt link task to reach destination
    // Use IF NOT EXISTS to preserve data on restart
    try {
      await pool.execute(`CREATE TABLE IF NOT EXISTS worker_links (
        id              INT PRIMARY KEY AUTO_INCREMENT,
        worker_id       INT NOT NULL,
        slug            VARCHAR(20) NOT NULL UNIQUE,
        title           VARCHAR(255),
        destination_url VARCHAR(2048) NOT NULL,
        click_count     INT NOT NULL DEFAULT 0,
        completed_count INT NOT NULL DEFAULT 0,
        earning         DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      console.log('  ✅ worker_links table ready');
    } catch (e) { console.error('  ⚠ worker_links:', e.message); }

    // Track which gateway link triggered a task
    try {
      await pool.execute(`ALTER TABLE vuot_link_tasks ADD COLUMN worker_link_id INT DEFAULT NULL`);
    } catch (e) { }

    // Add hidden column to worker_links
    try {
      await pool.execute(`ALTER TABLE worker_links ADD COLUMN hidden TINYINT(1) NOT NULL DEFAULT 0`);
    } catch (e) { }

    // Add version column to campaigns (0 = default, 1 = multi-step with internal link)
    try {
      await pool.execute(`ALTER TABLE campaigns ADD COLUMN version TINYINT NOT NULL DEFAULT 0`);
    } catch (e) { }

    // api_keys: API key auth for quicklink API
    try {
      await pool.execute(`CREATE TABLE IF NOT EXISTS api_keys (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        user_id        INT NOT NULL,
        api_key        VARCHAR(100) NOT NULL UNIQUE,
        label          VARCHAR(100) DEFAULT 'Default',
        active         TINYINT(1) NOT NULL DEFAULT 1,
        request_count  INT NOT NULL DEFAULT 0,
        last_used_at   DATETIME DEFAULT NULL,
        created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      console.log('  ✅ api_keys table ready');
    } catch (e) { console.error('  ⚠ api_keys:', e.message); }

    // worker_pricing_tiers: separate pricing for worker earnings (mirrors pricing_tiers structure)
    try {
      await pool.execute(`CREATE TABLE IF NOT EXISTS worker_pricing_tiers (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        traffic_type   VARCHAR(50) NOT NULL,
        duration       VARCHAR(20) NOT NULL,
        v1_price       INT NOT NULL DEFAULT 0,
        v2_price       INT NOT NULL DEFAULT 0,
        updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tier (traffic_type, duration)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      // Seed from pricing_tiers if worker_pricing_tiers is empty
      const [wptCount] = await pool.execute('SELECT COUNT(*) as c FROM worker_pricing_tiers');
      if (wptCount[0].c === 0) {
        const [buyerTiers] = await pool.execute('SELECT traffic_type, duration, v1_price, v2_price FROM pricing_tiers');
        for (const t of buyerTiers) {
          await pool.execute(
            'INSERT IGNORE INTO worker_pricing_tiers (traffic_type, duration, v1_price, v2_price) VALUES (?, ?, ?, ?)',
            [t.traffic_type, t.duration, t.v1_price, t.v2_price]
          );
        }
        console.log(`  ✅ worker_pricing_tiers seeded from pricing_tiers (${buyerTiers.length} rows)`);
      } else {
        console.log('  ✅ worker_pricing_tiers table ready');
      }
    } catch (e) { console.error('  ⚠ worker_pricing_tiers:', e.message); }

    // Backfill missing wallets for existing users
    try {
      for (const wType of ['main', 'earning', 'commission']) {
        const [result] = await pool.execute(
          `INSERT IGNORE INTO wallets (user_id, type, balance)
           SELECT id, '${wType}', 0 FROM users WHERE id NOT IN (SELECT user_id FROM wallets WHERE type = '${wType}')`
        );
        if (result.affectedRows > 0) {
          console.log(`  ✅ Backfilled ${result.affectedRows} missing '${wType}' wallets`);
        }
      }
    } catch (e) { console.error('  ⚠ Wallet backfill:', e.message); }

    // Recalculate earning wallet balances from actual transactions (fix zero-balance bug)
    try {
      const [fixed] = await pool.execute(
        `UPDATE wallets w SET w.balance = (
           SELECT COALESCE(SUM(CASE WHEN t.type IN ('earning','deposit','bonus') THEN t.amount ELSE -t.amount END), 0)
           FROM transactions t WHERE t.user_id = w.user_id AND t.wallet_type = 'earning' AND t.status = 'completed'
         ) WHERE w.type = 'earning' AND w.balance = 0 AND EXISTS (
           SELECT 1 FROM transactions t2 WHERE t2.user_id = w.user_id AND t2.wallet_type = 'earning' AND t2.status = 'completed'
         )`
      );
      if (fixed.affectedRows > 0) {
        console.log(`  ✅ Recalculated ${fixed.affectedRows} earning wallet balances from transactions`);
      }
    } catch (e) { console.error('  ⚠ Earning balance recalc:', e.message); }

    // support_tickets: add role + admin_reply columns
    try { await pool.execute(`ALTER TABLE support_tickets ADD COLUMN role VARCHAR(10) DEFAULT 'worker'`); } catch (e) {}
    try { await pool.execute(`ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT DEFAULT NULL`); } catch (e) {}

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║   🚀 Traffic68 API Server (MySQL)         ║
║   http://localhost:${PORT}                   ║
║   Health: http://localhost:${PORT}/api/health ║
╚════════════════════════════════════════════╝
      `);

      // ── Background job: expire stale tasks every 60s ──
      setInterval(async () => {
        try {
          const { getPool } = require('./db');
          const pool = getPool();
          const [result] = await pool.execute(
            `UPDATE vuot_link_tasks SET status = 'expired'
             WHERE status IN ('pending','step1','step2','step3')
             AND expires_at IS NOT NULL AND expires_at < NOW()`
          );
          if (result.affectedRows > 0) {
            console.log(`[Expiry] Expired ${result.affectedRows} stale tasks`);
          }
        } catch (e) { /* silent */ }
      }, 60000);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
})();
