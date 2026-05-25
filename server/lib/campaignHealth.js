/**
 * campaignHealth.js
 * Kiểm tra định kỳ toàn bộ campaigns đang chạy:
 *   1. 301 redirect đổi domain -> pause
 *
 * Được gọi từ server/index.js mỗi 30 phút.
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getPool } = require('../db');

// Kiểm tra 301 redirect đổi domain
function checkRedirect(urlStr) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.request(
        {
          method: 'HEAD',
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000,
        },
        (res) => {
          if ([301, 302, 308].includes(res.statusCode) && res.headers.location) {
            try {
              const loc = new URL(res.headers.location, urlStr);
              const origHost = parsed.hostname.replace(/^www\./, '');
              const newHost = loc.hostname.replace(/^www\./, '');
              if (origHost !== newHost) {
                return resolve({ changed: true, newDomain: loc.hostname });
              }
            } catch (_) {}
          }
          resolve(null);
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    } catch (_) {
      resolve(null);
    }
  });
}

async function runCampaignHealthCheck() {
  const pool = getPool();
  console.log('[CampaignHealth] Starting scheduled check...');

  try {
    try {
      await pool.execute('ALTER TABLE campaigns ADD COLUMN pause_reason VARCHAR(255) DEFAULT NULL');
    } catch (_) {}

    const [campaigns] = await pool.execute(
      "SELECT c.id, c.user_id, c.name, c.url FROM campaigns c WHERE c.status = 'running' AND c.url IS NOT NULL AND c.url != ''"
    );

    if (campaigns.length === 0) {
      console.log('[CampaignHealth] No running campaigns to check.');
      return;
    }

    console.log(`[CampaignHealth] Checking ${campaigns.length} running campaigns...`);

    let paused301 = 0;
    let okCount = 0;
    let skipCount = 0;

    for (const camp of campaigns) {
      try {
        const redirectResult = await checkRedirect(camp.url);
        if (redirectResult && redirectResult.changed) {
          const reason = `Đổi domain -> ${redirectResult.newDomain}`;
          await pool.execute(
            "UPDATE campaigns SET status = 'paused', pause_reason = ? WHERE id = ? AND status = 'running'",
            [reason, camp.id]
          );
          await pool.execute(
            'INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)',
            [
              camp.user_id,
              'Chiến dịch tạm dừng tự động',
              `Chiến dịch \"${camp.name}\" đã bị tạm dừng do website đích đổi domain sang ${redirectResult.newDomain}.`,
              'warning',
              'buyer',
            ]
          );
          console.log(`[CampaignHealth] Paused #${camp.id} \"${camp.name}\": 301 -> ${redirectResult.newDomain}`);
          paused301++;
          continue;
        }

        okCount++;
      } catch (e) {
        console.error(`[CampaignHealth] Error checking camp #${camp.id}:`, e.message);
        skipCount++;
      }
    }

    console.log(`[CampaignHealth] Done. ok=${okCount} paused301=${paused301} skip=${skipCount}`);
  } catch (e) {
    console.error('[CampaignHealth] Fatal error:', e.message);
  }
}

module.exports = { runCampaignHealthCheck };
