-- ═══════════════════════════════════════════════════════
--  Traffic68 — Database Schema (SQLite)
-- ═══════════════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  name          TEXT    NOT NULL DEFAULT '',
  phone         TEXT    DEFAULT '',
  avatar_url    TEXT    DEFAULT '',
  role          TEXT    NOT NULL DEFAULT 'user',   -- user | admin
  status        TEXT    NOT NULL DEFAULT 'active', -- active | suspended
  referral_code TEXT    UNIQUE,
  referred_by   INTEGER REFERENCES users(id),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL DEFAULT 'main',      -- main | commission
  balance    REAL    NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, type)
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  url          TEXT    NOT NULL,
  traffic_type TEXT    NOT NULL DEFAULT 'google_search', -- google_search | direct | backlink
  version      INTEGER NOT NULL DEFAULT 1,               -- 1 or 2
  budget       REAL    NOT NULL DEFAULT 0,
  cpc          REAL    NOT NULL DEFAULT 0,
  daily_views  INTEGER NOT NULL DEFAULT 500,
  total_views  INTEGER NOT NULL DEFAULT 1000,
  view_by_hour INTEGER NOT NULL DEFAULT 0,               -- 0=off, 1=on
  keyword      TEXT    DEFAULT '',
  target_page  TEXT    DEFAULT '',
  time_on_site TEXT    DEFAULT '60-120',
  status       TEXT    NOT NULL DEFAULT 'running',        -- running | paused | completed
  views_done   INTEGER NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (deposits, withdrawals, etc.)
CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_type TEXT    NOT NULL DEFAULT 'main',       -- main | commission
  type        TEXT    NOT NULL,                      -- deposit | withdraw | refund | commission
  method      TEXT    DEFAULT '',                    -- bank_transfer | credit_card | momo | system
  amount      REAL    NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'pending',    -- pending | completed | failed | cancelled
  ref_code    TEXT    UNIQUE,
  note        TEXT    DEFAULT '',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Widgets (LayNut script configs)
CREATE TABLE IF NOT EXISTS widgets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL DEFAULT 'Nút mặc định',
  config     TEXT    NOT NULL DEFAULT '{}',           -- JSON blob
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  message    TEXT    NOT NULL DEFAULT '',
  type       TEXT    NOT NULL DEFAULT 'info',          -- info | success | warning | error
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  priority    TEXT    NOT NULL DEFAULT 'medium',       -- low | medium | high | urgent
  status      TEXT    NOT NULL DEFAULT 'open',         -- open | in_progress | resolved | closed
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Traffic Logs (daily aggregated)
CREATE TABLE IF NOT EXISTS traffic_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date        TEXT    NOT NULL,                         -- YYYY-MM-DD
  views       INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  unique_ips  INTEGER NOT NULL DEFAULT 0,
  source      TEXT    DEFAULT 'google_search',
  UNIQUE(campaign_id, date)
);

-- Vượt Link Tasks (từng lượt vượt link)
CREATE TABLE IF NOT EXISTS vuot_link_tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  worker_id    INTEGER REFERENCES users(id),             -- người thực hiện (null = chưa assign)
  keyword      TEXT    NOT NULL DEFAULT '',               -- từ khóa cần tìm
  target_url   TEXT    NOT NULL DEFAULT '',               -- URL đích cần truy cập
  target_page  TEXT    DEFAULT '',                        -- trang cụ thể trong website
  status       TEXT    NOT NULL DEFAULT 'pending',        -- pending | assigned | step1 | step2 | step3 | completed | expired | failed
  step1_at     DATETIME,                                 -- thời gian mở Google
  step2_at     DATETIME,                                 -- thời gian tìm kiếm từ khóa
  step3_at     DATETIME,                                 -- thời gian tìm nút lấy mã
  completed_at DATETIME,                                 -- thời gian hoàn tất
  ip_address   TEXT    DEFAULT '',                        -- IP người thực hiện
  user_agent   TEXT    DEFAULT '',                        -- browser info
  time_on_site INTEGER DEFAULT 0,                        -- giây ở trên site
  earning      REAL    NOT NULL DEFAULT 0,               -- số tiền nhận được
  code_given   TEXT    DEFAULT '',                        -- mã đã cấp
  expires_at   DATETIME,                                 -- hết hạn task
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user       ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user     ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_widgets_token      ON widgets(token);
CREATE INDEX IF NOT EXISTS idx_widgets_user       ON widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user       ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_campaign   ON traffic_logs(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_vuotlink_campaign  ON vuot_link_tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_vuotlink_worker    ON vuot_link_tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_vuotlink_status    ON vuot_link_tasks(status);
