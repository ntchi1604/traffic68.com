const bcrypt = require('bcryptjs');
const { getPool } = require('./index');

async function seed() {
  const pool = getPool();

  // Check if already seeded
  const [rows] = await pool.execute('SELECT COUNT(*) as c FROM users');
  if (rows[0].c > 0) {
    console.log('⏩ Database already has data, skipping seed');
    return;
  }

  console.log('🌱 Seeding database...');

  // ── Admin account ──
  const adminHash = bcrypt.hashSync('123231321', 10);
  const [result] = await pool.execute(
    `INSERT INTO users (email, password_hash, name, username, role, phone, referral_code)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['admin@traffic68.com', adminHash, 'Admin', 'admin', 'admin', '', 'REF-ADMIN']
  );

  const adminId = result.insertId;

  // Create wallets for admin
  await pool.execute('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)', [adminId, 'main', 0]);
  await pool.execute('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)', [adminId, 'commission', 0]);

  // Welcome notification
  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
    [adminId, 'Chào mừng Admin!', 'Tài khoản quản trị đã sẵn sàng.', 'success']
  );

  // Demo widget
  const demoConfig = JSON.stringify({
    buttonText: 'Lấy Mã',
    waitTime: 15,
    code: 'SECRET-CODE-XYZ',
    position: 'bottom-right',
    buttonColor: '#e53935',
    theme: 'default'
  });
  await pool.execute(
    'INSERT INTO widgets (user_id, token, name, config) VALUES (?,?,?,?)',
    [adminId, 'T68-DEMO0001', 'Demo Widget', demoConfig]
  );

  console.log('✅ Seed complete — admin@traffic68.com / 123231321');
  console.log('🎯 Demo widget token: T68-DEMO0001');

  // ── Default pricing tiers ──
  const pricingData = [
    // Google Search Traffic
    ['google_search', '60s',  700,  420, 600,  360],
    ['google_search', '90s',  780,  468, 680,  408],
    ['google_search', '120s', 850,  510, 750,  450],
    ['google_search', '150s', 1000, 600, 900,  550],
    ['google_search', '200s', 1150, 690, 1050, 630],
    // Social Traffic
    ['social', '60s',  700,  420, 600,  360],
    ['social', '90s',  780,  468, 680,  408],
    ['social', '120s', 850,  510, 750,  450],
    ['social', '150s', 1000, 600, 900,  550],
    ['social', '200s', 1150, 690, 1050, 630],
    // Direct Traffic
    ['direct', '60s',  500, 300, 400, 240],
    ['direct', '90s',  580, 348, 480, 288],
    ['direct', '120s', 650, 390, 550, 330],
    ['direct', '150s', 800, 480, 700, 420],
    ['direct', '200s', 950, 570, 850, 510],
  ];
  for (const [type, dur, v1, d1, v2, d2] of pricingData) {
    await pool.execute(
      `INSERT IGNORE INTO pricing_tiers (traffic_type, duration, v1_price, v1_discount, v2_price, v2_discount) VALUES (?,?,?,?,?,?)`,
      [type, dur, v1, d1, v2, d2]
    );
  }
  console.log('💰 Default pricing tiers seeded');

  // ── Default site settings ──
  await pool.execute("INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('discount_code', 'SALE_ALL_40')");
  await pool.execute("INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('discount_percent', '40')");
  await pool.execute("INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('discount_label', 'Khai trương hệ thống - Giảm giá 40%')");
  console.log('⚙️ Default site settings seeded');
}

module.exports = { seed };
