require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixDb() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'traffic68',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const [cols] = await pool.query(`SHOW COLUMNS FROM agencies`);
    const existing = cols.map(c => c.Field);
    const toAdd = [];
    
    if(!existing.includes('bank_name')) toAdd.push('bank_name VARCHAR(100) DEFAULT NULL');
    if(!existing.includes('bank_account_name')) toAdd.push('bank_account_name VARCHAR(255) DEFAULT NULL');
    if(!existing.includes('bank_account_number')) toAdd.push('bank_account_number VARCHAR(100) DEFAULT NULL');
    if(!existing.includes('contact_email')) toAdd.push('contact_email VARCHAR(255) DEFAULT NULL');
    if(!existing.includes('contact_phone')) toAdd.push('contact_phone VARCHAR(50) DEFAULT NULL');
    
    if(toAdd.length > 0) {
      const alterQuery = `ALTER TABLE agencies ${toAdd.map(c => 'ADD COLUMN ' + c).join(', ')}`;
      console.log('Thực thi lệnh SQL:', alterQuery);
      await pool.query(alterQuery);
      console.log('✅ Thêm các trường dữ liệu bị thiếu thành công!');
    } else {
      console.log('✅ Các trường dữ liệu đã đầy đủ. Không cần cập nhật.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  }
}

fixDb();
