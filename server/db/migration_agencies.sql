ALTER TABLE users ADD COLUMN agency_id INT DEFAULT NULL AFTER referred_by;

CREATE TABLE IF NOT EXISTS agencies (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  owner_id            INT NOT NULL,
  domain              VARCHAR(255) NOT NULL UNIQUE,
  name                VARCHAR(255) NOT NULL DEFAULT 'Hệ Thống Traffic',
  logo_url            TEXT DEFAULT NULL,
  primary_color       VARCHAR(50)  DEFAULT '#0ea5e9',
  bank_name           VARCHAR(100) DEFAULT NULL,
  bank_account_name   VARCHAR(255) DEFAULT NULL,
  bank_account_number VARCHAR(100) DEFAULT NULL,
  contact_email       VARCHAR(255) DEFAULT NULL,
  contact_phone       VARCHAR(50)  DEFAULT NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Thêm khoá ngoại cho users tham chiếu tới agencies
ALTER TABLE users ADD CONSTRAINT fk_user_agency FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS agency_prices (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  agency_id      INT NOT NULL,
  traffic_type   VARCHAR(50) NOT NULL,
  duration       VARCHAR(20) NOT NULL,
  v1_price       INT NOT NULL DEFAULT 0,
  v2_price       INT NOT NULL DEFAULT 0,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_agency_tier (agency_id, traffic_type, duration),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
