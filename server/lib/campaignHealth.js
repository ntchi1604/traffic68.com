/**
 * campaignHealth.js
 * Kiểm tra định kỳ toàn bộ campaigns đang chạy:
 *   1. 301 redirect đổi domain → pause
 *   2. Chưa gắn script widget → pause
 *
 * Được gọi từ server/index.js mỗi 30 phút.
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getPool } = require('../db');

// ── Cache embed check: campId → { ts } — tránh fetch liên tục ──
const _embedCache = new Map();
const EMBED_TTL = 30 * 60 * 1000; // 30 phút

// ── Kiểm tra 301 redirect đổi domain ────────────────────────────────────────
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
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    } catch (_) { resolve(null); }
  });
}

// ── Kiểm tra trang có gắn script widget không ───────────────────────────────
function checkEmbedScript(urlStr, tokens) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      let body = '';
      let settled = false;

      const req = mod.request(
        {
          method: 'GET',
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
          timeout: 12000,
        },
        (res) => {
          const ct = (res.headers['content-type'] || '').toLowerCase();
          if (res.statusCode !== 200 || !ct.includes('html')) {
            res.resume();
            return resolve('skip'); // CF / 403 / non-HTML → không làm gì
          }

          let received = 0;
          res.on('data', (chunk) => {
            if (settled) return;
            body += chunk.toString('utf8', 0, Math.min(chunk.length, 200000 - received));
            received += chunk.length;
            if (received >= 200000) {
              settled = true;
              req.destroy();
              resolve(_hasToken(body, tokens));
            }
          });
          res.on('end', () => {
            if (!settled) { settled = true; resolve(_hasToken(body, tokens)); }
          });
        }
      );
      req.on('error', () => { if (!settled) { settled = true; resolve('skip'); } });
      req.on('timeout', () => { if (!settled) { settled = true; req.destroy(); resolve('skip'); } });
      req.end();
    } catch (_) { resolve('skip'); }
  });
}

function _hasToken(html, tokens) {
  for (const tok of tokens) {
    if (html.includes(tok)) return 'ok';
  }
  if (html.includes('api_seo_traffic68') || html.includes('traffic68.com')) return 'ok';
  return 'not_found';
}

// ── Main job ─────────────────────────────────────────────────────────────────
async function runCampaignHealthCheck() {
  const pool = getPool();
  console.log('[CampaignHealth] Starting scheduled check...');

  try {
    // Đảm bảo cột pause_reason tồn tại
    try { await pool.execute(`ALTER TABLE campaigns ADD COLUMN pause_reason VARCHAR(255) DEFAULT NULL`); } catch (_) {}

    // Lấy tất cả campaigns đang running
    const [campaigns] = await pool.execute(
      `SELECT c.id, c.user_id, c.name, c.url FROM campaigns c WHERE c.status = 'running' AND c.url IS NOT NULL AND c.url != ''`
    );

    if (campaigns.length === 0) {
      console.log('[CampaignHealth] No running campaigns to check.');
      return;
    }

    console.log(`[CampaignHealth] Checking ${campaigns.length} running campaigns...`);

    // Lấy widget tokens theo batch
    const userIds = [...new Set(campaigns.map(c => c.user_id))];
    let userTokenMap = {};
    if (userIds.length > 0) {
      try {
        const ph = userIds.map(() => '?').join(',');
        const [wRows] = await pool.execute(
          `SELECT user_id, token FROM widgets WHERE user_id IN (${ph}) AND is_active = 1`,
          userIds
        );
        wRows.forEach(r => {
          if (!userTokenMap[r.user_id]) userTokenMap[r.user_id] = [];
          userTokenMap[r.user_id].push(r.token);
        });
        console.log(`[CampaignHealth] Widget tokens: ${wRows.length} tokens for ${userIds.length} users`);
      } catch (e) { console.error('[CampaignHealth] Widget query error:', e.message); }
    }

    // Xử lý tuần tự (không parallel) để tránh quá tải network
    let paused301 = 0, pausedEmbed = 0, okCount = 0, skipCount = 0;

    for (const camp of campaigns) {
      try {
        // 1️⃣ Kiểm tra 301 redirect
        const redirectResult = await checkRedirect(camp.url);
        if (redirectResult && redirectResult.changed) {
          const reason = `Đổi domain → ${redirectResult.newDomain}`;
          await pool.execute(
            `UPDATE campaigns SET status = 'paused', pause_reason = ? WHERE id = ? AND status = 'running'`,
            [reason, camp.id]
          );
          await pool.execute(
            `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
            [camp.user_id, 'Chiến dịch tạm dừng tự động',
              `Chiến dịch "${camp.name}" đã bị tạm dừng do website đích đổi domain sang ${redirectResult.newDomain}.`,
              'warning', 'buyer']
          );
          console.log(`[CampaignHealth] Paused #${camp.id} "${camp.name}": 301 → ${redirectResult.newDomain}`);
          paused301++;
          continue;
        }

        // 2️⃣ Kiểm tra embed script
        const tokens = userTokenMap[camp.user_id] || [];
        if (tokens.length === 0) {
          // User chưa tạo widget nào → pause
          await pool.execute(
            `UPDATE campaigns SET status = 'paused', pause_reason = 'Chưa tạo widget' WHERE id = ? AND status = 'running'`,
            [camp.id]
          );
          await pool.execute(
            `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
            [camp.user_id, 'Chiến dịch tạm dừng tự động',
              `Chiến dịch "${camp.name}" đã bị tạm dừng vì tài khoản chưa tạo widget. Vui lòng tạo widget và gắn script rồi bật lại.`,
              'warning', 'buyer']
          );
          console.log(`[CampaignHealth] #${camp.id} "${camp.name}": PAUSED (no widget created for user ${camp.user_id})`);
          pausedEmbed++;
          continue;
        }

        // Dùng cache để tránh fetch quá nhiều
        const now = Date.now();
        const cached = _embedCache.get(camp.id);
        if (cached && (now - cached.ts) < EMBED_TTL) {
          console.log(`[CampaignHealth] #${camp.id} "${camp.name}": SKIP (cache hit, checked recently)`);
          okCount++; continue;
        }

        console.log(`[CampaignHealth] #${camp.id} "${camp.name}": fetching ${camp.url} (tokens: ${tokens.join(', ')})`);
        const embedResult = await checkEmbedScript(camp.url, tokens);
        _embedCache.set(camp.id, { ts: now });
        console.log(`[CampaignHealth] #${camp.id} embed result: ${embedResult}`);

        if (embedResult === 'not_found') {
          await pool.execute(
            `UPDATE campaigns SET status = 'paused', pause_reason = 'Chưa gắn script widget' WHERE id = ? AND status = 'running'`,
            [camp.id]
          );
          await pool.execute(
            `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
            [camp.user_id, 'Chiến dịch tạm dừng tự động',
              `Chiến dịch "${camp.name}" đã bị tạm dừng vì không tìm thấy script widget trên trang ${camp.url}. Vui lòng gắn script rồi bật lại.`,
              'warning', 'buyer']
          );
          console.log(`[CampaignHealth] Paused #${camp.id} "${camp.name}": embed not found`);
          pausedEmbed++;
        } else if (embedResult === 'ok') {
          okCount++;
        } else {
          skipCount++; // 'skip' = CF/403/timeout
        }
      } catch (e) {
        console.error(`[CampaignHealth] Error checking camp #${camp.id}:`, e.message);
        skipCount++;
      }
    }

    console.log(`[CampaignHealth] Done. ok=${okCount} paused301=${paused301} pausedEmbed=${pausedEmbed} skip=${skipCount}`);
  } catch (e) {
    console.error('[CampaignHealth] Fatal error:', e.message);
  }
}

module.exports = { runCampaignHealthCheck };
