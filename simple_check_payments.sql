-- Script đơn giản để kiểm tra từng bước (tránh timeout)

-- Bước 1: Đếm tổng task có earning trong 24h
SELECT
    COUNT(*) as total_tasks,
    SUM(earning) as total_earning
FROM vuot_link_tasks
WHERE status = 'completed'
  AND completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND bot_detected = 0
  AND is_over_limit = 0
  AND earning > 0;

-- Bước 2: Lấy 10 task mới nhất có earning
SELECT
    id,
    worker_id,
    worker_link_id,
    ref_worker_id,
    earning,
    completed_at,
    keyword
FROM vuot_link_tasks
WHERE status = 'completed'
  AND completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND bot_detected = 0
  AND is_over_limit = 0
  AND earning > 0
ORDER BY completed_at DESC
LIMIT 10;

-- Bước 3: Kiểm tra 1 task cụ thể có transaction không (thay 2526609 bằng task_id thực tế)
-- SELECT * FROM transactions WHERE note LIKE '%#2526609%';

-- Bước 4: Tìm task có earning nhưng KHÔNG có transaction (simplified)
SELECT
    t.id,
    t.worker_id,
    t.earning,
    t.completed_at
FROM vuot_link_tasks t
WHERE t.status = 'completed'
  AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0
  AND t.worker_id IS NOT NULL
  AND t.worker_link_id IS NULL
  AND t.id NOT IN (
      SELECT DISTINCT CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(note, '#', -1), ' ', 1) AS UNSIGNED)
      FROM transactions
      WHERE wallet_type = 'earning'
        AND status = 'completed'
        AND note LIKE '%#%'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  )
LIMIT 20;
