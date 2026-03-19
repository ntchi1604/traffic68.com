const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'traffic68.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    // Migration: add username column if not exists
    const cols = db.prepare("PRAGMA table_info(users)").all();
    if (!cols.find(c => c.name === 'username')) {
      db.exec("ALTER TABLE users ADD COLUMN username TEXT DEFAULT ''");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username != ''");
      console.log('📦 Migration: added username column to users');
    }

    // Migration: add admin_reply to support_tickets
    const ticketCols = db.prepare("PRAGMA table_info(support_tickets)").all();
    if (!ticketCols.find(c => c.name === 'admin_reply')) {
      db.exec("ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT DEFAULT ''");
      db.exec("ALTER TABLE support_tickets ADD COLUMN replied_at DATETIME");
      console.log('📦 Migration: added admin_reply to support_tickets');
    }

    // Ensure demo widget exists for testing
    const demoWidget = db.prepare("SELECT id FROM widgets WHERE token = 'T68-DEMO0001'").get();
    if (!demoWidget) {
      const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
      if (admin) {
        const cfg = JSON.stringify({buttonText:'Lấy Mã',waitTime:15,code:'SECRET-CODE-XYZ',position:'bottom-right',buttonColor:'#e53935',theme:'default'});
        db.prepare('INSERT INTO widgets (user_id, token, name, config) VALUES (?,?,?,?)').run(admin.id, 'T68-DEMO0001', 'Demo Widget', cfg);
        console.log('🎯 Created demo widget: T68-DEMO0001');
      }
    }

    console.log('✅ Database initialized at', DB_PATH);
  }
  return db;
}

module.exports = { getDb };
