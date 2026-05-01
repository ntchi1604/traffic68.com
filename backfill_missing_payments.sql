-- Script để bù tiền cho các task hợp lệ bị thiếu payment trong ngày hôm nay
-- CẢNH BÁO: Chạy script này trong transaction và kiểm tra kỹ trước khi COMMIT

-- Bước 1: Kiểm tra số lượng task bị thiếu payment hôm nay
SELECT
    COUNT(*) as total_missing,
    SUM(t.earning) as total_missing_amount
FROM vuot_link_tasks t
WHERE t.status = 'completed'
  AND DATE(t.completed_at) = CURDATE()
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0
  AND t.worker_id IS NOT NULL
  AND t.worker_link_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM transactions tx
      WHERE tx.user_id = t.worker_id
        AND tx.wallet_type = 'earning'
        AND tx.note LIKE CONCAT('%#', t.id)
        AND tx.status = 'completed'
  );

-- Bước 2: Xem chi tiết các task bị thiếu (để review trước khi bù)
SELECT
    t.id,
    t.worker_id,
    t.earning,
    t.completed_at,
    t.keyword,
    c.name as campaign_name,
    u.username,
    u.email
FROM vuot_link_tasks t
JOIN campaigns c ON t.campaign_id = c.id
JOIN users u ON u.id = t.worker_id
WHERE t.status = 'completed'
  AND DATE(t.completed_at) = CURDATE()
  AND t.bot_detected = 0
  AND t.is_over_limit = 0
  AND t.earning > 0
  AND t.worker_id IS NOT NULL
  AND t.worker_link_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM transactions tx
      WHERE tx.user_id = t.worker_id
        AND tx.wallet_type = 'earning'
        AND tx.note LIKE CONCAT('%#', t.id)
        AND tx.status = 'completed'
  )
ORDER BY t.completed_at DESC;

-- Bước 3: BÙ TIỀN (chỉ chạy sau khi đã kiểm tra kỹ ở Bước 1 và 2)
-- CẢNH BÁO: Uncomment và chạy từng bước một

-- START TRANSACTION;

-- 3.1: Tạo transactions cho các task bị thiếu
-- INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note, created_at)
-- SELECT
--     t.worker_id,
--     'earning',
--     'earning',
--     'system',
--     t.earning,
--     'completed',
--     CONCAT('VL-BACKFILL-', t.id),
--     CONCAT('[Bù tiền] ', t.keyword, ' - ', c.name, ' #', t.id),
--     t.completed_at
-- FROM vuot_link_tasks t
-- JOIN campaigns c ON t.campaign_id = c.id
-- WHERE t.status = 'completed'
--   AND DATE(t.completed_at) = CURDATE()
--   AND t.bot_detected = 0
--   AND t.is_over_limit = 0
--   AND t.earning > 0
--   AND t.worker_id IS NOT NULL
--   AND t.worker_link_id IS NULL
--   AND NOT EXISTS (
--       SELECT 1 FROM transactions tx
--       WHERE tx.user_id = t.worker_id
--         AND tx.wallet_type = 'earning'
--         AND tx.note LIKE CONCAT('%#', t.id)
--         AND tx.status = 'completed'
--   );

-- 3.2: Cập nhật balance trong wallets
-- INSERT INTO wallets (user_id, type, balance)
-- SELECT
--     t.worker_id,
--     'earning',
--     SUM(t.earning)
-- FROM vuot_link_tasks t
-- WHERE t.status = 'completed'
--   AND DATE(t.completed_at) = CURDATE()
--   AND t.bot_detected = 0
--   AND t.is_over_limit = 0
--   AND t.earning > 0
--   AND t.worker_id IS NOT NULL
--   AND t.worker_link_id IS NULL
--   AND NOT EXISTS (
--       SELECT 1 FROM transactions tx
--       WHERE tx.user_id = t.worker_id
--         AND tx.wallet_type = 'earning'
--         AND tx.note LIKE CONCAT('%#', t.id)
--         AND tx.status = 'completed'
--   )
-- GROUP BY t.worker_id
-- ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance);

-- 3.3: Kiểm tra lại sau khi bù
-- SELECT
--     COUNT(*) as remaining_missing,
--     SUM(t.earning) as remaining_amount
-- FROM vuot_link_tasks t
-- WHERE t.status = 'completed'
--   AND DATE(t.completed_at) = CURDATE()
--   AND t.bot_detected = 0
--   AND t.is_over_limit = 0
--   AND t.earning > 0
--   AND t.worker_id IS NOT NULL
--   AND t.worker_link_id IS NULL
--   AND NOT EXISTS (
--       SELECT 1 FROM transactions tx
--       WHERE tx.user_id = t.worker_id
--         AND tx.wallet_type = 'earning'
--         AND tx.note LIKE CONCAT('%#', t.id)
--         AND tx.status = 'completed'
--   );

-- Nếu kết quả OK thì COMMIT, nếu không thì ROLLBACK
-- COMMIT;
-- ROLLBACK;
