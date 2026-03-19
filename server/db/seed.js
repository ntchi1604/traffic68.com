const bcrypt = require('bcryptjs');
const { getDb } = require('./index');

function seed() {
  const db = getDb();

  // Check if already seeded
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) {
    console.log('⏩ Database already has data, skipping seed');
    return;
  }

  console.log('🌱 Seeding database...');

  // ── Admin account ──
  const adminHash = bcrypt.hashSync('123231321', 10);
  db.prepare(`
    INSERT INTO users (email, password_hash, name, username, role, phone, referral_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin@traffic68.com', adminHash, 'Admin', 'admin', 'admin', '', 'REF-ADMIN');

  const adminId = 1;

  // Create wallets for admin
  db.prepare('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)').run(adminId, 'main', 0);
  db.prepare('INSERT INTO wallets (user_id, type, balance) VALUES (?, ?, ?)').run(adminId, 'commission', 0);

  // Welcome notification
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
  `).run(adminId, 'Chào mừng Admin!', 'Tài khoản quản trị đã sẵn sàng.', 'success');

  // Demo widget for testing laynut.js
  const demoConfig = JSON.stringify({
    buttonText: 'Lấy Mã',
    waitTime: 15,
    code: 'SECRET-CODE-XYZ',
    position: 'bottom-right',
    buttonColor: '#e53935',
    theme: 'default'
  });
  db.prepare('INSERT INTO widgets (user_id, token, name, config) VALUES (?,?,?,?)')
    .run(adminId, 'T68-DEMO0001', 'Demo Widget', demoConfig);

  console.log('✅ Seed complete — admin@traffic68.com / 123231321');
  console.log('🎯 Demo widget token: T68-DEMO0001');
}

module.exports = { seed };
