require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { initDb, getPool } = require('./db');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'] }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    // Ngăn Googlebot và SEO crawler index/follow iframe fingerprint
    if (filePath.endsWith('creep-frame.html')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }
  },
}));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// ── Authenticated: worker gets their own pricing (group or default) ──
app.get('/api/worker-pricing/my', async (req, res) => {
  try {
    const { getPool } = require('./db');
    const { authMiddleware } = require('./middleware/auth');
    const pool = getPool();

    // Manually run auth to get userId
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      userId = decoded.userId || decoded.id;
    } catch { }

    if (!userId) {
      // Fallback: return default pricing
      const [tiers] = await pool.execute('SELECT * FROM worker_pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
      return res.json({ tiers, groupName: null });
    }

    // Check if worker has a pricing group
    const [userRows] = await pool.execute('SELECT pricing_group_id FROM users WHERE id = ?', [userId]);
    const groupId = userRows[0]?.pricing_group_id;

    if (!groupId) {
      const [tiers] = await pool.execute('SELECT * FROM worker_pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
      return res.json({ tiers, groupName: null });
    }

    // Get group name + rates
    const [groupRows] = await pool.execute('SELECT name FROM worker_pricing_groups WHERE id = ?', [groupId]).catch(() => [[]]);
    const groupName = groupRows[0]?.name || null;
    const [rates] = await pool.execute(
      'SELECT traffic_type, duration, v1_price, v2_price FROM worker_pricing_group_rates WHERE group_id = ? ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)',
      [groupId]
    ).catch(() => [[]]);

    if (rates.length === 0) {
      const [tiers] = await pool.execute('SELECT * FROM worker_pricing_tiers ORDER BY traffic_type, CAST(REPLACE(duration,"s","") AS UNSIGNED)');
      return res.json({ tiers, groupName });
    }

    res.json({ tiers: rates, groupName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Worker: xem + submit nguồn để xét duyệt ──
app.get('/api/worker/source', async (req, res) => {
  try {
    const pool = getPool();
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    let userId = null;
    try { const d = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); userId = d.userId || d.id; } catch {}
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const [rows] = await pool.execute('SELECT source_status, source_url, source_note FROM users WHERE id = ?', [userId]);
    res.json({ source_status: rows[0]?.source_status || 'pending', source_url: rows[0]?.source_url || '', source_note: rows[0]?.source_note || '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/worker/source', async (req, res) => {
  try {
    const pool = getPool();
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    let userId = null;
    try { const d = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); userId = d.userId || d.id; } catch {}
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { source_url } = req.body || {};
    if (!source_url) return res.status(400).json({ error: 'Vui lòng nhập URL nguồn' });
    await pool.execute(
      "UPDATE users SET source_url = ?, source_status = 'pending' WHERE id = ?",
      [source_url, userId]
    );
    res.json({ ok: true, message: 'Đã gửi yêu cầu xét duyệt nguồn' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/announcement', async (req, res) => {
  try {
    const role = req.query.role === 'buyer' ? 'buyer' : 'worker';
    const prefix = `${role}_announcement`;
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?,?,?)`,
      [prefix, prefix + '_type', prefix + '_enabled']
    );
    const cfg = {};
    rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
    res.json({
      enabled: cfg[prefix + '_enabled'] === 'true',
      message: cfg[prefix] || '',
      type: cfg[prefix + '_type'] || 'info',
    });
  } catch (err) {
    res.json({ enabled: false, message: '', type: 'info' });
  }
});

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
app.use('/api/shortlink', require('./routes/shortlink'));
app.use('/api/quicklink', require('./routes/quicklink'));
app.use('/api/buyer',     require('./routes/buyer'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}` });
});

// ── SPA Fallback: trả về index.html cho tất cả route không phải /api ──
// Cần thiết để React Router hoạt động khi user reload trang hoặc truy cập trực tiếp
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
});

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

    
    try {
      await pool.execute(`ALTER TABLE vuot_link_tasks ADD COLUMN worker_link_id INT DEFAULT NULL`);
    } catch (e) { }

    
    try {
      await pool.execute(`ALTER TABLE worker_links ADD COLUMN hidden TINYINT(1) NOT NULL DEFAULT 0`);
    } catch (e) { }

    
    try {
      await pool.execute(`ALTER TABLE campaigns ADD COLUMN version TINYINT NOT NULL DEFAULT 0`);
    } catch (e) { }

    
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

    
    try { await pool.execute(`ALTER TABLE support_tickets ADD COLUMN role VARCHAR(10) DEFAULT 'worker'`); } catch (e) { }
    try { await pool.execute(`ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT DEFAULT NULL`); } catch (e) { }

    
    try {
      await pool.execute(`CREATE TABLE IF NOT EXISTS web3_payments (
        id              INT PRIMARY KEY AUTO_INCREMENT,
        transaction_id  INT NOT NULL,
        user_id         INT NOT NULL,
        tx_hash         VARCHAR(100) NOT NULL,
        from_address    VARCHAR(50) NOT NULL,
        to_address      VARCHAR(50) NOT NULL,
        amount_vnd      DECIMAL(15,2) NOT NULL DEFAULT 0,
        amount_crypto   DECIMAL(20,8) NOT NULL DEFAULT 0,
        token           VARCHAR(10) NOT NULL DEFAULT 'BNB',
        network         VARCHAR(20) NOT NULL DEFAULT 'mainnet',
        gas_used        VARCHAR(30) DEFAULT NULL,
        block_number    INT DEFAULT NULL,
        explorer_url    VARCHAR(255) DEFAULT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'success',
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_tx_hash (tx_hash),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      console.log('  ✅ web3_payments table ready');
    } catch (e) { console.error('  ⚠ web3_payments:', e.message); }

    
    try {
      await pool.execute(`CREATE TABLE IF NOT EXISTS security_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        source      VARCHAR(20) NOT NULL DEFAULT 'unknown',
        reason      VARCHAR(50) NOT NULL,
        ip_address  VARCHAR(45),
        user_agent  VARCHAR(500),
        visitor_id  VARCHAR(100),
        details     TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created (created_at),
        INDEX idx_reason (reason),
        INDEX idx_ip (ip_address)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      console.log('  ✅ security_logs table ready');
    } catch (e) { console.error('  ⚠ security_logs:', e.message); }

    // ── Seed worker + buyer announcement settings nếu chưa có ──
    try {
      const defaultSettings = [
        ['worker_announcement_enabled', 'false'],
        ['worker_announcement_type', 'info'],
        ['worker_announcement', ''],
        ['buyer_announcement_enabled', 'false'],
        ['buyer_announcement_type', 'info'],
        ['buyer_announcement', ''],
      ];
      for (const [key, val] of defaultSettings) {
        await pool.execute(
          'INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)',
          [key, val]
        );
      }
      console.log('  ✅ announcement settings ready (worker + buyer)');
    } catch (e) { console.error('  ⚠ announcement seed:', e.message); }

    // ── Tạo nhóm giá mặc định "Thường" nếu chưa có ──
    try {
      // Đảm bảo bảng tồn tại
      await pool.execute(`CREATE TABLE IF NOT EXISTS worker_pricing_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.execute(`CREATE TABLE IF NOT EXISTS worker_pricing_group_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        traffic_type VARCHAR(50) NOT NULL,
        duration VARCHAR(20) NOT NULL,
        v1_price DECIMAL(15,0) DEFAULT 0,
        v2_price DECIMAL(15,0) DEFAULT 0,
        UNIQUE KEY uniq_rate (group_id, traffic_type, duration),
        FOREIGN KEY (group_id) REFERENCES worker_pricing_groups(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      try { await pool.execute(`ALTER TABLE users ADD COLUMN pricing_group_id INT NULL DEFAULT NULL`); } catch (_) {}
      // Thêm cột xét duyệt nguồn
      try { await pool.execute(`ALTER TABLE users ADD COLUMN source_status VARCHAR(20) NULL DEFAULT NULL`); } catch (_) {}
      try { await pool.execute(`ALTER TABLE users ADD COLUMN source_url TEXT NULL DEFAULT NULL`); } catch (_) {}
      try { await pool.execute(`ALTER TABLE users ADD COLUMN source_note TEXT NULL DEFAULT NULL`); } catch (_) {}
      // Auto-approve toàn bộ worker hiện tại (đã hoạt động trước khi tính năng ra đời)
      const [existApprove] = await pool.execute(
        "UPDATE users SET source_status = 'approved' WHERE service_type = 'shortlink' AND (source_status IS NULL OR source_status = '')"
      );
      if (existApprove.affectedRows > 0) console.log(`  ✅ Auto-approved ${existApprove.affectedRows} existing workers`);

      // Lấy nhóm đầu tiên hoặc tạo mới "Thường"
      let [existingGroups] = await pool.execute('SELECT id FROM worker_pricing_groups ORDER BY id ASC LIMIT 1');
      let defaultGroupId;
      if (existingGroups.length === 0) {
        const [ins] = await pool.execute(
          `INSERT INTO worker_pricing_groups (name, description) VALUES ('Thường', 'Nhóm giá mặc định cho tất cả worker')`,
        );
        defaultGroupId = ins.insertId;
        // Clone từ worker_pricing_tiers nếu có
        const [tiers] = await pool.execute('SELECT * FROM worker_pricing_tiers').catch(() => [[]]);
        for (const t of tiers) {
          await pool.execute(
            'INSERT IGNORE INTO worker_pricing_group_rates (group_id, traffic_type, duration, v1_price, v2_price) VALUES (?,?,?,?,?)',
            [defaultGroupId, t.traffic_type, t.duration, t.v1_price || 0, t.v2_price || 0]
          );
        }
        console.log(`  ✅ Created default pricing group "Thường" (id=${defaultGroupId})`);
      } else {
        defaultGroupId = existingGroups[0].id;
      }

      // Gán tất cả user chưa có nhóm vào nhóm mặc định
      const [assignRes] = await pool.execute(
        'UPDATE users SET pricing_group_id = ? WHERE pricing_group_id IS NULL',
        [defaultGroupId]
      );
      if (assignRes.affectedRows > 0) {
        console.log(`  ✅ Assigned ${assignRes.affectedRows} users to default pricing group`);
      }
      console.log(`  ✅ Default pricing group ready (id=${defaultGroupId})`);
    } catch (e) { console.error('  ⚠ default pricing group seed:', e.message); }

    app.listen(PORT, () => {

      console.log(`
╔════════════════════════════════════════════╗
║   🚀 Traffic68 API Server (MySQL)         ║
║   http://localhost:${PORT}                   ║
║   Health: http://localhost:${PORT}/api/health ║
╚════════════════════════════════════════════╝
      `);

      
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
        } catch (e) {  }
      }, 60000);

      // Start crypto deposit watcher
      try {
        const web3pay = require('./lib/web3pay');
        web3pay.startDepositWatcher(60000);
      } catch (e) { console.log('[DepositWatcher] Skipped:', e.message); }
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
})();
