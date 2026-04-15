-- =====================================================================
-- INDEX OPTIMIZATION SCRIPT cho traffic68.com
-- Compatible với MySQL 5.7+
-- Chạy với flag --force để bỏ qua lỗi nếu index đã tồn tại:
-- mysql -h 127.0.0.1 -u traffic68 -p'PASSWORD' traffic68 --force < server/db/add_indexes.sql
-- =====================================================================

-- ── 1. vuot_link_tasks ───────────────────────────────────────────────

-- Worker stats: covers worker/stats, worker/earnings, worker/tasks
ALTER TABLE vuot_link_tasks
  ADD INDEX idx_vlt_worker_stats
    (worker_id, status, bot_detected, is_over_limit, completed_at);

-- Gateway link tasks (worker_link_id based)
ALTER TABLE vuot_link_tasks
  ADD INDEX idx_vlt_wlink_stats
    (worker_link_id, status, bot_detected, is_over_limit, completed_at);

-- Campaign daily count (dùng trong todaySubquery)
ALTER TABLE vuot_link_tasks
  ADD INDEX idx_vlt_campaign_completed
    (campaign_id, status, completed_at);

-- IP rate limiting (check per-IP daily limit)
ALTER TABLE vuot_link_tasks
  ADD INDEX idx_vlt_ip_completed
    (ip_address, status, bot_detected, completed_at);

-- Visitor ID exclude queries
ALTER TABLE vuot_link_tasks
  ADD INDEX idx_vlt_visitor_status
    (visitor_id, status, completed_at);

-- Admin trang phân trang theo thời gian tạo
ALTER TABLE vuot_link_tasks
  ADD INDEX idx_vlt_created_at (created_at);

-- ── 2. campaigns ─────────────────────────────────────────────────────

ALTER TABLE campaigns
  ADD INDEX idx_camp_user_status (user_id, status);

ALTER TABLE campaigns
  ADD INDEX idx_camp_status_type (status, traffic_type);

-- ── 3. wallets ───────────────────────────────────────────────────────

ALTER TABLE wallets
  ADD INDEX idx_wallets_user_type (user_id, type);

-- ── 4. transactions ──────────────────────────────────────────────────

ALTER TABLE transactions
  ADD INDEX idx_tx_user_created (user_id, created_at);

ALTER TABLE transactions
  ADD INDEX idx_tx_type_status (type, status, created_at);

-- ── 5. worker_links ──────────────────────────────────────────────────

ALTER TABLE worker_links
  ADD INDEX idx_wl_worker_id (worker_id);

-- ── Verify ───────────────────────────────────────────────────────────
SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) as columns
FROM information_schema.STATISTICS
WHERE table_schema = DATABASE()
  AND index_name LIKE 'idx_%'
ORDER BY table_name, index_name;
