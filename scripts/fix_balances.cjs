require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
process.env.DB_HOST = '127.0.0.1';
const { initDb, getPool } = require('../server/db');

(async () => {
  await initDb();
  const pool = getPool();
  try {
    const [wallets] = await pool.execute("SELECT user_id, balance FROM wallets WHERE type = 'earning'");
    let discrepencies = 0;

    for (const w of wallets) {
      const [ins] = await pool.execute(`
        SELECT COALESCE(SUM(amount), 0) as total IN_AMOUNT
        FROM transactions 
        WHERE user_id = ? AND wallet_type = 'earning' 
          AND type IN ('earning', 'deposit', 'bonus') 
          AND status = 'completed'`, [w.user_id]);

      const [outs] = await pool.execute(`
        SELECT COALESCE(SUM(amount), 0) as total OUT_AMOUNT
        FROM transactions 
        WHERE user_id = ? AND wallet_type = 'earning' 
          AND type IN ('withdraw') 
          AND status IN ('completed', 'pending')`, [w.user_id]);

      const expected = Number(ins[0].IN_AMOUNT) - Number(outs[0].OUT_AMOUNT);
      const current = Number(w.balance);

      if (expected !== current) {
        discrepencies++;
        console.log(`User ${w.user_id}: System = ${current}, Expected = ${expected} (DIFF = ${current - expected})`);
        await pool.execute("UPDATE wallets SET balance = ? WHERE user_id = ? AND type = 'earning'", [expected, w.user_id]);
      }
    }
    console.log(`\nHoàn tất. Đã sửa ${discrepencies} ví bị lỗi.`);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
})();
