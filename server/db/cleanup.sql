-- ============================================================
-- SCRIPT DỌN DẸP DATABASE — traffic68.com
-- Chạy định kỳ (ví dụ mỗi tuần) để giảm lag
--
-- ❗ Đọc kỹ từng section trước khi chạy
-- ❗ Backup trước: mysqldump -h 127.0.0.1 -u traffic68 -p traffic68 > backup.sql
-- ============================================================

-- ============================================================
-- 1. VUOT_LINK_TASKS — bảng lớn nhất, tăng nhanh nhất
-- ============================================================

-- [AN TOÀN] Xóa task đã expired (không bao giờ completed) > 3 ngày
-- Đây là tasks mà visitor lấy nhưng không làm → không có giá trị
DELETE FROM vuot_link_tasks
WHERE status IN ('pending', 'step1', 'step2', 'step3')
  AND expires_at < DATE_SUB(NOW(), INTERVAL 3 DAY);

-- [AN TOÀN] Xóa task completed + bot_detected cũ > 30 ngày
-- Đây là rows rác từ bot, không ảnh hưởng doanh thu/thống kê
DELETE FROM vuot_link_tasks
WHERE status = 'completed'
  AND bot_detected = 1
  AND completed_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- [AN TOÀN] Xóa task completed > 180 ngày (giữ 6 tháng đủ báo cáo)
-- ⚠️  Chỉnh số ngày nếu bạn cần lịch sử lâu hơn
DELETE FROM vuot_link_tasks
WHERE status = 'completed'
  AND bot_detected = 0
  AND completed_at < DATE_SUB(NOW(), INTERVAL 180 DAY);

-- ============================================================
-- 2. SECURITY_LOGS — log bot detection, tăng rất nhanh
-- ============================================================

-- [AN TOÀN] Giữ 60 ngày gần nhất, xóa cũ hơn
DELETE FROM security_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY);

-- ============================================================
-- 3. NOTIFICATIONS — thông báo đã đọc lâu ngày
-- ============================================================

-- [AN TOÀN] Xóa thông báo đã đọc > 30 ngày
DELETE FROM notifications
WHERE is_read = 1
  AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- [AN TOÀN] Xóa thông báo chưa đọc > 90 ngày (quá cũ, không cần nữa)
DELETE FROM notifications
WHERE is_read = 0
  AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- ============================================================
-- 4. TRAFFIC_LOGS — daily summary, ít nguy hiểm hơn
-- ============================================================

-- [OPTIONAL] Giữ 1 năm traffic log
-- ⚠️  Bỏ comment nếu muốn xóa (ảnh hưởng báo cáo dài hạn)
-- DELETE FROM traffic_logs
-- WHERE date < DATE_SUB(CURDATE(), INTERVAL 365 DAY);

-- ============================================================
-- 5. TRANSACTIONS — giữ toàn bộ cho kế toán
--    KHÔNG xóa transactions (cần audit trail)
-- ============================================================
-- Chỉ cần tạo summary theo tháng nếu bảng quá lớn (> 10 triệu rows)

-- ============================================================
-- 6. TỐI ƯU HÓA BẢNG SAU KHI XÓA
-- Giải phóng disk space + rebuild index sau DELETE lớn
-- ⚠️  OPTIMIZE TABLE lock bảng trong thời gian chạy
--     Chạy vào giờ thấp tải (ví dụ 3-4 giờ sáng)
-- ============================================================
OPTIMIZE TABLE vuot_link_tasks;
OPTIMIZE TABLE security_logs;
OPTIMIZE TABLE notifications;

-- ============================================================
-- 7. KIỂM TRA KÍCH THƯỚC BẢNG (chạy trước/sau để so sánh)
-- ============================================================
SELECT
  table_name,
  ROUND(data_length / 1024 / 1024, 1)   AS data_MB,
  ROUND(index_length / 1024 / 1024, 1)  AS index_MB,
  ROUND((data_length + index_length) / 1024 / 1024, 1) AS total_MB,
  table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;
