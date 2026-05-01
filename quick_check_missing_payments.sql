-- Script kiểm tra nhanh các task thiếu payment (chỉ 24h gần nhất)

-- 1. Đếm tổng số task có earning trong 24h
SELECT
    COUNT(*) as total_tasks,
    SUM(earning) as total_earning,
    COUNT(DISTINCT worker_id) as unique_workers,
    COUNT(DISTINCT worker_link_id) as unique_gateway_links
FROM vuot_link_tasks
WHERE status = 'completed'
  AND completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND bot_detected = 0
  AND is_over_limit = 0
  AND earning > 0;

-- 2. Kiểm tra task có earning nhưng không có transaction (24h)
-- Simplified version - chỉ check worker_id
SELECT
    t.id,
    t.worker_id,
    t.worker_link_id,
    t.ref_worker_id,
    t.earning,
    t.completed_at,
    t.keyword,
    c.name as campaign_name
FROM vuot_link_tasks t
JOIN campaigns c ON t.campaign_id = c.id
WHERE t.status = 'completed'
  AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0
  AND t.worker_id IS NOT NULL
  AND t.worker_link_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM transactions tx
      WHERE tx.user_id = t.worker_id
        AND tx.note LIKE CONCAT('%#', t.id)
        AND tx.status = 'completed'
        LIMIT 1
  )
LIMIT 20;

-- 3. Kiểm tra gateway link thiếu payment (24h)
SELECT
    t.id,
    t.worker_link_id,
    wl.worker_id as gateway_owner,
    wl.slug,
    t.earning,
    t.completed_at,
    t.keyword
FROM vuot_link_tasks t
JOIN worker_links wl ON t.worker_link_id = wl.id
WHERE t.status = 'completed'
  AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0
  AND t.worker_link_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM transactions tx
      WHERE tx.user_id = wl.worker_id
        AND tx.note LIKE CONCAT('%#', t.id)
        AND tx.status = 'completed'
        LIMIT 1
  )
LIMIT 20;

-- 4. Thống kê theo giờ (24h gần nhất)
SELECT
    DATE_FORMAT(completed_at, '%Y-%m-%d %H:00') as hour,
    COUNT(*) as tasks,
    SUM(earning) as total_earning,
    COUNT(DISTINCT worker_id) as workers
FROM vuot_link_tasks
WHERE status = 'completed'
  AND completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND bot_detected = 0
  AND is_over_limit = 0
  AND earning > 0
GROUP BY DATE_FORMAT(completed_at, '%Y-%m-%d %H:00')
ORDER BY hour DESC;

-- 5. Kiểm tra các task có earning = 0 dù completed (có thể là bug pricing group)
SELECT
    t.id,
    t.worker_id,
    t.worker_link_id,
    t.ref_worker_id,
    t.earning,
    t.completed_at,
    t.keyword,
    c.name as campaign_name,
    c.traffic_type,
    c.time_on_site,
    u.pricing_group_id
FROM vuot_link_tasks t
JOIN campaigns c ON t.campaign_id = c.id
LEFT JOIN users u ON u.id = COALESCE(t.worker_id, t.ref_worker_id)
WHERE t.status = 'completed'
  AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning = 0
  AND (t.worker_id IS NOT NULL OR t.worker_link_id IS NOT NULL OR t.ref_worker_id IS NOT NULL)
LIMIT 50;
