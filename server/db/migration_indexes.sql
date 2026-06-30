-- ═══════════════════════════════════════════════════════
--  Migration: Thêm indexes cho performance
--  Chạy 1 lần trên DB đã tồn tại
--  Nếu báo "Duplicate key name" thì index đã có, bỏ qua
-- ═══════════════════════════════════════════════════════

-- ── transactions ──
ALTER TABLE transactions ADD INDEX idx_tx_type_status_created (type, status, created_at);
ALTER TABLE transactions ADD INDEX idx_tx_created_at (created_at);
ALTER TABLE transactions ADD INDEX idx_tx_user_id (user_id);

-- ── vuot_link_tasks ──
ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_worker_completed (worker_id, status, completed_at);
ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_wl_completed (worker_link_id, status, completed_at);
ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_campaign_status (campaign_id, status, bot_detected);
ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_completed_at (completed_at);
ALTER TABLE vuot_link_tasks ADD INDEX idx_vlt_created_at (created_at);

-- ── campaigns ──
ALTER TABLE campaigns ADD INDEX idx_camp_user_id (user_id);
ALTER TABLE campaigns ADD INDEX idx_camp_status (status);
ALTER TABLE campaigns ADD INDEX idx_camp_created_at (created_at);

-- ── users ──
ALTER TABLE users ADD INDEX idx_users_created_at (created_at);
ALTER TABLE users ADD INDEX idx_users_role (role);

-- ── support_tickets ──
ALTER TABLE support_tickets ADD INDEX idx_tickets_status (status);
