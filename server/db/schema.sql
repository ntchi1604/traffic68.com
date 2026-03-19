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
  traffic_type VARCHAR(50) NOT NULL DEFAULT 'google_search',
  version      INT NOT NULL DEFAULT 1,
  budget       DECIMAL(15,2) NOT NULL DEFAULT 0,
  cpc          DECIMAL(10,2) NOT NULL DEFAULT 0,
  daily_views  INT NOT NULL DEFAULT 500,
  total_views  INT NOT NULL DEFAULT 1000,
  view_by_hour INT NOT NULL DEFAULT 0,
  keyword      VARCHAR(255) DEFAULT '',
  target_page  VARCHAR(500) DEFAULT '',
  time_on_site VARCHAR(50)  DEFAULT '60-120',
  status       VARCHAR(20)  NOT NULL DEFAULT 'running',
  views_done   INT NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  config     TEXT NOT NULL,
  is_active  TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  type       VARCHAR(20) NOT NULL DEFAULT 'info',
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
  id          INT PRIMARY KEY AUTO_INCREMENT,
  campaign_id INT NOT NULL,
  date        DATE NOT NULL,
  views       INT NOT NULL DEFAULT 0,
  clicks      INT NOT NULL DEFAULT 0,
  unique_ips  INT NOT NULL DEFAULT 0,
  source      VARCHAR(50) DEFAULT 'google_search',
  UNIQUE KEY unique_campaign_date (campaign_id, date),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vuot_link_tasks (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  campaign_id  INT NOT NULL,
  worker_id    INT DEFAULT NULL,
  keyword      VARCHAR(255) NOT NULL DEFAULT '',
  target_url   TEXT NOT NULL,
  target_page  VARCHAR(500) DEFAULT '',
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  step1_at     DATETIME DEFAULT NULL,
  step2_at     DATETIME DEFAULT NULL,
  step3_at     DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  ip_address   VARCHAR(100) DEFAULT '',
  user_agent   TEXT DEFAULT NULL,
  time_on_site INT DEFAULT 0,
  earning      DECIMAL(10,2) NOT NULL DEFAULT 0,
  code_given   VARCHAR(100) DEFAULT '',
  expires_at   DATETIME DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES users(id)
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
