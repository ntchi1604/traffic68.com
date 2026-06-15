const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { authMiddleware: auth } = require('../middleware/auth');

// Public: Lấy cấu hình agency dựa theo domain (Dùng cho web con)
router.get('/config', async (req, res) => {
  try {
    const domain = req.query.domain;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, domain, logo_url, favicon_url, primary_color, bank_name, bank_account_name, bank_account_number, contact_email, contact_phone, payment_config FROM agencies WHERE domain = ? AND status = "active"',
      [domain]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agency not found for this domain' });
    }

    const agency = rows[0];
    let pc = null;
    try { pc = agency.payment_config ? (typeof agency.payment_config === 'string' ? JSON.parse(agency.payment_config) : agency.payment_config) : null; } catch { pc = null; }

    // Strip secrets — chỉ trả flag enabled + thông tin hiển thị công khai
    const safePayment = pc ? {
      sepay: { enabled: !!pc.sepay?.enabled, bankName: pc.sepay?.bankName || '', accountNumber: pc.sepay?.accountNumber || '', accountHolder: pc.sepay?.accountHolder || '' },
      pay666: { enabled: !!pc.pay666?.enabled },
      manualBank: { enabled: !!pc.manualBank?.enabled, bankName: pc.manualBank?.bankName || '', accountNumber: pc.manualBank?.accountNumber || '', accountHolder: pc.manualBank?.accountHolder || '', branch: pc.manualBank?.branch || '' },
      bep20: { enabled: !!pc.bep20?.enabled, address: pc.bep20?.address || '', auto: !!pc.bep20?.auto },
      trc20: { enabled: !!pc.trc20?.enabled, address: pc.trc20?.address || '', auto: !!pc.trc20?.auto },
      vndRate: pc.vndRate || null,
    } : null;

    delete agency.payment_config;
    res.json({ ...agency, payment_config: safePayment });
  } catch (error) {
    console.error('Lỗi khi lấy config agency:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Lấy cấu hình agency của đại lý đang đăng nhập
router.get('/my', auth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM agencies WHERE owner_id = ?',
      [req.userId]
    );

    if (rows.length === 0) {
      return res.json(null);
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Lỗi lấy thông tin agency:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Cập nhật hoặc tạo cấu hình agency
router.post('/setup', auth, async (req, res) => {
  try {
    const { domain, name, logo_url, primary_color, bank_name, bank_account_name, bank_account_number, contact_email, contact_phone } = req.body;
    
    if (!domain) return res.status(400).json({ error: 'Tên miền là bắt buộc' });
    
    const pool = getPool();
    
    // Check nếu domain đã bị người khác đăng ký
    const [exist] = await pool.query('SELECT id, owner_id FROM agencies WHERE domain = ?', [domain]);
    if (exist.length > 0 && exist[0].owner_id !== req.userId) {
      return res.status(400).json({ error: 'Tên miền này đã được sử dụng bởi người khác' });
    }

    // Check xem user đã có agency chưa
    const [myAgency] = await pool.query('SELECT id FROM agencies WHERE owner_id = ?', [req.userId]);
    
    if (myAgency.length > 0) {
      // Update
      await pool.query(
        `UPDATE agencies SET domain=?, name=?, logo_url=?, primary_color=?, bank_name=?, bank_account_name=?, bank_account_number=?, contact_email=?, contact_phone=? WHERE owner_id=?`,
        [domain, name || 'Hệ Thống Traffic', logo_url || '', primary_color || '#0ea5e9', bank_name || '', bank_account_name || '', bank_account_number || '', contact_email || '', contact_phone || '', req.userId]
      );
      // Đảm bảo owner có agency_role + agency_id
      const agencyId = myAgency[0].id;
      await pool.query(`UPDATE users SET agency_role = 'owner', agency_id = ? WHERE id = ? AND (agency_role IS NULL OR agency_role != 'owner')`, [agencyId, req.userId]);
    } else {
      // Insert
      const [insertResult] = await pool.query(
        `INSERT INTO agencies (owner_id, domain, name, logo_url, primary_color, bank_name, bank_account_name, bank_account_number, contact_email, contact_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, domain, name || 'Hệ Thống Traffic', logo_url || '', primary_color || '#0ea5e9', bank_name || '', bank_account_name || '', bank_account_number || '', contact_email || '', contact_phone || '']
      );
      // Set owner role + agency_id
      await pool.query(`UPDATE users SET agency_role = 'owner', agency_id = ? WHERE id = ?`, [insertResult.insertId, req.userId]);
    }

    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error) {
    console.error('Lỗi lưu agency:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Lấy danh sách user (buyer) của agency
router.get('/buyers', auth, async (req, res) => {
  try {
    const pool = getPool();
    
    // Tìm ID agency của user này
    const [agency] = await pool.query('SELECT id FROM agencies WHERE owner_id = ?', [req.userId]);
    if (agency.length === 0) return res.json([]);

    const [buyers] = await pool.query(
      'SELECT id, name, email, username, created_at, status FROM users WHERE agency_id = ? ORDER BY id DESC',
      [agency[0].id]
    );

    res.json(buyers);
  } catch (error) {
    console.error('Lỗi lấy danh sách buyer:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Lấy danh sách giao dịch nạp tiền của buyer thuộc agency
router.get('/transactions', auth, async (req, res) => {
  try {
    const pool = getPool();
    const [agency] = await pool.query('SELECT id FROM agencies WHERE owner_id = ?', [req.userId]);
    if (agency.length === 0) return res.json([]);

    const [transactions] = await pool.query(
      `SELECT t.*, u.email, u.username 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE u.agency_id = ? AND t.type = 'deposit'
       ORDER BY t.created_at DESC`,
      [agency[0].id]
    );

    res.json(transactions);
  } catch (error) {
    console.error('Lỗi lấy danh sách giao dịch:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Duyệt giao dịch nạp tiền
router.post('/transactions/:id/approve', auth, async (req, res) => {
  try {
    const pool = getPool();
    const txId = req.params.id;

    const [agency] = await pool.query('SELECT id FROM agencies WHERE owner_id = ?', [req.userId]);
    if (agency.length === 0) return res.status(403).json({ error: 'Bạn không phải đại lý' });

    // Kiểm tra giao dịch
    const [txs] = await pool.query(
      `SELECT t.* FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ? AND u.agency_id = ? AND t.type = 'deposit' AND t.status = 'pending'`,
      [txId, agency[0].id]
    );

    if (txs.length === 0) {
      return res.status(404).json({ error: 'Giao dịch không tồn tại hoặc đã được xử lý' });
    }

    const tx = txs[0];

    // Sử dụng transaction để đảm bảo atomicity
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Cập nhật trạng thái
      await conn.query("UPDATE transactions SET status = 'completed' WHERE id = ?", [txId]);

      // Cộng tiền cho buyer
      await conn.query(
        "UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?",
        [tx.amount, tx.user_id, tx.wallet_type || 'main']
      );

      // Tạo thông báo cho buyer
      await conn.query(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [tx.user_id, 'Nạp tiền thành công', `Giao dịch nạp ${Number(tx.amount).toLocaleString('vi-VN')} đ đã được duyệt.`, 'success', 'buyer']
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    res.json({ success: true, message: 'Đã duyệt thành công' });
  } catch (error) {
    console.error('Lỗi duyệt giao dịch:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Từ chối giao dịch nạp tiền
router.post('/transactions/:id/reject', auth, async (req, res) => {
  try {
    const pool = getPool();
    const txId = req.params.id;

    const [agency] = await pool.query('SELECT id FROM agencies WHERE owner_id = ?', [req.userId]);
    if (agency.length === 0) return res.status(403).json({ error: 'Bạn không phải đại lý' });

    const [txs] = await pool.query(
      `SELECT t.* FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = ? AND u.agency_id = ? AND t.type = 'deposit' AND t.status = 'pending'`,
      [txId, agency[0].id]
    );

    if (txs.length === 0) {
      return res.status(404).json({ error: 'Giao dịch không tồn tại hoặc đã được xử lý' });
    }

    await pool.query("UPDATE transactions SET status = 'rejected' WHERE id = ?", [txId]);

    res.json({ success: true, message: 'Đã từ chối giao dịch' });
  } catch (error) {
    console.error('Lỗi từ chối giao dịch:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Lấy bảng giá do đại lý thiết lập
router.get('/prices', auth, async (req, res) => {
  try {
    const pool = getPool();
    const [agency] = await pool.query('SELECT id FROM agencies WHERE owner_id = ?', [req.userId]);
    if (agency.length === 0) return res.json([]);

    const [prices] = await pool.query('SELECT * FROM agency_prices WHERE agency_id = ?', [agency[0].id]);
    res.json(prices);
  } catch (error) {
    console.error('Lỗi lấy bảng giá:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Private: Cập nhật bảng giá cho đại lý
router.post('/prices', auth, async (req, res) => {
  try {
    const { prices } = req.body;
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'Invalid data' });

    const pool = getPool();
    const [agency] = await pool.query('SELECT id FROM agencies WHERE owner_id = ?', [req.userId]);
    if (agency.length === 0) return res.status(403).json({ error: 'Bạn không phải đại lý' });

    const agencyId = agency[0].id;
    
    // Clear old prices and insert new ones
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM agency_prices WHERE agency_id = ?', [agencyId]);
      
      for (const p of prices) {
        if (!p.traffic_type || !p.duration || !p.v1_price || !p.v2_price) continue;
        await conn.query(
          'INSERT INTO agency_prices (agency_id, traffic_type, duration, v1_price, v2_price) VALUES (?, ?, ?, ?, ?)',
          [agencyId, p.traffic_type, p.duration, p.v1_price, p.v2_price]
        );
      }
      await conn.commit();
      res.json({ success: true, message: 'Cập nhật bảng giá thành công' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Lỗi cập nhật bảng giá:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
