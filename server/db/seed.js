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
}

module.exports = { seed };
