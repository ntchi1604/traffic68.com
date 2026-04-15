-- =====================================================================
-- INDEX OPTIMIZATION SCRIPT cho traffic68.com
-- Chạy lệnh này 1 lần trên MySQL để tăng tốc toàn bộ các API chậm
-- Mỗi lệnh ADD INDEX IF NOT EXISTS an toàn, không ảnh hưởng data
-- =====================================================================

-- ── 1. vuot_link_tasks (bảng lớn nhất, được query nhiều nhất) ────────

-- Index cho worker queries (worker/stats, worker/earnings, worker/tasks)
-- Covers: worker_id + status + bot_detected + is_over_limit + completed_at
ALTER TABLE vuot_link_tasks
  ADD INDEX IF NOT EXISTS idx_vlt_worker_stats
    (worker_id, status, bot_detected, is_over_limit, completed_at);

-- Index cho gateway link tasks (worker_link_id based)
ALTER TABLE vuot_link_tasks
  ADD INDEX IF NOT EXISTS idx_vlt_wlink_stats
    (worker_link_id, status, bot_detected, is_over_limit, completed_at);

-- Index cho campaign daily count (dùng trong campaignWhere + todaySubquery)
ALTER TABLE vuot_link_tasks
  ADD INDEX IF NOT EXISTS idx_vlt_campaign_completed
    (campaign_id, status, completed_at);

-- Index cho IP-based queries (rate limit check trong task creation)
ALTER TABLE vuot_link_tasks
  ADD INDEX IF NOT EXISTS idx_vlt_ip_completed
    (ip_address, status, bot_detected, completed_at);

-- Index cho visitor_id queries (exclude campaigns done today)
ALTER TABLE vuot_link_tasks
  ADD INDEX IF NOT EXISTS idx_vlt_visitor_status
    (visitor_id, status, completed_at, expires_at);

-- Index cho admin queries: SELECT * ORDER BY created_at (phân trang)
ALTER TABLE vuot_link_tasks
  ADD INDEX IF NOT EXISTS idx_vlt_created_at (created_at);

-- ── 2. campaigns ────────────────────────────────────────────────────

-- Index cho user's campaigns list (buyer dashboard)
ALTER TABLE campaigns
  ADD INDEX IF NOT EXISTS idx_camp_user_status (user_id, status);

-- Index cho running campaigns lookup (task assignment)
ALTER TABLE campaigns
  ADD INDEX IF NOT EXISTS idx_camp_status_type (status, traffic_type);

-- ── 3. wallets ──────────────────────────────────────────────────────
-- user_id thường đã có index, nhưng đảm bảo có composite
ALTER TABLE wallets
  ADD INDEX IF NOT EXISTS idx_wallets_user_type (user_id, type);

-- ── 4. transactions ─────────────────────────────────────────────────
ALTER TABLE transactions
  ADD INDEX IF NOT EXISTS idx_tx_user_created (user_id, created_at);
ALTER TABLE transactions
  ADD INDEX IF NOT EXISTS idx_tx_type_status (type, status, created_at);

-- ── 5. worker_links ─────────────────────────────────────────────────
ALTER TABLE worker_links
  ADD INDEX IF NOT EXISTS idx_wl_worker_id (worker_id);

-- ── Verify indexes đã tạo ────────────────────────────────────────────
SHOW INDEX FROM vuot_link_tasks;
SHOW INDEX FROM campaigns;
SHOW INDEX FROM wallets;
