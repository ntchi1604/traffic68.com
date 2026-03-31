-- ═══════════════════════════════════════════════════════
--  Traffic68 — Database Schema (MySQL)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL DEFAULT '',
  username      VARCHAR(255) DEFAULT '',
  phone         VARCHAR(50)  DEFAULT '',
  avatar_url    TEXT         DEFAULT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user',
  service_type  VARCHAR(20)  NOT NULL DEFAULT 'traffic',
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  referral_code VARCHAR(50)  UNIQUE,
  referred_by   INT DEFAULT NULL,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallets (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  type       VARCHAR(20) NOT NULL DEFAULT 'main',
  balance    DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_wallet (user_id, type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaigns (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  user_id      INT NOT NULL,
  name         VARCHAR(255) NOT NULL,
  url          TEXT NOT NULL,
  url2         TEXT DEFAULT NULL,
  traffic_type VARCHAR(50) NOT NULL DEFAULT 'google_search',
  version      INT NOT NULL DEFAULT 1,
  budget       DECIMAL(15,2) NOT NULL DEFAULT 0,
  cpc          DECIMAL(10,2) NOT NULL DEFAULT 0,
  daily_views  INT NOT NULL DEFAULT 500,
  total_views  INT NOT NULL DEFAULT 1000,
  view_by_hour INT NOT NULL DEFAULT 0,
  keyword      TEXT DEFAULT NULL,
  keyword_config TEXT DEFAULT NULL,
  target_page  VARCHAR(500) DEFAULT '',
  time_on_site VARCHAR(50)  DEFAULT '60-120',
  image1_url   TEXT DEFAULT NULL,
  image2_url   TEXT DEFAULT NULL,
  discount_applied TINYINT NOT NULL DEFAULT 0,
  status       VARCHAR(20)  NOT NULL DEFAULT 'running',
  views_done   INT NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration for existing databases:
-- ALTER TABLE campaigns ADD COLUMN discount_applied TINYINT NOT NULL DEFAULT 0;
-- ALTER TABLE campaigns ADD COLUMN keyword_config TEXT DEFAULT NULL AFTER keyword;

-- Migration for existing databases (run once if columns don't exist):
-- ALTER TABLE campaigns ADD COLUMN url2 TEXT DEFAULT NULL AFTER url;
-- ALTER TABLE campaigns ADD COLUMN image2_url TEXT DEFAULT NULL AFTER image1_url;

CREATE TABLE IF NOT EXISTS transactions (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  wallet_type VARCHAR(20) NOT NULL DEFAULT 'main',
  type        VARCHAR(20) NOT NULL,
  method      VARCHAR(50) DEFAULT '',
  amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  ref_code    VARCHAR(100) UNIQUE,
  note        TEXT DEFAULT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS widgets (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  token      VARCHAR(100) NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL DEFAULT 'Nút mặc định',
  website_url VARCHAR(500) DEFAULT '',
  config     TEXT NOT NULL,
  is_active  TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration for multi-widget support (run once on existing databases):
-- ALTER TABLE widgets DROP INDEX user_id;
-- ALTER TABLE widgets ADD KEY idx_user_id (user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  type       VARCHAR(20) NOT NULL DEFAULT 'info',
  role       VARCHAR(20) NOT NULL DEFAULT 'all',
  is_read    TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS support_tickets (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  user_id      INT NOT NULL,
  subject      VARCHAR(255) NOT NULL,
  description  TEXT NOT NULL,
  priority     VARCHAR(20) NOT NULL DEFAULT 'medium',
  status       VARCHAR(20) NOT NULL DEFAULT 'open',
  admin_reply  TEXT DEFAULT NULL,
  replied_at   DATETIME DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS traffic_logs (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  campaign_id   INT NOT NULL,
  date          DATE NOT NULL,
  views         INT NOT NULL DEFAULT 0,
  clicks        INT NOT NULL DEFAULT 0,
  unique_ips    INT NOT NULL DEFAULT 0,
  source        VARCHAR(50) DEFAULT 'google_search',
  mobile_views  INT NOT NULL DEFAULT 0,
  desktop_views INT NOT NULL DEFAULT 0,
  tablet_views  INT NOT NULL DEFAULT 0,
  UNIQUE KEY unique_campaign_date (campaign_id, date),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vuot_link_tasks (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  campaign_id  INT NOT NULL,
  worker_id    INT DEFAULT NULL,
  worker_link_id INT DEFAULT NULL,
  ref_worker_id  INT DEFAULT NULL,
  keyword      VARCHAR(255) NOT NULL DEFAULT '',
  target_url   TEXT NOT NULL,
  target_page  VARCHAR(500) DEFAULT '',
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  completed_at DATETIME DEFAULT NULL,
  ip_address   VARCHAR(100) DEFAULT '',
  user_agent   TEXT DEFAULT NULL,
  visitor_id   VARCHAR(255) DEFAULT NULL,
  bot_detected TINYINT NOT NULL DEFAULT 0,
  security_detail TEXT DEFAULT NULL,
  time_on_site INT DEFAULT 0,
  earning      DECIMAL(10,2) NOT NULL DEFAULT 0,
  code_given   VARCHAR(100) DEFAULT '',
  expires_at   DATETIME DEFAULT NULL,
  ip_country   VARCHAR(10)  DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_visitor_status    (visitor_id, status, created_at),
  KEY idx_ip_status         (ip_address, status, created_at),
  KEY idx_ip_ua_status      (ip_address(50), status),
  KEY idx_status_expires    (status, expires_at),
  FOREIGN KEY (campaign_id)    REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id)      REFERENCES users(id),
  FOREIGN KEY (worker_link_id) REFERENCES worker_links(id) ON DELETE SET NULL,
  FOREIGN KEY (ref_worker_id)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS pricing_tiers (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  traffic_type   VARCHAR(50) NOT NULL,
  duration       VARCHAR(20) NOT NULL,
  v1_price       INT NOT NULL DEFAULT 0,
  v1_discount    INT NOT NULL DEFAULT 0,
  v2_price       INT NOT NULL DEFAULT 0,
  v2_discount    INT NOT NULL DEFAULT 0,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tier (traffic_type, duration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Migration cho DB đang chạy (chạy 1 lần nếu bảng đã tồn tại) ──
-- Lưu ý: MySQL 5.x không hỗ trợ IF NOT EXISTS trong ALTER TABLE ADD COLUMN
-- Nếu báo "Duplicate column name" thì cột đã tồn tại, bỏ qua câu đó.
-- ALTER TABLE vuot_link_tasks ADD COLUMN worker_link_id INT DEFAULT NULL AFTER worker_id;
-- ALTER TABLE vuot_link_tasks ADD COLUMN ref_worker_id  INT DEFAULT NULL AFTER worker_link_id;
-- ALTER TABLE vuot_link_tasks ADD CONSTRAINT fk_vlt_worker_link FOREIGN KEY (worker_link_id) REFERENCES worker_links(id) ON DELETE SET NULL;
-- ALTER TABLE vuot_link_tasks ADD CONSTRAINT fk_vlt_ref_worker  FOREIGN KEY (ref_worker_id)  REFERENCES users(id) ON DELETE SET NULL;
-- ALTER TABLE worker_links ADD COLUMN hidden TINYINT NOT NULL DEFAULT 0 AFTER destination_url;

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS worker_links (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  worker_id       INT NOT NULL,
  slug            VARCHAR(20) NOT NULL UNIQUE,
  title           VARCHAR(255),
  destination_url VARCHAR(2048) NOT NULL,
  hidden          TINYINT NOT NULL DEFAULT 0,
  click_count     INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  earning         DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
