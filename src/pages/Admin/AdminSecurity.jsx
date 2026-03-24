import React, { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Search, RefreshCw, X, Eye, Copy, Check,
  ChevronLeft, ChevronRight, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import api from '../../lib/api';

/* ─── Helpers ─── */
const fmt = d => d ? new Date(d).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const ago = d => {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'vừa xong'; if (m < 60) return `${m}p trước`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)}d trước`;
};
const money = v => Number(v || 0).toLocaleString('vi-VN') + 'đ';
const isMobileUA = ua => /Mobi|Android|iPhone|iPad|iPod/i.test(ua || '');

const REASON_VI = {
  creep_detected: 'Fingerprint giả', automation_probes: 'Automation',
  mouse_bot: 'Hành vi bot', bot_ua: 'UA bot', bot_behavior: 'Hành vi',
  suspicious: 'Nghi ngờ', probe_warning: 'Browser probe', ip_rate_limit: 'Rate limit',
  device_fake: 'Thiết bị giả lập',
};

const ST = {
  completed: { l: 'Hoàn thành', c: 'bg-emerald-100 text-emerald-700' },
  expired:   { l: 'Hết hạn',    c: 'bg-slate-100 text-slate-500' },
  pending:   { l: 'Đang chờ',   c: 'bg-amber-100 text-amber-700' },
  step1:     { l: 'Bước 1',     c: 'bg-blue-100 text-blue-700' },
  step2:     { l: 'Bước 2',     c: 'bg-blue-100 text-blue-700' },
  step3:     { l: 'Bước 3',     c: 'bg-violet-100 text-violet-700' },
};

/* ─── Task Detail Modal ─── */
function TaskModal({ task: t, onClose }) {
  if (!t) return null;
  let sd = {};
  try { sd = typeof t.security_detail === 'string' ? JSON.parse(t.security_detail || '{}') : (t.security_detail || {}); } catch {}
  const bd = sd.botDetection || {};
  const pr = sd.probes || {};
  const dl = sd.detectionLog || [];
  const mobile = isMobileUA(t.user_agent);
  const st = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600' };

  // Device analysis (new format)
  const devScore = sd.deviceScore || 0;
  const devType = sd.deviceType || (mobile ? 'mobile' : 'desktop');
  const devReasons = sd.reasons || [];
  const devDetail = sd.detail || {};

  // Build info cards
  const checks = [];
  // New device checks
  if (devScore > 0) checks.push({ k: 'Device Score', v: `${devScore}/100`, bad: devScore >= 50 });
  if (devDetail.headless) checks.push({ k: 'Headless', v: 'Phát hiện', bad: true });
  if (devDetail.webdriver) checks.push({ k: 'Webdriver', v: 'Phát hiện', bad: true });
  if (devDetail.selenium) checks.push({ k: 'Selenium', v: 'Phát hiện', bad: true });
  if (devDetail.cdc) checks.push({ k: 'CDP', v: 'Phát hiện', bad: true });
  // GPU
  if (devDetail.gpu) {
    const gpuV = devDetail.gpu.verdict;
    checks.push({ k: 'GPU', v: devDetail.gpu.renderer || gpuV, bad: gpuV === 'virtual' || gpuV === 'missing' });
  }
  if (devDetail.gpuFloat) {
    checks.push({ k: 'GPU Float', v: devDetail.gpuFloat.verdict, bad: devDetail.gpuFloat.verdict === 'software_renderer' });
  }
  // Battery
  if (devDetail.battery) {
    const bv = devDetail.battery.verdict;
    checks.push({ k: 'Pin', v: bv === 'emulator_pattern' ? `100% + sạc (giả lập)` : bv === 'suspicious' ? '100% + sạc' : `${Math.round((devDetail.battery.level || 0) * 100)}%`, bad: bv !== 'ok' });
  }
  // Audio
  if (devDetail.audio) {
    checks.push({ k: 'Audio', v: devDetail.audio.verdict === 'anti_detect' ? 'Tĩnh / Lỗi' : 'OK', bad: devDetail.audio.verdict === 'anti_detect' });
  }
  // Sensor (mobile)
  if (devDetail.sensor && typeof devDetail.sensor === 'object' && devDetail.sensor.verdict) {
    checks.push({ k: 'Cảm biến', v: devDetail.sensor.verdict === 'static_5s' ? 'Đứng yên (giả lập)' : devDetail.sensor.verdict, bad: devDetail.sensor.verdict !== 'ok' });
  } else if (devDetail.sensor === 'null_or_empty') {
    checks.push({ k: 'Cảm biến', v: 'Không có', bad: true });
  }
  // Touch
  if (devDetail.touchRadius) {
    const tr = typeof devDetail.touchRadius === 'string' ? devDetail.touchRadius : devDetail.touchRadius.verdict;
    checks.push({ k: 'Touch Radius', v: tr === 'all_zero' ? '0 (giả lập)' : tr === 'fixed' ? 'Cố định' : 'OK', bad: tr !== 'ok' });
  }
  // Mouse
  if (devDetail.mouse) {
    checks.push({ k: 'Chuột', v: devDetail.mouse.verdict === 'bot_linear' ? 'Tốc độ đều (bot)' : `CV=${devDetail.mouse.speedCV}`, bad: devDetail.mouse.verdict === 'bot_linear' });
  }
  // Scroll
  if (devDetail.scroll) {
    checks.push({ k: 'Cuộn trang', v: devDetail.scroll.verdict === 'scrollTo_bot' ? 'Nhảy cóc (bot)' : 'OK', bad: devDetail.scroll.verdict === 'scrollTo_bot' });
  }
  // Legacy CreepJS checks
  if (bd.bot !== undefined)       checks.push({ k: 'CreepJS Bot', v: bd.bot ? 'Có' : 'Không', bad: !!bd.bot });
  const _safeLied = ['clientRects', 'maths', 'css', 'domRect'];
  const _filterLied = (arr) => (arr || []).filter(s => !_safeLied.some(safe => s === safe || s.startsWith(safe + ':')));
  const bdRealLies = _filterLied(bd.liedSections);
  const bdHasNavLie = (bd.liedSections || []).some(s => s === 'navigator' || s.startsWith('navigator:'));
  if (bdHasNavLie) checks.push({ k: 'Fake Device', v: '100% (navigator lied)', bad: true });
  if (bd.totalLied !== undefined) checks.push({ k: 'Tổng giả mạo', v: bdRealLies.length, bad: bdRealLies.length > 0 });
  if (bdRealLies.length > 0)      checks.push({ k: 'Mục giả mạo', v: bdRealLies.join(', '), bad: true });
  // Legacy probes
  if (pr.webdriver)    checks.push({ k: 'Webdriver (legacy)', v: 'Phát hiện', bad: true });
  if (pr.selenium)     checks.push({ k: 'Selenium (legacy)', v: 'Phát hiện', bad: true });
  if (pr.cdc)          checks.push({ k: 'CDP (legacy)', v: 'Phát hiện', bad: true });
  if (pr.pluginCount !== undefined) checks.push({ k: 'Plugins', v: pr.pluginCount, bad: pr.pluginCount === 0 && !mobile });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 rounded-t-2xl flex items-center justify-between ${t.bot_detected ? 'bg-red-50' : t.status === 'completed' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-800">Task #{t.id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.c}`}>{st.l}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mobile ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                {mobile ? 'Mobile' : 'Desktop'}
              </span>
              {t.bot_detected ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">BOT</span> : null}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{fmt(t.created_at)} · {t.ip_address}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60"><X size={16} className="text-slate-500" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 text-xs">
          {/* Task info */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            {[
              ['Nguồn', t.worker_link_id ? `Gateway /${t.gateway_slug || ''}` : 'Vượt link'],
              ['Visitor ID', t.visitor_id || '—', true],
              ['IP', t.ip_address || '—', true],
              ['Keyword', t.keyword],
              ['URL đích', t.target_url, true],
              ['Chiến dịch', t.campaign_name || `#${t.campaign_id}`],
              ['Thu nhập', money(t.earning)],
              ['Thời gian trang', t.time_on_site ? `${t.time_on_site}s` : '—'],
            ].map(([k, v, copyable]) => (
              <div key={k} className="flex justify-between gap-2 items-center">
                <span className="text-slate-400 shrink-0">{k}</span>
                <div className="flex items-center gap-1 min-w-0 max-w-[65%]">
                  <span className="font-semibold text-slate-700 text-right truncate">{v || '—'}</span>
                  {copyable && v && v !== '—' && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(v); }}
                      className="p-0.5 rounded hover:bg-slate-200 transition shrink-0"
                      title="Sao chép"
                    >
                      <Copy size={11} className="text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Detection log */}
          {dl.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Detection Log</p>
              <div className="flex flex-wrap gap-1">
                {dl.map((d, i) => <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">{d}</span>)}
              </div>
            </div>
          )}

          {/* Browser checks */}
          {checks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Kiểm tra trình duyệt</p>
              <div className="space-y-1">
                {checks.map((c, i) => (
                  <div key={i} className={`flex justify-between px-3 py-1.5 rounded-lg ${c.bad ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <span className={c.bad ? 'text-red-700 font-medium' : 'text-slate-600'}>{c.k}</span>
                    <span className={`font-bold ${c.bad ? 'text-red-800' : 'text-slate-800'}`}>{String(c.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavior / Device reasons */}
          {devReasons.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Phân tích thiết bị ({devType})</p>
              <div className="flex flex-wrap gap-1">
                {devReasons.map((r, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700">{r}</span>
                ))}
              </div>
            </div>
          )}

          {!checks.length && !devReasons.length && !dl.length && (
            <p className="text-center text-slate-400 py-6">Chưa có dữ liệu đánh giá bảo mật</p>
          )}
        </div>

        <div className="px-5 py-3 border-t">
          <button onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Đóng</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Event Detail Modal ─── */
function EventModal({ event: ev, onClose }) {
  if (!ev) return null;
  let det = {};
  try { det = typeof ev.details === 'string' ? JSON.parse(ev.details || '{}') : (ev.details || {}); } catch {}
  const blocked = ['creep_detected','automation_probes','mouse_bot','bot_ua','bot_behavior','ip_rate_limit','device_fake'].includes(ev.reason);
  const mobile = isMobileUA(ev.user_agent);

  // Build check cards from details
  const checks = [];
  if (det.bot !== undefined) checks.push({ k: 'CreepJS Bot', v: det.bot ? 'Có' : 'Không', bad: !!det.bot });
  const _safe2 = ['clientRects', 'maths', 'css', 'domRect'];
  const _filter2 = (arr) => (arr || []).filter(s => !_safe2.some(safe => s === safe || s.startsWith(safe + ':')));
  const detRealLies = _filter2(det.liedSections);
  const detHasNavLie = (det.liedSections || []).some(s => s === 'navigator' || s.startsWith('navigator:'));
  if (detHasNavLie) checks.push({ k: 'Fake Device', v: '100% (navigator lied)', bad: true });
  if (det.totalLied !== undefined) checks.push({ k: 'Tổng giả mạo', v: detRealLies.length, bad: detRealLies.length > 0 });
  if (detRealLies.length > 0) checks.push({ k: 'Mục giả mạo', v: detRealLies.join(', '), bad: true });
  if (det.webdriver) checks.push({ k: 'Webdriver', v: 'Phát hiện', bad: true });
  if (det.selenium) checks.push({ k: 'Selenium', v: 'Phát hiện', bad: true });
  if (det.cdc) checks.push({ k: 'CDP', v: 'Phát hiện', bad: true });
  if (det.pluginCount !== undefined) checks.push({ k: 'Plugins', v: det.pluginCount, bad: det.pluginCount === 0 && !mobile });
  if (det.count !== undefined) checks.push({ k: 'Request count', v: det.count, bad: det.count > 30 });
  if (det.mobileToleranceApplied) checks.push({ k: 'Mobile tolerance', v: 'Áp dụng', bad: false });

  // Task info if available
  const taskInfo = [];
  if (det.taskId) taskInfo.push(['Task ID', `#${det.taskId}`]);
  if (det.campaignId) taskInfo.push(['Campaign', `#${det.campaignId}`]);
  if (det.workerId) taskInfo.push(['Worker', `#${det.workerId}`]);
  if (det.earning) taskInfo.push(['Earning', money(det.earning)]);
  if (det.timeOnSite) taskInfo.push(['Time on site', `${det.timeOnSite}s`]);
  if (det.ipCountry) taskInfo.push(['Quốc gia', det.ipCountry]);

  // New device analysis format (device_fake events)
  const devDetail = det.detail || {};
  const devReasons = det.reasons || [];
  const devScore = det.score || 0;
  if (devScore > 0) checks.push({ k: 'Device Score', v: `${devScore}/100`, bad: devScore >= 50 });
  if (devDetail.gpu) {
    const gpuV = devDetail.gpu?.verdict;
    checks.push({ k: 'GPU', v: devDetail.gpu?.renderer || gpuV, bad: gpuV === 'virtual' || gpuV === 'missing' });
  }
  if (devDetail.gpuFloat) checks.push({ k: 'GPU Float', v: devDetail.gpuFloat.verdict, bad: devDetail.gpuFloat.verdict === 'software_renderer' });
  if (devDetail.battery) {
    const bv = devDetail.battery?.verdict;
    checks.push({ k: 'Pin', v: bv === 'emulator_pattern' ? '100%+sạc (giả lập)' : bv === 'suspicious' ? '100%+sạc' : 'OK', bad: bv !== 'ok' });
  }
  if (devDetail.audio) checks.push({ k: 'Audio', v: devDetail.audio.verdict === 'anti_detect' ? 'Tĩnh/Lỗi' : 'OK', bad: devDetail.audio.verdict === 'anti_detect' });
  if (devDetail.sensor && typeof devDetail.sensor === 'object' && devDetail.sensor.verdict) {
    checks.push({ k: 'Cảm biến', v: devDetail.sensor.verdict === 'static_5s' ? 'Đứng yên (giả lập)' : devDetail.sensor.verdict, bad: devDetail.sensor.verdict !== 'ok' });
  } else if (devDetail.sensor === 'null_or_empty') {
    checks.push({ k: 'Cảm biến', v: 'Không có', bad: true });
  }
  if (devDetail.touchRadius) {
    const tr = typeof devDetail.touchRadius === 'string' ? devDetail.touchRadius : devDetail.touchRadius.verdict;
    checks.push({ k: 'Touch', v: tr === 'all_zero' ? '0 (giả lập)' : tr, bad: tr !== 'ok' });
  }
  if (devDetail.mouse) checks.push({ k: 'Chuột', v: devDetail.mouse.verdict === 'bot_linear' ? 'Bot' : 'OK', bad: devDetail.mouse.verdict === 'bot_linear' });
  if (devDetail.scroll) checks.push({ k: 'Cuộn', v: devDetail.scroll.verdict === 'scrollTo_bot' ? 'Bot' : 'OK', bad: devDetail.scroll.verdict === 'scrollTo_bot' });
  if (devDetail.headless) checks.push({ k: 'Headless', v: 'Phát hiện', bad: true });
  if (devDetail.webdriver) checks.push({ k: 'Webdriver', v: 'Phát hiện', bad: true });

  // Detection log
  const dl = det.detectionLog || [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 rounded-t-2xl flex items-center justify-between ${blocked ? 'bg-red-50' : 'bg-amber-50'}`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-800">Cảnh báo #{ev.id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${blocked ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {REASON_VI[ev.reason] || ev.reason}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                {ev.source === 'widget' ? 'Script' : ev.source === 'vuotlink' ? 'Vượt link' : ev.source}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mobile ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                {mobile ? 'Mobile' : 'Desktop'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{fmt(ev.created_at)} · {ev.ip_address}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60"><X size={16} className="text-slate-500" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 text-xs">
          {/* Basic info */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            {[
              ['IP', ev.ip_address || '—', true],
              ['Visitor ID', ev.visitor_id || '—', true],
              ['Source', ev.source],
              ['Reason', REASON_VI[ev.reason] || ev.reason],
            ].map(([k, v, copyable]) => (
              <div key={k} className="flex justify-between gap-2 items-center">
                <span className="text-slate-400 shrink-0">{k}</span>
                <div className="flex items-center gap-1 min-w-0 max-w-[65%]">
                  <span className="font-semibold text-slate-700 text-right truncate">{v || '—'}</span>
                  {copyable && v && v !== '—' && (
                    <button onClick={() => navigator.clipboard.writeText(v)}
                      className="p-0.5 rounded hover:bg-slate-200 transition shrink-0" title="Sao chép">
                      <Copy size={11} className="text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* User Agent */}
          {ev.user_agent && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">User Agent</p>
              <div className="bg-slate-50 rounded-xl p-2.5 font-mono text-[10px] text-slate-600 break-all leading-relaxed">
                {ev.user_agent}
              </div>
            </div>
          )}

          {/* Task info (if linked) */}
          {taskInfo.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Task liên quan</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                {taskInfo.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-slate-400">{k}</span>
                    <span className="font-semibold text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detection log */}
          {dl.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Detection Log</p>
              <div className="flex flex-wrap gap-1">
                {dl.map((d, i) => <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">{d}</span>)}
              </div>
            </div>
          )}

          {/* Browser checks */}
          {checks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Kiểm tra trình duyệt</p>
              <div className="space-y-1">
                {checks.map((c, i) => (
                  <div key={i} className={`flex justify-between px-3 py-1.5 rounded-lg ${c.bad ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <span className={c.bad ? 'text-red-700 font-medium' : 'text-slate-600'}>{c.k}</span>
                    <span className={`font-bold ${c.bad ? 'text-red-800' : 'text-slate-800'}`}>{String(c.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device reasons */}
          {devReasons.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Phân tích thiết bị</p>
              <div className="flex flex-wrap gap-1">
                {devReasons.map((r, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700">{r}</span>
                ))}
              </div>
            </div>
          )}

          {/* Lied sections detail */}
          {(det.liedSections || []).length > 0 && !checks.some(c => c.k === 'Mục giả mạo') && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Mục giả mạo</p>
              <div className="flex flex-wrap gap-1">
                {det.liedSections.map((s, i) => <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600">{s}</span>)}
              </div>
            </div>
          )}

          {!checks.length && !devReasons.length && !dl.length && taskInfo.length === 0 && (
            <p className="text-center text-slate-400 py-6">Chưa có dữ liệu chi tiết</p>
          )}
        </div>

        <div className="px-5 py-3 border-t">
          <button onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Đóng</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Pagination ─── */
function Pager({ page, total, limit, onChange }) {
  const pages = Math.ceil(total / limit) || 1;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs">
      <span className="text-slate-500">Trang {page}/{pages} ({total})</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white"><ChevronLeft size={14} /></button>
        <button onClick={() => onChange(page + 1)} disabled={page >= pages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

/* ─── User Detail View ─── */
function UserDetail({ user: u, onBack }) {
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]); const [taskTotal, setTaskTotal] = useState(0);
  const [events, setEvents] = useState([]); const [eventTotal, setEventTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const LIMIT = 50;

  // Load tasks
  useEffect(() => {
    setLoading(true);
    api.get(`/admin/security/user/${u.id}/tasks?page=${taskPage}&limit=${LIMIT}`)
      .then(d => { setTasks(d.tasks || []); setTaskTotal(d.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [u.id, taskPage]);

  // Load events on tab switch or page change
  useEffect(() => {
    if (tab === 'events') {
      setEventsLoading(true);
      api.get(`/admin/security/user/${u.id}/events?page=${eventPage}&limit=${LIMIT}`)
        .then(d => { setEvents(d.events || []); setEventTotal(d.total || 0); })
        .catch(console.error)
        .finally(() => setEventsLoading(false));
    }
  }, [tab, u.id, eventPage]);

  const [banned, setBanned] = useState(u.status === 'banned');

  const toggleBan = async () => {
    const action = banned ? 'unban' : 'ban';
    if (!confirm(banned ? `Mở ban cho ${u.name || u.email}?` : `Ban tài khoản ${u.name || u.email}? Tất cả link, API, dịch vụ sẽ bị khóa.`)) return;
    try {
      await api.post(`/admin/security/user/${u.id}/ban`, { action });
      setBanned(!banned);
    } catch (e) { alert('Lỗi: ' + e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
          <ArrowLeft size={16} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900">{u.name || 'User'}</h2>
            {banned && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">BANNED</span>}
          </div>
          <p className="text-xs text-slate-500">{u.email} · {taskTotal} task tổng cộng</p>
        </div>
        <button onClick={toggleBan}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            banned
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
          }`}
        >
          {banned ? 'Mở ban' : 'Ban'}
        </button>
        <button onClick={async () => {
          if (!confirm(`Xóa hoàn toàn ${u.name || u.email}?\nTất cả tasks, links, giao dịch, ví sẽ bị XÓA VĨNH VIỄN.`)) return;
          if (!confirm('XÁC NHẬN LẦN 2: Hành động này KHÔNG THỂ HOÀN TÁC. Tiếp tục?')) return;
          try {
            await api.delete(`/admin/users/${u.id}`);
            alert('Đã xóa user và toàn bộ dữ liệu');
            onBack();
          } catch (e) { alert('Lỗi: ' + e.message); }
        }}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition"
        >
          Xóa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          ['Tổng', u.total, 'text-slate-800'],
          ['Hoàn thành', u.ok, 'text-emerald-600'],
          ['Blocked', u.blocked, 'text-red-600'],
          ['Cảnh báo', u.events, 'text-amber-600'],
          ['Thu nhập', money(u.earned), 'text-emerald-600'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase">{l}</p>
            <p className={`text-lg font-black ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['tasks', `Tasks (${taskTotal})`], ['events', `Cảnh báo (${eventTotal || u.events})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${tab === k ? 'bg-violet-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{l}</button>
        ))}
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Thời gian','Nguồn','Trạng thái','IP','Keyword','Earning','Đánh giá',''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Không có task</td></tr>
                ) : tasks.map(t => {
                  const s = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={t.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${t.bot_detected ? 'bg-red-50/20' : ''}`}>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmt(t.created_at)}</td>
                      <td className="px-3 py-2.5">
                        {t.worker_link_id
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">GW{t.gateway_slug ? ` /${t.gateway_slug}` : ''}</span>
                          : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">VL</span>
                        }
                      </td>
                      <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.c}`}>{s.l}</span></td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[10px]">{t.ip_address}</td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-[120px] truncate">{t.keyword || '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-emerald-700">{t.earning ? money(t.earning) : '—'}</td>
                      <td className="px-3 py-2.5">
                        {t.bot_detected
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">BOT</span>
                          : t.status === 'completed'
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setModal(t)} className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-[10px] font-bold">
                          <Eye size={11} className="inline mr-0.5" />Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={taskPage} total={taskTotal} limit={LIMIT} onChange={setTaskPage} />
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Thời gian','Loại','Nguồn','Thiết bị','IP','Visitor ID','Chi tiết',''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventsLoading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                ) : events.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Không có cảnh báo</td></tr>
                ) : events.map(ev => {
                  let det = {};
                  try { det = JSON.parse(ev.details || '{}'); } catch {}
                  const isBlocked = ['creep_detected','automation_probes','mouse_bot','bot_ua','bot_behavior','ip_rate_limit','device_fake'].includes(ev.reason);
                  const mob = isMobileUA(ev.user_agent);
                  const hasDetail = det.totalLied > 0 || det.liedSections?.length || det.taskId || det.score > 0 || det.reasons?.length;
                  return (
                    <tr key={ev.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${isBlocked ? 'bg-red-50/20' : ''}`}>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmt(ev.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isBlocked ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {REASON_VI[ev.reason] || ev.reason}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {ev.source === 'widget' ? 'Script' : ev.source === 'vuotlink' ? 'VL' : ev.source}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mob ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                          {mob ? 'Mobile' : 'Desktop'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[10px]">{ev.ip_address}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500 text-[10px] max-w-[80px] truncate">{ev.visitor_id ? ev.visitor_id.substring(0, 12) + '...' : '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-0.5">
                          {det.score > 0 && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${det.score >= 50 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>Score:{det.score}</span>}
                          {(det.reasons || []).slice(0, 2).map((r, i) => <span key={`r${i}`} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">{r}</span>)}
                          {det.totalLied > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">Lied:{det.totalLied}</span>}
                          {(det.liedSections || []).slice(0, 2).map((s, i) => <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">{s}</span>)}
                          {det.count > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600">x{det.count}</span>}
                          {!hasDetail && <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setEventModal(ev)} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold">
                          <Eye size={11} className="inline mr-0.5" />Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={eventPage} total={eventTotal} limit={LIMIT} onChange={setEventPage} />
        </div>
      )}

      {modal && <TaskModal task={modal} onClose={() => setModal(null)} />}
      {eventModal && <EventModal event={eventModal} onClose={() => setEventModal(null)} />}
    </div>
  );
}

/* ─── IP Analysis Tab ─── */
function IPAnalysis() {
  const [ips, setIps] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('tasks');
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [expandedIp, setExpandedIp] = useState(null);
  const [ipDetail, setIpDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const LIMIT = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/admin/security/ips?sort=${sort}&days=${days}&page=${page}&limit=${LIMIT}`);
      setIps(d.ips || []); setTotal(d.total || 0); setSummary(d.summary || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [sort, days, page]);

  useEffect(() => { load(); }, [load]);

  const toggleDetail = async (ipAddr) => {
    if (expandedIp === ipAddr) { setExpandedIp(null); setIpDetail(null); return; }
    setExpandedIp(ipAddr);
    setDetailLoading(true);
    try {
      const d = await api.get(`/admin/security/ip/${ipAddr}`);
      setIpDetail(d);
    } catch (e) { console.error(e); setIpDetail(null); }
    setDetailLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['IP duy nhat', summary.total_ips || 0, 'text-blue-600'],
          ['Tong tasks', summary.total_tasks || 0, 'text-slate-800'],
          ['Bot detected', summary.total_bots || 0, 'text-red-600'],
          ['Workers', summary.total_workers || 0, 'text-emerald-600'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase">{l}</p>
            <p className={`text-xl font-black ${c}`}>{Number(v).toLocaleString('vi-VN')}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {[['7 ngay', 7], ['14 ngay', 14], ['30 ngay', 30]].map(([l, d]) => (
          <button key={d} onClick={() => { setDays(d); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${days === d ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{l}</button>
        ))}
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          className="ml-auto px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white">
          <option value="tasks">Tasks nhieu nhat</option>
          <option value="blocked">Blocked nhieu nhat</option>
          <option value="workers">Nhieu worker</option>
          <option value="incomplete">Ty le that bai cao</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['IP', 'Tasks', 'OK', 'Expired', 'Bot', 'Blocked', 'Workers', 'Devices', 'That bai %', 'Hoat dong'].map(h => (
                  <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px] ${h === 'IP' || h === 'Hoat dong' ? 'text-left' : 'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400">Dang tai...</td></tr>
              ) : ips.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400">Chua co du lieu</td></tr>
              ) : ips.map(ip => {
                const danger = ip.blocked > 0 || ip.unique_workers > 2;
                const isExpanded = expandedIp === ip.ip_address;
                return (
                  <React.Fragment key={ip.ip_address}>
                    <tr onClick={() => toggleDetail(ip.ip_address)}
                      className={`border-b cursor-pointer ${danger ? 'bg-red-50/30 border-red-100' : 'border-slate-100'} ${isExpanded ? 'bg-violet-50/50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 font-bold">
                        <span className="underline decoration-dotted">{ip.ip_address}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700">{ip.total_tasks}</td>
                      <td className="px-3 py-2.5 text-center text-emerald-600 font-bold">{ip.completed}</td>
                      <td className="px-3 py-2.5 text-center text-slate-400">{ip.expired}</td>
                      <td className="px-3 py-2.5 text-center">
                        {ip.bot_detected > 0 ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{ip.bot_detected}</span> : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ip.blocked > 0 ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{ip.blocked}</span> : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ip.unique_workers > 1 ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ip.unique_workers > 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{ip.unique_workers}</span> : <span className="text-slate-400">1</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500">{ip.unique_devices}</td>
                      <td className="px-3 py-2.5 text-center">
                        {ip.incomplete_rate > 50 ? <span className="font-bold text-red-600">{ip.incomplete_rate}%</span>
                          : ip.incomplete_rate > 20 ? <span className="font-bold text-amber-600">{ip.incomplete_rate}%</span>
                          : <span className="text-slate-400">{ip.incomplete_rate}%</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{ago(ip.last_seen)}</td>
                    </tr>
                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} className="px-4 py-4 bg-slate-50/80 border-b border-slate-200">
                          {detailLoading ? (
                            <div className="flex justify-center py-4">
                              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : ipDetail ? (
                            <div className="space-y-3">
                              {/* Risk Score */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                                  ipDetail.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                                  ipDetail.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  Risk: {ipDetail.riskScore}/100 ({ipDetail.riskLevel === 'high' ? 'Cao' : ipDetail.riskLevel === 'medium' ? 'Trung binh' : 'Thap'})
                                </div>
                                {(ipDetail.risks || []).map((r, i) => (
                                  <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    r.severity === 'high' ? 'bg-red-50 text-red-700' :
                                    r.severity === 'medium' ? 'bg-amber-50 text-amber-700' :
                                    'bg-blue-50 text-blue-700'
                                  }`}>{r.label}</span>
                                ))}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Workers */}
                                <div className="bg-white rounded-xl border border-slate-200 p-3">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Workers ({(ipDetail.workers || []).length})</p>
                                  {(ipDetail.workers || []).length === 0 ? (
                                    <p className="text-[10px] text-slate-400">Khong co worker</p>
                                  ) : (ipDetail.workers || []).map(w => (
                                    <div key={w.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-bold text-slate-700 truncate">{w.name || 'N/A'}</p>
                                        <p className="text-[9px] text-slate-400 truncate">{w.email}</p>
                                      </div>
                                      <div className="text-right shrink-0 ml-2">
                                        <p className="text-[10px] font-bold text-slate-600">{w.task_count} tasks</p>
                                        {w.status === 'banned' && <span className="text-[8px] font-bold text-red-600">BAN</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Geo Info */}
                                <div className="bg-white rounded-xl border border-slate-200 p-3">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Thong tin IP</p>
                                  {ipDetail.geo ? (
                                    <div className="space-y-1.5 text-[10px]">
                                      {[
                                        ['Quoc gia', ipDetail.geo.country],
                                        ['Thanh pho', [ipDetail.geo.city, ipDetail.geo.region].filter(Boolean).join(', ')],
                                        ['ISP', ipDetail.geo.isp],
                                        ['Org', ipDetail.geo.org],
                                      ].map(([k, v]) => v && (
                                        <div key={k} className="flex justify-between">
                                          <span className="text-slate-400">{k}</span>
                                          <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">{v}</span>
                                        </div>
                                      ))}
                                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                        {ipDetail.geo.proxy && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">VPN/Proxy</span>}
                                        {ipDetail.geo.hosting && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">Datacenter</span>}
                                        {ipDetail.geo.mobile && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-100 text-cyan-700">Mobile</span>}
                                        {!ipDetail.geo.proxy && !ipDetail.geo.hosting && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">Residential</span>}
                                      </div>
                                    </div>
                                  ) : <p className="text-[10px] text-slate-400">Khong co du lieu geo</p>}
                                </div>

                                {/* Daily breakdown */}
                                <div className="bg-white rounded-xl border border-slate-200 p-3">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">7 ngay gan day</p>
                                  {(ipDetail.dailyBreakdown || []).length === 0 ? (
                                    <p className="text-[10px] text-slate-400">Khong co du lieu</p>
                                  ) : (ipDetail.dailyBreakdown || []).slice(0, 7).map((d, i) => (
                                    <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                      <span className="text-[10px] text-slate-500">{new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-700">{d.tasks} tasks</span>
                                        <span className="text-[10px] text-emerald-600">{d.completed} OK</span>
                                      </div>
                                    </div>
                                  ))}
                                  {ipDetail.allTime && (
                                    <div className="mt-2 pt-2 border-t border-slate-100">
                                      <p className="text-[9px] text-slate-400">Tong lich su: {ipDetail.allTime.total} tasks</p>
                                      {ipDetail.allTime.firstSeen && <p className="text-[9px] text-slate-400">Tu: {fmt(ipDetail.allTime.firstSeen)}</p>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : <p className="text-center text-slate-400 text-xs">Khong tai duoc du lieu</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                  */
/* ═══════════════════════════════════════════════════════════ */
export default function AdminSecurity() {
  usePageTitle('Admin - Anti Cheat');
  const [mainTab, setMainTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [sort, setSort] = useState('ok');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: LIMIT, sort });
      if (search) p.set('search', search);
      if (dateFrom) p.set('from', dateFrom);
      if (dateTo) p.set('to', dateTo);
      const d = await api.get(`/admin/security/users?${p}`);
      setUsers(d.users || []); setTotal(d.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, page, sort, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Quick date presets
  const setPreset = (days) => {
    if (days === 0) { setDateFrom(''); setDateTo(''); }
    else {
      const now = new Date();
      const from = new Date(now); from.setDate(now.getDate() - days);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
    }
    setPage(1);
  };

  if (detail) return <UserDetail user={detail} onBack={() => { setDetail(null); load(); }} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Shield size={20} className="text-violet-600" /> Anti Cheat
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} user</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>
      {/* Main tabs */}
      <div className="flex gap-2">
        {[['users', 'Users'], ['ips', 'Phân tích IP']].map(([k, l]) => (
          <button key={k} onClick={() => setMainTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${mainTab === k ? 'bg-violet-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{l}</button>
        ))}
      </div>

      {mainTab === 'ips' && <IPAnalysis />}

      {mainTab === 'users' && <>
      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Time presets */}
        {[['Hôm nay', 1], ['7 ngày', 7], ['30 ngày', 30], ['Tất cả', 0]].map(([l, d]) => {
          const active = d === 0 ? (!dateFrom && !dateTo) : false;
          return (
            <button key={l} onClick={() => setPreset(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${active ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >{l}</button>
          );
        })}

        {/* Custom date range */}
        <div className="flex items-center gap-1 ml-1">
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400" />
          <span className="text-slate-400 text-xs">→</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400" />
        </div>

        {/* Sort */}
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          className="ml-auto px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400">
          <option value="ok">Hoàn thành ↓</option>
          <option value="blocked">Blocked ↓</option>
          <option value="earned">Thu nhập ↓</option>
          <option value="total">Tổng task ↓</option>
          <option value="last_at">Mới nhất ↓</option>
        </select>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Tìm tên, email..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['User','Tổng','OK','Blocked','Cảnh báo','IP','Hoạt động',''].map(h => (
                  <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px] ${h === 'User' || h === 'IP' || h === 'Hoạt động' ? 'text-left' : 'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Chưa có dữ liệu</td></tr>
              ) : users.map(u => {
                const danger = u.blocked > 0 || u.events > 0;
                return (
                  <tr key={u.id} className={`border-b hover:bg-red-50/60 ${danger ? 'bg-red-50 border-red-100' : 'border-slate-100 hover:bg-slate-50/50'}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {(u.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate flex items-center gap-1">
                            {u.name || 'N/A'}
                            {u.status === 'banned' && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-600">BAN</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">{u.total}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{u.ok}</td>
                    <td className="px-3 py-2.5 text-center">
                      {u.blocked > 0 ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{u.blocked}</span> : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {u.events > 0 ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{u.events}</span> : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-0.5">
                        {u.ips.slice(0, 2).map((ip, j) => <span key={j} className="font-mono text-[9px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded">{ip}</span>)}
                        {u.ips.length > 2 && <span className="text-[9px] text-slate-400">+{u.ips.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{ago(u.last_at)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setDetail(u)} className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-[10px] font-bold">
                        <Eye size={11} className="inline mr-0.5" />Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </div>
      </>}
    </div>
  );
}
