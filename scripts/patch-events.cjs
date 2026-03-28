const fs = require('fs');
const path = require('path');
const f = path.join(process.cwd(), 'server/routes/admin.js');
let c = fs.readFileSync(f, 'utf8');

const startMarker = "router.get('/security/user/:uid/events'";
const idx = c.indexOf(startMarker);
if (idx === -1) { console.error('NOT FOUND'); process.exit(1); }

// Find the closing }); after this route
let braceDepth = 0;
let i = idx;
let routeEnd = -1;
while (i < c.length) {
  if (c[i] === '{') braceDepth++;
  else if (c[i] === '}') {
    braceDepth--;
    if (braceDepth === 0) {
      // skip to end of });
      i++;
      while (i < c.length && (c[i] === ')' || c[i] === ';' || c[i] === '\r' || c[i] === '\n')) i++;
      routeEnd = i;
      break;
    }
  }
  i++;
}
if (routeEnd === -1) { console.error('END NOT FOUND'); process.exit(1); }

const NEW = `router.get('/security/user/:uid/events', async (req, res) => {
  try {
    const pool = getPool();
    const uid = req.params.uid;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [ipRows] = await pool.execute(
      \`SELECT DISTINCT ip_address FROM vuot_link_tasks
       WHERE worker_id = ? OR worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?)\`,
      [uid, uid]
    );
    const ips = ipRows.map(r => r.ip_address).filter(Boolean);

    let allEvents = [];

    if (ips.length) {
      const ph = ips.map(() => '?').join(',');
      const [logRows] = await pool.execute(
        \`SELECT id, source, reason, ip_address, user_agent, visitor_id, details, created_at
         FROM security_logs
         WHERE ip_address IN (\${ph}) AND reason != 'completed'
         ORDER BY created_at DESC LIMIT 500\`, ips
      );
      allEvents.push(...logRows);
    }

    const [botTaskRows] = await pool.execute(
      \`SELECT vt.id, 'vuotlink' as source,
              vt.ip_address, vt.user_agent, vt.visitor_id,
              vt.security_detail as details,
              vt.created_at
       FROM vuot_link_tasks vt
       WHERE (vt.worker_id = ? OR vt.worker_link_id IN (SELECT id FROM worker_links WHERE worker_id = ?))
         AND vt.bot_detected = 1
         AND NOT EXISTS (
           SELECT 1 FROM security_logs sl
           WHERE sl.ip_address = vt.ip_address
             AND sl.reason LIKE '%Bot%'
             AND ABS(TIMESTAMPDIFF(SECOND, sl.created_at, vt.created_at)) < 300
         )
       ORDER BY vt.created_at DESC LIMIT 200\`,
      [uid, uid]
    );

    botTaskRows.forEach(r => {
      allEvents.push({ ...r, reason: 'Ph\u00e1t hi\u1ec7n Bot (task)' });
    });

    allEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = allEvents.length;
    const events = allEvents.slice(offset, offset + Number(limit));

    res.json({ events, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('[AntiCheat] user events error:', err);
    res.status(500).json({ error: err.message });
  }
});
`;

c = c.slice(0, idx) + NEW + c.slice(routeEnd);
fs.writeFileSync(f, c, 'utf8');
console.log('OK - patched events endpoint at offset', idx);
