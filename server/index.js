const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Init DB + Seed
const { getDb } = require('./db');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ──
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/campaigns',     require('./routes/campaigns'));
app.use('/api/finance',       require('./routes/finance'));
app.use('/api/widgets',       require('./routes/widgets'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support',       require('./routes/support'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/vuot-link',     require('./routes/vuotlink'));
app.use('/api/admin',         require('./routes/admin'));

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
getDb(); // Init database
seed();  // Seed demo data

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 Traffic68 API Server                 ║
║   http://localhost:${PORT}                   ║
║   Health: http://localhost:${PORT}/api/health ║
╚════════════════════════════════════════════╝
  `);
});
