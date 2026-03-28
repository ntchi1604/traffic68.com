const fs = require('fs');
let c = fs.readFileSync('server/routes/campaigns.js', 'utf8');

const target1 = `  let sql = 'SELECT * FROM campaigns WHERE user_id = ?';
  const params = [req.userId];`;

const replacement1 = `  const tz = 'Asia/Ho_Chi_Minh';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const dYes = new Date(); dYes.setDate(dYes.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(dYes);

  let sql = \`SELECT c.*,
    COALESCE((SELECT clicks FROM traffic_logs tl WHERE tl.campaign_id = c.id AND tl.date = ?), 0) as views_today,
    COALESCE((SELECT clicks FROM traffic_logs tl WHERE tl.campaign_id = c.id AND tl.date = ?), 0) as views_yesterday
    FROM campaigns c WHERE c.user_id = ?\`;
  const params = [today, yesterday, req.userId];`;

c = c.replace(target1, replacement1);
c = c.replace(/sql \+= ' AND status = \?';/, "sql += ' AND c.status = ?';");
c = c.replace(/sql \+= ' AND \(name LIKE \? OR url LIKE \?\)';/, "sql += ' AND (c.name LIKE ? OR c.url LIKE ?)';");
c = c.replace(/sql \+= ' ORDER BY created_at DESC';/, "sql += ' ORDER BY c.created_at DESC';");

fs.writeFileSync('server/routes/campaigns.js', c);
console.log('Update done');
