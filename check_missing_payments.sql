-- Kiểm tra các task completed, clean (bot_detected=0, is_over_limit=0)
-- nhưng KHÔNG có transaction tương ứng cho worker
-- Chỉ kiểm tra 24h gần nhất

-- Case 1: Task trực tiếp từ worker (worker_id NOT NULL, worker_link_id IS NULL)
-- Phải có transaction với type='earning' và method='system'
SELECT
    t.id as task_id,
    t.worker_id,
    t.worker_link_id,
    t.ref_worker_id,
    t.campaign_id,
    t.keyword,
    t.earning,
    t.completed_at,
    t.bot_detected,
    t.is_over_limit,
    c.name as campaign_name,
    c.user_id as buyer_id,
    'CASE_1_DIRECT_WORKER' as issue_type
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
        AND tx.wallet_type = 'earning'
        AND tx.type = 'earning'
        AND tx.method = 'system'
        AND tx.note LIKE CONCAT('%#', t.id)
        AND tx.status = 'completed'
  )
ORDER BY t.completed_at DESC
LIMIT 100;

-- Case 2: Task từ gateway link (worker_link_id NOT NULL)
-- Phải có transaction với type='earning' và method='gateway_link'
SELECT
    t.id as task_id,
    t.worker_id,
    t.worker_link_id,
    wl.worker_id as gateway_owner_id,
    wl.slug as gateway_slug,
    t.ref_worker_id,
    t.campaign_id,
    t.keyword,
    t.earning,
    t.completed_at,
    t.bot_detected,
    t.is_over_limit,
    c.name as campaign_name,
    c.user_id as buyer_id,
    'CASE_2_GATEWAY_LINK' as issue_type
FROM vuot_link_tasks t
JOIN campaigns c ON t.campaign_id = c.id
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
        AND tx.wallet_type = 'earning'
        AND tx.type = 'earning'
        AND tx.method = 'gateway_link'
        AND tx.note LIKE CONCAT('%#', t.id)
        AND tx.status = 'completed'
  )
ORDER BY t.completed_at DESC
LIMIT 100;

-- Case 3: Task từ ref link (ref_worker_id NOT NULL, worker_id IS NULL, worker_link_id IS NULL)
-- Phải có transaction với type='earning' và method='ref_link'
SELECT
    t.id as task_id,
    t.worker_id,
    t.worker_link_id,
    t.ref_worker_id,
    t.campaign_id,
    t.keyword,
    t.earning,
    t.completed_at,
    t.bot_detected,
    t.is_over_limit,
    c.name as campaign_name,
    c.user_id as buyer_id,
    'CASE_3_REF_LINK' as issue_type
FROM vuot_link_tasks t
JOIN campaigns c ON t.campaign_id = c.id
WHERE t.status = 'completed'
  AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0
  AND t.ref_worker_id IS NOT NULL
  AND t.worker_id IS NULL
  AND t.worker_link_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM transactions tx
      WHERE tx.user_id = t.ref_worker_id
        AND tx.wallet_type = 'earning'
        AND tx.type = 'earning'
        AND tx.method = 'ref_link'
        AND tx.note LIKE CONCAT('%#', t.id)
        AND tx.status = 'completed'
  )
ORDER BY t.completed_at DESC
LIMIT 100;

-- Tổng hợp: Tất cả các task có earning > 0 nhưng không có transaction (24h gần nhất)
SELECT
    COUNT(*) as total_missing,
    SUM(t.earning) as total_missing_amount,
    DATE_FORMAT(t.completed_at, '%Y-%m-%d %H:00') as hour
FROM vuot_link_tasks t
WHERE t.status = 'completed'
  AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0
  AND NOT EXISTS (
      SELECT 1 FROM transactions tx
      WHERE (
          (tx.user_id = t.worker_id AND tx.method = 'system')
          OR (tx.user_id IN (SELECT worker_id FROM worker_links WHERE id = t.worker_link_id) AND tx.method = 'gateway_link')
          OR (tx.user_id = t.ref_worker_id AND tx.method = 'ref_link')
      )
      AND tx.wallet_type = 'earning'
      AND tx.type = 'earning'
      AND tx.note LIKE CONCAT('%#', t.id)
      AND tx.status = 'completed'
  )
GROUP BY DATE_FORMAT(t.completed_at, '%Y-%m-%d %H:00')
ORDER BY hour DESC;

-- Query đơn giản hơn: Đếm nhanh số lượng task có earning > 0 trong 24h gần nhất
SELECT
    COUNT(*) as total_tasks_with_earning,
    COUNT(DISTINCT t.worker_id) as unique_workers,
    COUNT(DISTINCT t.worker_link_id) as unique_gateway_links,
    SUM(t.earning) as total_earning
FROM vuot_link_tasks t
WHERE t.status = 'completed'
  AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0;
