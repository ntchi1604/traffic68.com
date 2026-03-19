const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Init DB
const { initDb } = require('./db');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors({ origin: true, credentials: true }));
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
    const [tiers] = await pool.execute('SELECT * FROM pricing_tiers ORDER BY traffic_type, duration');
    const [settings] = await pool.execute("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('discount_code','discount_percent','discount_label','discount_enabled')");
    const config = {};
    settings.forEach(s => { config[s.setting_key] = s.setting_value; });
    res.json({ tiers, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/widgets', require('./routes/widgets'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support', require('./routes/support'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/vuot-link', require('./routes/vuotlink'));
app.use('/api/admin', require('./routes/admin'));

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
