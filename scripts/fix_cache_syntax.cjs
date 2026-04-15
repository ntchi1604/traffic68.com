const fs = require('fs');
const file = 'server/routes/vuotlink.js';
let c = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Fix broken invalidation block
const badBlock = `  // Invalidate cache sau khi task completed\n  try {\n    const workerIdToInvalidate = task.worker_id || (task.worker_link_id ? paidWorkerId : null);\n    if (workerIdToInvalidate) {\n      cache.invalidate(worker:balance:+workerIdToInvalidate);\n      cache.invalidatePrefix(worker:stats:+workerIdToInvalidate);\n      cache.invalidatePrefix(worker:earnings:+workerIdToInvalidate+:);\n    }\n    if (campaign && campaign.user_id) cache.invalidate(\\reports:overview:+campaign.user_id);\n    cache.invalidatePrefix('admin:overview:');\n  } catch (e) {}`;

const goodBlock = `  // Invalidate cache sau khi task completed\n  try {\n    const workerIdToInvalidate = task.worker_id || (task.worker_link_id ? paidWorkerId : null);\n    if (workerIdToInvalidate) {\n      cache.invalidate('worker:balance:' + workerIdToInvalidate);\n      cache.invalidatePrefix('worker:stats:' + workerIdToInvalidate);\n      cache.invalidatePrefix('worker:earnings:' + workerIdToInvalidate + ':');\n    }\n    if (campaign && campaign.user_id) cache.invalidate('reports:overview:' + campaign.user_id);\n    cache.invalidatePrefix('admin:overview:');\n  } catch (e) {}`;

// 2. Restore missing logReason + logSecurityEvent (removed by bad edit)
const missingLog = `        specificReasons.push(label);\n          }\n        });\n      }\n    }`;
const restoredLog = `        specificReasons.push(label);\n          }\n        });\n      }\n\n      const logReason = specificReasons.length > 0\n        ? specificReasons[0] + (specificReasons.length > 1 ? ' (+' + (specificReasons.length - 1) + ' ly do)' : '')\n        : 'Phat hien Bot';\n\n      logSecurityEvent(logReason, task.ip_address, task.user_agent, task.visitor_id, {\n        taskId: task.id,\n        source: 'vuotlink',\n        campaignId: task.campaign_id,\n        targetUrl: task.target_url || null,\n        workerLinkId: task.worker_link_id || null,\n        gatewaySlug: gatewaySlug,\n        timeOnSite,\n        earning,\n        ipCountry,\n        detectionLog: secDetail.detectionLog || [],\n        reasons: specificReasons,\n        deviceScore: secDetail.deviceScore ?? null,\n        deviceType: secDetail.deviceType || null,\n        automationFlags: secDetail.detail && secDetail.detail.automation || null,\n        canvasHash: secDetail.canvasHash || null,\n        audioHash: secDetail.audioHash || null,\n        creepSummary: secDetail.creepSummary || null,\n      });\n    }`;

let changed = c;

if (c.includes(badBlock)) {
  changed = changed.replace(badBlock, goodBlock);
  console.log('✅ Fixed invalidation block');
} else {
  console.log('⚠️  badBlock not found, trying partial match...');
  const idx = c.indexOf('cache.invalidate(worker:balance:');
  if (idx > -1) console.log('Found at index', idx, ':', JSON.stringify(c.substring(idx, idx+60)));
}

if (c.includes(missingLog)) {
  changed = changed.replace(missingLog, restoredLog);
  console.log('✅ Restored logSecurityEvent');
} else {
  console.log('⚠️  missingLog pattern not found - may already be OK');
}

fs.writeFileSync(file, changed.replace(/\n/g, '\r\n'), 'utf8');
console.log('Done.');
