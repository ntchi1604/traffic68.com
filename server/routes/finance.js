const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

let _web3pay = null;
function getWeb3Pay() {
  if (!_web3pay) {
    try { _web3pay = require('../lib/web3pay'); }
    catch { _web3pay = null; }
  }
  return _web3pay;
}

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const pool = getPool();
  const [wallets] = await pool.execute('SELECT * FROM wallets WHERE user_id = ?', [req.userId]);
  const result = {};
  wallets.forEach((w) => { result[w.type] = { id: w.id, balance: w.balance }; });
  res.json({ wallets: result });
});

router.get('/withdraw-config', async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('withdraw_bank_enabled', 'withdraw_crypto_enabled')");
    const config = {};
    rows.forEach(r => { config[r.setting_key] = r.setting_value; });
    res.json({
      bank_enabled: config.withdraw_bank_enabled !== 'false',
      crypto_enabled: config.withdraw_crypto_enabled !== 'false',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/deposit-config', async (req, res) => {

  try {
    const w3 = getWeb3Pay();
    const config = w3 ? await w3.getDepositSettings() : {};
    let rate = config.web3_vnd_rate ? parseFloat(config.web3_vnd_rate) : null;
    if (!rate) {
      try {
        const conversion = await w3.convertVndToUSDT(1000000);
        rate = conversion.rate;
      } catch { rate = 25500; }
    }
    res.json({
      bank: {
        enabled: config.deposit_bank_enabled === 'true',
        bankName: config.deposit_bank_name || '',
        accountNumber: config.deposit_bank_account || '',
        accountHolder: config.deposit_bank_holder || '',
        branch: config.deposit_bank_branch || '',
      },
      crypto: {
        enabled: config.deposit_crypto_enabled === 'true',
        address: config.deposit_crypto_address || '',
        auto: config.deposit_crypto_auto === 'true',
        minUsdt: parseFloat(config.deposit_crypto_min_usdt) || 1,
      },
      trc20: {
        enabled: config.deposit_trc20_enabled === 'true',
        address: config.deposit_trc20_address || '',
        auto: config.deposit_trc20_auto === 'true',
        minUsdt: parseFloat(config.deposit_crypto_min_usdt) || 1, // reuse same min limit
      },
      rate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deposits', async (req, res) => {
  const pool = getPool();
  const { amount, method } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Số tiền nạp phải lớn hơn 0' });
  }

  // ── Crypto deposit ──
  if (method === 'bep20' || method === 'trc20') {
    try {
      const w3 = getWeb3Pay();
      if (!w3) return res.status(400).json({ error: 'Hệ thống crypto chưa sẵn sàng' });
      const config = await w3.getDepositSettings();

      const isConfigEnabled = method === 'bep20' ? config.deposit_crypto_enabled : config.deposit_trc20_enabled;
      if (isConfigEnabled !== 'true') return res.status(400).json({ error: 'Nạp crypto mạng này đang tắt' });

      const depositAddress = method === 'bep20' ? config.deposit_crypto_address : config.deposit_trc20_address;
      if (!depositAddress) return res.status(400).json({ error: 'Chưa cấu hình ví nhận' });

      const customRate = config.web3_vnd_rate ? parseFloat(config.web3_vnd_rate) : null;
      const conversion = await w3.convertVndToUSDT(Number(amount), customRate);

      const [existingPending] = await pool.execute(
        `SELECT note FROM transactions WHERE type='deposit' AND method=? AND status='pending' AND wallet_type='main'`,
        [method]
      );
      const usedAmounts = new Set();
      existingPending.forEach(r => {
        const m = (r.note || '').match(/Expected:\s*([\d.]+)\s*USDT/);
        if (m) usedAmounts.add(m[1]);
      });

      let usdtAmount;
      let attempts = 0;
      do {
        const uniqueOffset = (Math.floor(Math.random() * 99) + 1) / 100; // 0.01 - 0.99
        usdtAmount = Number((conversion.usdtAmount + uniqueOffset).toFixed(4));
        attempts++;
      } while (usedAmounts.has(String(usdtAmount)) && attempts < 20);

      const minUsdt = parseFloat(config.deposit_crypto_min_usdt) || 1;
      if (usdtAmount < minUsdt) return res.status(400).json({ error: `Tối thiểu ${minUsdt} USDT` });

      const refCode = `${method.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
      const note = `[Crypto Deposit] Expected: ${usdtAmount} USDT | Rate: 1 USDT = ${conversion.rate} VND`;

      await pool.execute(
        `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, 'main', 'deposit', method, amount, 'pending', refCode, note]
      );

      const fmt = new Intl.NumberFormat('vi-VN').format(amount);
      const networkLabel = method === 'bep20' ? 'BEP20' : 'TRC20';
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [req.userId, '💰 Đơn nạp Crypto đang chờ', `Đơn nạp ${fmt} VND (${usdtAmount} USDT) qua mạng ${networkLabel} đang chờ xác nhận. Gửi đúng số USDT đến ví nhận.`, 'info', 'buyer']
      );

      return res.status(201).json({
        message: `Đơn nạp crypto đã tạo (${networkLabel}) — vui lòng chuyển USDT`,
        refCode,
        usdtAmount,
        depositAddress: depositAddress,
        rate: conversion.rate,
        status: 'pending',
        auto: (method === 'bep20' ? config.deposit_crypto_auto : config.deposit_trc20_auto) === 'true',
        network: networkLabel,
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Bank / other methods ──
  const validMethods = ['bank_transfer', 'credit_card', 'momo', 'zalopay'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ' });
  }

  const prefix = method === 'credit_card' ? 'TCB' : method === 'bank_transfer' ? 'VCB' : method.toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  const refCode = `${prefix}-${date}-${seq}`;

  await pool.execute(
    `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, 'main', 'deposit', method, amount, 'pending', refCode]
  );

  const fmt = new Intl.NumberFormat('vi-VN').format(amount);
  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
    [req.userId, 'Đơn nạp tiền đang chờ duyệt', `Đơn nạp ${fmt} VND (Mã: ${refCode}) đang chờ admin xác minh.`, 'info', 'buyer']
  );

  res.status(201).json({ message: 'Đơn nạp tiền đã gửi, đang chờ admin xác minh', refCode, status: 'pending' });
});

// ── Summary endpoint ──
router.get('/summary', async (req, res) => {
  const pool = getPool();
  try {
    // Tổng nạp: deposit vào ví main, đã hoàn tất
    const [[depositRow]] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE user_id = ? AND wallet_type = 'main' AND type = 'deposit' AND status = 'completed'`,
      [req.userId]
    );
    // Hoa hồng: tất cả giao dịch trong ví commission đã hoàn tất
    const [[commissionRow]] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE user_id = ? AND wallet_type = 'commission' AND status = 'completed'`,
      [req.userId]
    );
    // Chi campaign: deduct từ ví main, type=campaign
    const [[campaignRow]] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE user_id = ? AND wallet_type = 'main' AND type = 'campaign' AND status = 'completed'`,
      [req.userId]
    );
    // Rút tiền: từ ví earning, đã hoàn tất
    const [[withdrawRow]] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE user_id = ? AND wallet_type = 'earning' AND type = 'withdraw' AND status = 'completed'`,
      [req.userId]
    );

    res.json({
      deposit: Number(depositRow.total),
      commission: Number(commissionRow.total),
      campaign: Number(campaignRow.total),
      withdraw: Number(withdrawRow.total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', async (req, res) => {
  const pool = getPool();
  const { type, period, scope, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);


  const walletType = scope === 'worker' ? 'earning' : 'main';

  let countSql = `SELECT COUNT(*) as c FROM transactions WHERE user_id = ? AND wallet_type = ?`;
  let sql = `SELECT * FROM transactions WHERE user_id = ? AND wallet_type = ?`;
  const params = [req.userId, walletType];

  if (type && type !== 'all') {
    if (type === 'commission') {

      countSql = `SELECT COUNT(*) as c FROM transactions WHERE user_id = ? AND wallet_type = 'commission'`;
      sql = `SELECT * FROM transactions WHERE user_id = ? AND wallet_type = 'commission'`;
      params.length = 0;
      params.push(req.userId);
    } else {
      countSql += ' AND type = ?';
      sql += ' AND type = ?';
      params.push(type);
    }
  }

  if (period && period !== 'all') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 0;
    if (days > 0) {
      countSql += ` AND created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
      sql += ` AND created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
    }
  }

  const [countRows] = await pool.execute(countSql, params);
  const total = countRows[0].c;

  sql += ` ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`;
  const [transactions] = await pool.execute(sql, params);


  if (scope === 'worker' && transactions.length > 0) {
    const taskMap = {};
    transactions.forEach(t => {
      const match = (t.note || '').match(/#(\d+)\s*$/);
      if (match) taskMap[match[1]] = true;
    });
    const taskIds = Object.keys(taskMap);
    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(',');
      const [tasks] = await pool.execute(
        `SELECT t.id, t.keyword, c.name as campaign_name
         FROM vuot_link_tasks t LEFT JOIN campaigns c ON t.campaign_id = c.id
         WHERE t.id IN (${placeholders})`,
        taskIds
      );
      const taskInfo = {};
      tasks.forEach(tk => { taskInfo[tk.id] = { keyword: tk.keyword, campaign_name: tk.campaign_name }; });
      transactions.forEach(t => {
        const match = (t.note || '').match(/#(\d+)\s*$/);
        if (match && taskInfo[match[1]]) {
          t.keyword = taskInfo[match[1]].keyword;
          t.campaign_name = taskInfo[match[1]].campaign_name;
        }
      });
    }
  }

  res.json({ transactions, total, page: Number(page), limit: Number(limit) });
});

router.post('/transfer', async (req, res) => {
  const pool = getPool();
  const { amount, targetWallet = 'main' } = req.body;
  const num = Number(amount);

  if (!num || num <= 0) return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
  if (!['main', 'earning'].includes(targetWallet)) return res.status(400).json({ error: 'Ví nhận không hợp lệ' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();


    const [wallets] = await conn.execute('SELECT balance FROM wallets WHERE user_id = ? AND type = ? FOR UPDATE', [req.userId, 'commission']);
    if (!wallets[0] || wallets[0].balance < num) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Số dư ví hoa hồng không đủ' });
    }


    await conn.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = ?', [num, req.userId, 'commission']);

    await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?', [num, req.userId, targetWallet]);


    const ts = Date.now();
    const targetName = targetWallet === 'main' ? 'Ví Traffic' : 'Ví Thu Nhập';
    await conn.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, 'commission', 'withdraw', 'transfer', num, 'completed', 'TRF-OUT-' + ts, `Chuyển sang ${targetName}`]
    );
    await conn.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, targetWallet, 'deposit', 'transfer', num, 'completed', 'TRF-IN-' + ts, 'Nhận từ Ví Hoa Hồng']
    );


    const fmtAmount = new Intl.NumberFormat('vi-VN').format(num);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [req.userId, 'Chuyển ví thành công', `Đã chuyển ${fmtAmount} VND từ Ví Hoa Hồng sang ${targetName}.`, 'success', 'all']
    );

    await conn.commit();
    conn.release();
    res.json({ message: `Đã chuyển ${fmtAmount} VND sang ${targetName}` });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ error: 'Lỗi chuyển ví: ' + err.message });
  }
});

router.post('/withdraw', async (req, res) => {
  const pool = getPool();
  const { amount, method, bankName, accountNumber, accountName, cryptoNetwork, cryptoAddress, trafficSource } = req.body;
  const num = Number(amount);

  if (!num || num < 50000) return res.status(400).json({ error: 'Số tiền rút tối thiểu 50.000 đ' });
  if (!['bank', 'crypto'].includes(method)) return res.status(400).json({ error: 'Phương thức không hợp lệ' });
  if (!trafficSource || !trafficSource.trim()) return res.status(400).json({ error: 'Vui lòng nhập nguồn lưu lượng truy cập' });


  try {
    const [settings] = await pool.execute(
      "SELECT setting_value FROM site_settings WHERE setting_key = ?",
      [method === 'bank' ? 'withdraw_bank_enabled' : 'withdraw_crypto_enabled']
    );
    if (settings.length && settings[0].setting_value === 'false') {
      return res.status(400).json({ error: 'Phương thức rút tiền này đã bị tạm khóa' });
    }
  } catch (e) { }

  if (method === 'bank' && (!bankName || !accountNumber || !accountName)) return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin ngân hàng' });
  if (method === 'crypto' && (!cryptoNetwork || !cryptoAddress)) return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin ví crypto' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [wallets] = await conn.execute('SELECT balance FROM wallets WHERE user_id = ? AND type = ? FOR UPDATE', [req.userId, 'earning']);
    const balance = wallets[0] ? Number(wallets[0].balance) : 0;
    if (balance < num) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: `Số dư không đủ (hiện có ${balance.toLocaleString('vi-VN')} đ)` });
    }

    await conn.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND type = ?', [num, req.userId, 'earning']);

    const refCode = `WD-${Date.now()}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
    const note = method === 'bank'
      ? `[Bank] ${bankName} - ${accountNumber} - ${accountName} | Nguồn: ${trafficSource.trim()}`
      : `[Crypto] ${cryptoNetwork} - ${cryptoAddress} | Nguồn: ${trafficSource.trim()}`;

    await conn.execute(
      `INSERT INTO transactions (user_id, wallet_type, type, method, amount, status, ref_code, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, 'earning', 'withdraw', method, num, 'pending', refCode, note]
    );

    const fmtAmount = new Intl.NumberFormat('vi-VN').format(num);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [req.userId, 'Yêu cầu rút tiền', `Yêu cầu rút ${fmtAmount} đ (${refCode}) đang chờ xử lý.`, 'info', 'worker']
    );

    await conn.commit();
    conn.release();
    res.json({ message: `Yêu cầu rút ${fmtAmount} đ đã gửi`, refCode });
  } catch (err) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: 'Lỗi: ' + err.message });
  }
});

router.get('/withdrawals', async (req, res) => {
  try {
    const pool = getPool();
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [countR] = await pool.execute(
      `SELECT COUNT(*) as c FROM transactions WHERE user_id = ? AND type = 'withdraw' AND wallet_type = 'earning'`,
      [req.userId]
    );
    const [rows] = await pool.execute(
      `SELECT * FROM transactions WHERE user_id = ? AND type = 'withdraw' AND wallet_type = 'earning'
       ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
      [req.userId]
    );
    res.json({ withdrawals: rows, total: countR[0].c, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/web3-payment/:txId', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM web3_payments WHERE transaction_id = ? AND user_id = ?`,
      [req.params.txId, req.userId]
    );
    if (!rows[0]) return res.json({ payment: null });
    res.json({ payment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
