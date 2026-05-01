-- Tạo bảng để log các payment failures
CREATE TABLE IF NOT EXISTS payment_failures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(15,0) NOT NULL,
  error_message TEXT,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  resolved_by INT NULL,
  UNIQUE KEY uniq_task_user (task_id, user_id),
  INDEX idx_created (created_at),
  INDEX idx_resolved (resolved_at),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Thêm comment
ALTER TABLE payment_failures COMMENT = 'Log các payment failures để admin có thể bù sau';
