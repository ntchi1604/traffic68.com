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
