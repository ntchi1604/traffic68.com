import React, { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Search, RefreshCw, X, Eye, Copy,
  ChevronLeft, ChevronRight, ArrowLeft, Bot, AlertTriangle, CheckCircle,
  Activity, Globe, Download, Smartphone, Monitor, Clock
} from 'lucide-react';
import api from '../../lib/api';

/* ─── Helpers ─── */
const fmt = d => d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const ago = d => {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'vừa xong'; if (m < 60) return `${m}p trước`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)}d trước`;
};
const money = v => Number(v || 0).toLocaleString('vi-VN') + 'đ';
const isMobileUA = ua => /Mobi|Android|iPhone|iPad|iPod/i.test(ua || '');

const ST = {
  completed: { l: 'Hoàn thành', c: 'bg-emerald-100 text-emerald-700' },
  expired: { l: 'Hết hạn', c: 'bg-slate-100 text-slate-500' },
  pending: { l: 'Đang chờ', c: 'bg-amber-100 text-amber-700' },
  step1: { l: 'Bước 1', c: 'bg-blue-100 text-blue-700' },
  step2: { l: 'Bước 2', c: 'bg-blue-100 text-blue-700' },
  step3: { l: 'Bước 3', c: 'bg-violet-100 text-violet-700' },
};

const DL_VI = {
  headless_or_webdriver: 'Headless / Webdriver',
  Fingerprint_bot: 'Fingerprint Bot',
  ip_rate_limit: 'Rate limit IP',
  bot_ua: 'UA Bot',
  font_os_mismatch: 'Font/OS Mismatch',
  screen_window_mismatch: 'Screen=Window (Headless)',
  hardware_inconsistency: 'Phần cứng bất thường',
  canvas_noise_detected: 'Canvas Noise (Anti-detect)',
  click_latency_anomaly: 'Click bất thường (Bot click)',
  scroll_speed_bot: 'Cuộn quá nhanh (Bot)',
  fake_sensor: 'Cảm biến giả (Desktop→Mobile)',
  canvas_api_lied: 'Canvas API bị giả mạo',
  audio_api_lied: 'Audio API bị giả mạo',
  navigator_api_lied: 'Navigator bị giả mạo',
  webgl_api_lied: 'WebGL bị giả mạo',
  creepjs_bot: 'CreepJS Bot',
  creepjs_headless: 'CreepJS Headless',
  widget_bot_detected: 'Widget: Bot phát hiện',
  widget_bot: 'Widget Bot',
};

/* Reason events trong security_logs */
const REASON_VI = {
  widget_bot_detected: '🤖 Widget: Bot phát hiện',
  non_google_referrer: '🔗 Referrer không hợp lệ',
  bot_ua: '🤖 User-Agent Bot',
  ip_rate_limit: '⚡ Rate limit IP',
  completed: '✅ Hoàn thành task',
};


function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="p-0.5 rounded hover:bg-slate-200 transition shrink-0">
      {ok ? <CheckCircle size={11} className="text-emerald-500" /> : <Copy size={11} className="text-slate-400" />}
    </button>
  );
}

/* ─── Task Modal Redesign ─── */
function TaskModal({ task: t, onClose }) {
  if (!t) return null;
  let sd = {};
  try { sd = typeof t.security_detail === 'string' ? JSON.parse(t.security_detail || '{}') : (t.security_detail || {}); } catch { }
  const dl = sd.detectionLog || [];
  const mobile = isMobileUA(t.user_agent);
  const st = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600 border border-slate-200' };

  const botFlags = [];
  if (sd.botDetected || t.bot_detected) botFlags.push({ k: 'Hành vi tự động (BotDetected)', bad: true });
  if (sd.widget_bot) botFlags.push({ k: 'Widget Automation', bad: true });
  const allDl = [...(dl || []), ...(sd.widget_detection_log || [])];
  [...new Set(allDl)].forEach(d => botFlags.push({ k: DL_VI[d] || d, bad: true }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative z-10 overflow-hidden ring-1 ring-slate-200/50 scale-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

        {/* Header Ribbon */}
        <div className={`px-6 py-5 flex items-start justify-between border-b ${t.bot_detected ? 'bg-gradient-to-br from-rose-50 to-white border-rose-100' : t.status === 'completed' ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg font-black tracking-tight text-slate-900">Nhiệm Vụ #{t.id}</span>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm ${st.c}`}>{st.l}</span>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm border ${mobile ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {mobile ? <><Smartphone size={12} /> Mobile</> : <><Monitor size={12} /> Desktop</>}
              </span>
              {t.bot_detected && <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm bg-rose-500 text-white flex items-center gap-1.5"><Bot size={12} />SYSTEM DENIED</span>}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-2">
              <Clock size={12} className="text-slate-400" /> {fmt(t.created_at)}
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <Globe size={12} className="text-sky-500" /> <span className="font-mono text-[11px] text-sky-600 tracking-tight">{t.ip_address}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-200"><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6 custom-scrollbar">

          {/* Main Attributes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-3">
              {[
                ['Phân luồng', t.worker_link_id ? `Gateway (${t.gateway_slug || '?'})` : 'Vượt link cơ bản'],
                ['Chiến dịch đích', t.campaign_name || `#${t.campaign_id}`],
                ['Phiên duyệt', t.visitor_id || '—', true],
                ['Định danh IP', t.ip_address || '—', true],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between items-center pb-2 border-b border-slate-200/50 last:border-0 last:pb-0">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{k}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[12px] font-bold text-slate-800 truncate">{v || '—'}</span>
                    {c && v && <CopyBtn text={v} />}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-3">
              {[
                ['Từ khóa tìm kiếm', t.keyword],
                ['Domain mục tiêu', t.target_url, true],
                ['Thu nhập user', money(t.earning)],
                ['Thời gian onsite', t.time_on_site ? `${t.time_on_site} giây` : '—'],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between items-center pb-2 border-b border-slate-200/50 last:border-0 last:pb-0">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{k}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[12px] font-bold text-slate-800 truncate">{v || '—'}</span>
                    {c && v && <CopyBtn text={v} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Agent Block */}
          {t.user_agent && (
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search size={12} /> User Agent Origin</p>
              <div className="bg-slate-800 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 shadow-inner break-all leading-relaxed relative">
                <div className="absolute top-2 right-2 flex opacity-80"><CopyBtn text={t.user_agent} /></div>
                {t.user_agent}
              </div>
            </div>
          )}

          {/* Bot detection warnings */}
          {botFlags.length > 0 ? (
            <div className="bg-rose-50 rounded-2xl p-5 border border-rose-200/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <p className="text-[11px] font-black text-rose-500 uppercase tracking-wider mb-3 flex items-center gap-1.5 relative"><AlertTriangle size={14} /> Vi phạm Policies</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
                {botFlags.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/80 border border-rose-100 shadow-sm backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="font-bold text-slate-800 text-[12px]">{f.k}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200/60 shadow-inner">
              <CheckCircle size={16} className="text-emerald-500" />
              <span className="text-emerald-700 font-bold text-sm tracking-tight">Quy trình duyệt hợp lệ (Clean)</span>
            </div>
          )}

          {/* CreepJS Core Data */}
          {(sd.creepSummary || sd.canvasHash || sd.reasons?.length > 0) && (
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Shield size={12} /> Browser Introspection (Advanced)</p>
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 space-y-3">
                {sd.creepSummary && (
                  <>
                    {sd.creepSummary.totalLies > 0 && (
                      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                        <span className="text-[11px] font-black text-slate-400 uppercase">API LIES DETECTED</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${sd.creepSummary.totalLies >= 5 ? 'bg-rose-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                            {sd.creepSummary.totalLies} PHÁT HIỆN
                          </span>
                          {sd.creepSummary.canvasLied && <span className="text-[10px] font-bold text-rose-500 border border-rose-200 px-1.5 py-0.5 rounded">Canvas ✗</span>}
                          {sd.creepSummary.audioLied && <span className="text-[10px] font-bold text-rose-500 border border-rose-200 px-1.5 py-0.5 rounded">Audio ✗</span>}
                        </div>
                      </div>
                    )}
                    {sd.creepSummary.webglRenderer && (
                      <div className="flex flex-col gap-1.5 pt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase">WebGL Hardware</span>
                        <span className="bg-white px-3 py-2 rounded-lg font-mono text-[11px] text-slate-700 border border-slate-200 shadow-sm">{sd.creepSummary.webglRenderer}</span>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {sd.canvasHash && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Canvas Hash</span>
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="font-mono text-[11px] text-slate-600 truncate">{sd.canvasHash}</span>
                        <CopyBtn text={sd.canvasHash} />
                      </div>
                    </div>
                  )}
                  {sd.audioHash && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Audio Hash</span>
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="font-mono text-[11px] text-slate-600 truncate">{sd.audioHash}</span>
                      </div>
                    </div>
                  )}
                </div>

                {sd.canvas?.noisy === true && (
                  <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-rose-50 rounded-xl border border-rose-200 shadow-sm">
                    <Bot size={14} className="text-rose-500" />
                    <span className="text-rose-700 font-bold text-[11px]">Trình duyệt Antidetect (Canvas Noise Injection)</span>
                  </div>
                )}

                {sd.reasons && sd.reasons.length > 0 && (
                  <div className="pt-3 border-t border-slate-200/60 mt-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Dấu hiệu bổ sung</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sd.reasons.map((r, i) => (
                        <span key={i} className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-[2rem]">
          <button onClick={onClose} className="w-full py-3 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl transition-all focus:outline-none focus:ring-4 focus:ring-slate-100">
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Event Detail Modal ─── */
function EventModal({ event: ev, onClose }) {
  if (!ev) return null;
  let det = {};
  try { det = typeof ev.details === 'string' ? JSON.parse(ev.details || '{}') : (ev.details || {}); } catch { }
  const mobile = isMobileUA(ev.user_agent);
  const dl = det.detectionLog || [];

  const flags = [];
  if (det.bot === true) flags.push('Fingerprint Bot');
  if (det.webdriver) flags.push('Webdriver (Automation)');
  if (det.selenium) flags.push('Selenium');
  if (det.cdc) flags.push('CDP Controller');
  dl.forEach(d => { if (!flags.includes(DL_VI[d] || d)) flags.push(DL_VI[d] || d); });
  if (det.count > 0) flags.push(`Rate limit ×${det.count}`);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative z-10 overflow-hidden ring-1 ring-slate-200/50 scale-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

        {/* Header Ribbon */}
        <div className="px-6 py-5 flex items-start justify-between border-b bg-gradient-to-br from-rose-50 to-white border-rose-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg font-black tracking-tight text-slate-900">Log Gian Lận #{ev.id}</span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-sm flex items-center gap-1.5"><Bot size={12} />{REASON_VI[ev.reason] || ev.reason}</span>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm border ${ev.source === 'widget' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                {ev.source === 'widget' ? 'Core Script' : ev.source === 'vuotlink' ? 'Vượt Link' : ev.source}
              </span>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm border ${mobile ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {mobile ? <><Smartphone size={12} /> Mobile</> : <><Monitor size={12} /> Desktop</>}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-2">
              <Clock size={12} className="text-slate-400" /> {fmt(ev.created_at)}
              <span className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
              <Globe size={12} className="text-rose-400" /> <span className="font-mono text-rose-600 tracking-tight">{ev.ip_address}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-200"><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5 custom-scrollbar bg-slate-50/30">

          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
            {[
              ['Địa chỉ IP', ev.ip_address || '—', true],
              ['Mã thiết bị (Visitor ID)', ev.visitor_id || '—', true],
              ['Phân loại rủi ro', ev.reason],
              ['Hệ thống ghi nhận', ev.source],
            ].map(([k, v, copyable]) => (
              <div key={k} className="flex justify-between items-center pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{k}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[12px] font-bold text-slate-800 truncate">{v || '—'}</span>
                  {copyable && v && v !== '—' && <CopyBtn text={v} />}
                </div>
              </div>
            ))}
          </div>

          {ev.user_agent && (
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search size={12} /> Browser User Agent</p>
              <div className="bg-slate-800 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 shadow-inner break-all leading-relaxed relative border border-slate-700">
                <div className="absolute top-2 right-2 flex opacity-80"><CopyBtn text={ev.user_agent} /></div>
                {ev.user_agent}
              </div>
            </div>
          )}

          {flags.length > 0 && (
            <div className="bg-rose-50 rounded-2xl p-5 border border-rose-200/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <p className="text-[11px] font-black text-rose-500 uppercase tracking-wider mb-3 flex items-center gap-1.5 relative"><Bot size={14} /> Cờ Ghi Nhận Gian Lận</p>
              <div className="flex flex-wrap gap-2 relative z-10">
                {flags.map((f, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white text-rose-700 border border-rose-100 shadow-sm flex items-center gap-1.5 hover:border-rose-300 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {det.reasons && det.reasons.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200/60">
              <p className="text-[11px] font-black text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1.5"><AlertTriangle size={14} /> Chi Tiết Hành Vi Nghi Vấn</p>
              <div className="space-y-2">
                {det.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-white/80 border border-amber-100 shadow-sm">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-amber-800 text-[12px] font-medium leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device Score Block */}
          {det.deviceScore != null && (
            <div className={`flex items-center justify-between p-4 rounded-2xl border ${det.deviceScore >= 80 ? 'bg-rose-50 border-rose-200' : det.deviceScore >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Hệ Số Chấm Điểm Rủi Ro (Risk Score)</span>
                {det.deviceType && <span className="text-xs font-semibold text-slate-400 mt-0.5">{det.deviceType}</span>}
              </div>
              <div className={`text-3xl font-black ${det.deviceScore >= 80 ? 'text-rose-600' : det.deviceScore >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {det.deviceScore}<span className="text-sm opacity-50">/100</span>
              </div>
            </div>
          )}

          {/* Occurrences History */}
          {ev.occurrences && ev.occurrences.length > 1 && (
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                🔁 Tổng hợp lịch sử lặp lại ({ev.occurrences.length} Lần)
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {ev.occurrences.map((occ, i) => {
                  let occDet = {};
                  try { occDet = typeof occ.details === 'string' ? JSON.parse(occ.details || '{}') : (occ.details || {}); } catch { }
                  const occReasons = occDet.reasons?.length > 0 ? occDet.reasons : (occDet.detectionLog || []);
                  return (
                    <div key={i} className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                        <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">Lần {i + 1}</span>
                        <span className="text-[11px] font-semibold text-slate-500">{fmt(occ.created_at)}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {(occ.gateway_slug || occ.target_url) && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded truncate border border-slate-100">
                            MỤC TIÊU: {occ.gateway_slug ? `g/${occ.gateway_slug}` : (occ.target_url || '').slice(0, 50)}
                          </span>
                        )}
                        {occReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {occReasons.map((r, j) => (
                              <span key={j} className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-[2rem]">
          <button onClick={onClose} className="w-full py-3 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl transition-all focus:outline-none focus:ring-4 focus:ring-slate-100">
            Đóng cửa sổ
          </button>
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
function UserDetail({ user: u, onBack, dateFrom, dateTo }) {
  const dateParams = (dateFrom || dateTo)
    ? `&from=${dateFrom || ''}&to=${dateTo || ''}`
    : '';
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]); const [taskTotal, setTaskTotal] = useState(u.total || 0);
  const [events, setEvents] = useState([]); const [eventTotal, setEventTotal] = useState(u.events || 0);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [banned, setBanned] = useState(u.status === 'banned');
  const [taskFilter, setTaskFilter] = useState({ ip: '', visitorId: '', slug: '' });
  const [taskFilterInput, setTaskFilterInput] = useState({ ip: '', visitorId: '', slug: '' });
  // IP detail
  const [selectedIp, setSelectedIp] = useState(null);
  const [ipDetail, setIpDetail] = useState(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [allIps, setAllIps] = useState(u.ips || []);
  const [ipsLoaded, setIpsLoaded] = useState(false);
  const [ipFilter, setIpFilter] = useState('all');
  const [ipPage, setIpPage] = useState(1);
  const IP_PER_PAGE = 15;
  const LIMIT = 50;

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: taskPage, limit: LIMIT });
    if (taskFilter.ip) p.set('ip', taskFilter.ip);
    if (taskFilter.visitorId) p.set('visitorId', taskFilter.visitorId);
    if (taskFilter.slug) p.set('slug', taskFilter.slug);
    if (dateFrom) p.set('from', dateFrom);
    if (dateTo) p.set('to', dateTo);
    api.get(`/admin/security/user/${u.id}/tasks?${p}`)
      .then(d => { setTasks(d.tasks || []); setTaskTotal(d.total || 0); })
      .catch(console.error).finally(() => setLoading(false));
  }, [u.id, taskPage, taskFilter]);

  // Load danh sách IP đầy đủ khi mở tab IPs
  useEffect(() => {
    if (tab === 'ips' && !ipsLoaded) {
      api.get(`/admin/security/user/${u.id}/ips`)
        .then(d => { setAllIps(d.ips || u.ips || []); setIpsLoaded(true); })
        .catch(() => setIpsLoaded(true));
    }
  }, [tab, u.id, ipsLoaded]);

  useEffect(() => {
    if (tab === 'events') {
      setEventsLoading(true);
      api.get(`/admin/security/user/${u.id}/events?page=${eventPage}&limit=${LIMIT}${dateParams}`)
        .then(d => { setEvents(d.events || []); setEventTotal(d.total || 0); })
        .catch(console.error).finally(() => setEventsLoading(false));
    }
  }, [tab, u.id, eventPage]);

  const exportEvents = async () => {
    if (!confirm('Xuất toàn bộ bot events của user này ra file CSV?')) return;
    try {
      setEventsLoading(true);
      const d = await api.get(`/admin/security/user/${u.id}/events?page=1&limit=10000${dateParams}`);
      const allEvents = d.events || [];
      if (allEvents.length === 0) return alert('Không có dữ liệu');

      const BOM = '\uFEFF';
      let csv = BOM + 'Thời gian,Nguồn,Thiết bị,IP,Visitor ID,Link Vượt\n';
      allEvents.forEach(ev => {
        const mob = isMobileUA(ev.user_agent);
        const source = ev.source === 'widget' ? 'Script' : ev.source === 'vuotlink' ? 'VL' : ev.source;
        const device = mob ? 'Mobile' : 'Desktop';
        let linkVuot = '';
        try {
          const det = typeof ev.details === 'string' ? JSON.parse(ev.details || '{}') : (ev.details || {});
          const slug = ev.gateway_slug || det.gatewaySlug || null;
          const tUrl = ev.target_url || det.targetUrl || det.url || '';
          linkVuot = slug ? `https://traffic68.com/vuot-link/${slug}` : tUrl;
        } catch (e) { }
        csv += `"${new Date(ev.created_at).toLocaleString('vi-VN')}","${source}","${device}","${ev.ip_address}","${ev.visitor_id || ''}","${linkVuot}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bot-events-${u.email.split('@')[0]}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Lỗi xuất CSV: ' + e.message);
    } finally {
      if (tab === 'events') {
        api.get(`/admin/security/user/${u.id}/events?page=${eventPage}&limit=${LIMIT}`).then(d => { setEvents(d.events || []); setEventTotal(d.total || 0); }).catch(console.error).finally(() => setEventsLoading(false));
      } else {
        setEventsLoading(false);
      }
    }
  };


  const toggleBan = async () => {
    const action = banned ? 'unban' : 'ban';
    if (!confirm(banned ? `Mở ban cho ${u.name || u.email}?` : `Ban tài khoản ${u.name || u.email}?`)) return;
    try { await api.post(`/admin/security/user/${u.id}/ban`, { action }); setBanned(!banned); }
    catch (e) { alert('Lỗi: ' + e.message); }
  };

  const loadIp = async (ip) => {
    if (selectedIp === ip) { setSelectedIp(null); setIpDetail(null); return; }
    setSelectedIp(ip); setIpLoading(true); setIpDetail(null);
    try { const d = await api.get(`/admin/security/ip/${ip}`); setIpDetail(d); }
    catch (e) { setIpDetail(null); }
    setIpLoading(false);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header Profile */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 via-transparent to-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative p-6 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between border-b border-slate-100/60 bg-white/60 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded hover:bg-slate-100 transition-colors text-slate-500">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-4">
              <div className="relative">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md shadow-slate-200" />
                ) : (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold bg-gradient-to-tr from-violet-100 to-indigo-50 text-indigo-600 border-2 border-white shadow-md shadow-slate-200">
                    {(u.name || u.email || '?')[0].toUpperCase()}
                  </div>
                )}
                {banned && (
                  <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-rose-500 rounded text-[9px] font-bold text-white tracking-wider shadow-sm ring-2 ring-white">
                    BANNED
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-lg font-bold text-slate-900">{u.name || 'Người Dùng Ẩn Danh'}</h2>
                  {u.events > 5 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1"><AlertTriangle size={10} /> RỦI RO</span>}
                </div>
                <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                  {u.email} <span className="w-1 h-1 rounded-full bg-slate-300" /> ID: {u.id}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={toggleBan}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-offset-1 flex items-center justify-center gap-2
                ${banned ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                  : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}>
              {banned ? <><Shield size={16} /> Bỏ Cấm Tài Khoản</> : <><AlertTriangle size={16} /> Cấm Tài Khoản</>}
            </button>
            <button onClick={async () => {
              if (!confirm(`Xóa ${u.name || u.email}?\nTất cả dữ liệu sẽ bị xóa vĩnh viễn.`)) return;
              if (!confirm('XÁC NHẬN: Hành động KHÔNG THỂ HOÀN TÁC. Tiếp tục?')) return;
              try { await api.delete(`/admin/users/${u.id}`); alert('Đã xóa user'); onBack(); }
              catch (e) { alert('Lỗi: ' + e.message); }
            }} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100/60 bg-slate-50/50">
          <div className="p-6 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-500 shadow-inner">
              <Bot size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng Nhiệm Vụ</p>
              <p className="text-2xl font-black text-slate-700 tracking-tight">{u.total}</p>
            </div>
          </div>
          <div className="p-6 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-100/50 text-emerald-600 shadow-inner">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hoàn thành</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-slate-700 tracking-tight">{u.ok}</p>
                {u.total > 0 && <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">({((u.ok / u.total) * 100).toFixed(1)}%)</span>}
              </div>
            </div>
          </div>
          <div className="p-6 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-100/50 text-rose-500 shadow-inner">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cảnh báo Bot</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-slate-700 tracking-tight">{u.events || 0}</p>
              </div>
            </div>
          </div>
          <div className="p-6 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-100/50 text-indigo-500 shadow-inner">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Thu Nhập</p>
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 tracking-tight">{money(u.earned)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 w-fit">
        {[['tasks', `Nhiệm vụ (${taskTotal})`], ['events', `Phát hiện Bot (${eventTotal})`], ['ips', `Địa chỉ IP (${allIps.length}${!ipsLoaded && allIps.length >= 5 ? '+' : ''})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap items-center bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            {[
              { key: 'ip', placeholder: 'IP Address' },
              { key: 'visitorId', placeholder: 'Visitor ID' },
              { key: 'slug', placeholder: 'Slug Link' },
            ].map(({ key, placeholder }) => (
              <div key={key} className="flex items-center gap-1.5 flex-1 min-w-[160px] bg-slate-50 px-3 py-1.5 rounded border border-slate-200 focus-within:border-slate-400 transition-colors">
                <input
                  value={taskFilterInput[key]}
                  onChange={e => setTaskFilterInput(f => ({ ...f, [key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { setTaskFilter({ ...taskFilterInput, [key]: taskFilterInput[key] }); setTaskPage(1); } }}
                  placeholder={placeholder}
                  className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder-slate-400"
                />
                {taskFilterInput[key] && (
                  <button onClick={() => { const f = { ...taskFilterInput, [key]: '' }; setTaskFilterInput(f); setTaskFilter(f); setTaskPage(1); }}
                    className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { setTaskFilter(taskFilterInput); setTaskPage(1); }}
                className="px-4 py-2 rounded bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors">
                Lọc dữ liệu
              </button>
              {(taskFilter.ip || taskFilter.visitorId || taskFilter.slug) && (
                <button onClick={() => { const empty = { ip: '', visitorId: '', slug: '' }; setTaskFilter(empty); setTaskFilterInput(empty); setTaskPage(1); }}
                  className="px-4 py-2 rounded bg-slate-100 text-slate-600 hover:text-slate-800 text-sm font-semibold hover:bg-slate-200 transition-colors">
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Thời gian', 'Nguồn', 'Trạng thái', 'IP Device', 'Từ khóa', 'Thưởng', 'Phân tích BOT', ''].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-500">Đang tải biểu dữ liệu...</td></tr>
                  ) : tasks.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400 font-medium">Không có dữ liệu phù hợp</td></tr>
                  ) : tasks.map((t) => {
                    const s = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600' };
                    return (
                      <tr key={t.id} className={`group hover:bg-slate-50 transition-colors ${t.bot_detected ? 'bg-red-50/50 hover:bg-red-50' : ''}`}>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmt(t.created_at)}</td>
                        <td className="px-4 py-3">
                          {t.worker_link_id
                            ? <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">Gateway {t.gateway_slug ? ` /${t.gateway_slug}` : ''}</span>
                            : <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">Vượt Link</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.c}`}>{s.l}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-xs">{t.ip_address}</td>
                        <td className="px-4 py-3 text-slate-700 text-xs max-w-[150px] truncate">{t.keyword || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 text-xs">{t.earning ? money(t.earning) : '—'}</td>
                        <td className="px-4 py-3">
                          {t.bot_detected
                            ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">✗ Bị từ chối</span>
                            : t.status === 'completed'
                              ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">✓ Hợp lệ</span>
                              : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setModal(t)} className="opacity-100 lg:opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 text-xs font-semibold transition-all lg:translate-x-2 group-hover:translate-x-0">
                            Hiển thị
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50/50">
              <Pager page={taskPage} total={taskTotal} limit={LIMIT} onChange={setTaskPage} />
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={exportEvents} disabled={eventsLoading}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold rounded shadow-sm transition-colors disabled:opacity-50">
              <Download size={16} /> Xuất File CSV
            </button>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Xảy ra lúc', 'Mã lỗi phát hiện', 'Nguồn gốc', 'Nền tảng', 'Device IP', 'Fingerprint ID', ''].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eventsLoading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-slate-400" />
                        <span>Đang tải dữ liệu cảnh báo...</span>
                      </div>
                    </td></tr>
                  ) : events.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Activity size={32} className="opacity-30 mb-2" />
                        <span className="font-medium text-sm">Chưa có cảnh báo hệ thống nào</span>
                      </div>
                    </td></tr>
                  ) : (() => {
                    const groups = [];
                    events.forEach(ev => {
                      const last = groups[groups.length - 1];
                      if (last && last.ip_address === ev.ip_address && last.visitor_id === ev.visitor_id) {
                        last.occurrences.push(ev);
                      } else {
                        groups.push({ ...ev, occurrences: [ev] });
                      }
                    });

                    return groups.map((evGroup, idx) => {
                      const rootEv = evGroup.occurrences[0];
                      const mob = isMobileUA(rootEv.user_agent);
                      const isGroup = evGroup.occurrences.length > 1;

                      const allReasons = [];
                      evGroup.occurrences.forEach(occ => {
                        if (!allReasons.includes(occ.reason)) allReasons.push(occ.reason);
                      });

                      return (
                        <tr key={rootEv.id || `${rootEv.created_at}_${idx}`} className="group hover:bg-slate-50 transition-colors bg-white">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-slate-600 text-xs">{fmt(rootEv.created_at)}</span>
                            {(rootEv.count > 1 || isGroup) && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                {isGroup ? `×${evGroup.occurrences.length}` : `×${rootEv.count}`} LẦN
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[280px]">
                            <div className="flex flex-wrap gap-1.5">
                              {allReasons.slice(0, 2).map((r, ri) => (
                                <span key={ri} className="px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-100 w-fit">{r}</span>
                              ))}
                              {allReasons.length > 2 && <span className="text-[10px] text-slate-500 font-bold self-center">+{allReasons.length - 2}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold text-slate-700 truncate pr-2">
                              {rootEv.source === 'widget' ? 'Core Script' : rootEv.source === 'vuotlink' ? 'Vượt Link' : rootEv.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                              {mob ? <><Smartphone size={14} className="text-slate-400" /> Mobile</> : <><Monitor size={14} className="text-slate-400" /> Desktop</>}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500 text-xs">{rootEv.ip_address}</td>
                          <td className="px-4 py-3 font-mono text-slate-400 text-xs max-w-[120px] truncate">
                            {rootEv.visitor_id ? rootEv.visitor_id.substring(0, 16) + '...' : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setEventModal(evGroup)} className="opacity-100 lg:opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded bg-slate-100 text-slate-600 font-semibold text-xs hover:bg-slate-200 transition-all lg:translate-x-2 group-hover:translate-x-0 outline-none">
                              Hiển thị
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 border-t border-slate-100">
              <Pager page={eventPage} total={eventTotal} limit={LIMIT} onChange={setEventPage} />
            </div>
          </div>
        </div>
      )}

      {/* IPs Tab */}
      {tab === 'ips' && (() => {
        const filtered = allIps.filter(row => {
          if (typeof row === 'string') return ipFilter === 'all';
          if (ipFilter === 'shared') return !!row.shared;
          if (ipFilter === 'many') return row.completed > 20;
          if (ipFilter === 'bot') return row.bots > 0;
          return true;
        });
        const totalIpPages = Math.max(1, Math.ceil(filtered.length / IP_PER_PAGE));
        const pageIps = filtered.slice((ipPage - 1) * IP_PER_PAGE, ipPage * IP_PER_PAGE);
        const chips = [
          { k: 'all', l: 'Tất cả IP', n: allIps.length },
          { k: 'shared', l: 'Phát hiện dùng chung', n: allIps.filter(r => r.shared).length },
          { k: 'many', l: 'Tần suất cao (>20)', n: allIps.filter(r => r.completed > 20).length },
          { k: 'bot', l: 'Có gắn cờ Bot', n: allIps.filter(r => r.bots > 0).length },
        ];
        return (
          <div className="space-y-4">
            {ipsLoaded && allIps.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {chips.map(ch => (
                  <button key={ch.k} onClick={() => { setIpFilter(ch.k); setIpPage(1); setSelectedIp(null); setIpDetail(null); }}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${ipFilter === ch.k ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {ch.l}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ipFilter === ch.k ? 'bg-slate-700' : 'bg-slate-100 text-slate-500'}`}>{ch.n}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              {!ipsLoaded && allIps.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="flex items-center gap-2 text-slate-500">
                    <RefreshCw size={16} className="animate-spin text-slate-400" />
                    <span className="text-sm">Đang tải biểu dữ liệu IP...</span>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Globe size={40} className="mb-3 opacity-20" />
                  <p className="text-sm font-semibold">Không có địa chỉ IP nào phù hợp bộ lọc</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {['Địa chỉ IP', 'Lượt phân phối', 'Pass Rate', 'Lỗi Bot', 'Nhãn Hệ Thống', 'Tín hiệu cuối', ''].map((h, i) => (
                            <th key={i} className={`px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs ${i === 0 || i === 5 ? 'text-left' : 'text-center'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pageIps.map(row => {
                          const ip = typeof row === 'string' ? row : row.ip;
                          const total = row.total || 0;
                          const completed = row.completed || 0;
                          const bots = row.bots || 0;
                          const shared = row.shared || null;
                          const isExp = selectedIp === ip;
                          const danger = shared || bots > 0;

                          return (
                            <React.Fragment key={ip}>
                              <tr onClick={() => loadIp(ip)}
                                className={`cursor-pointer transition-colors ${danger ? 'bg-red-50/50' : ''} ${isExp ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold">
                                  {ip}
                                </td>
                                <td className="px-4 py-3 text-center text-xs text-slate-700">{total || '—'}</td>
                                <td className="px-4 py-3 text-center">
                                  {completed > 0
                                    ? <span className={`font-semibold text-xs ${completed > 20 ? 'text-amber-600' : 'text-emerald-600'}`}>{completed}</span>
                                    : <span className="text-slate-300">0</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {bots > 0
                                    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">{bots}</span>
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex gap-1.5 justify-center flex-wrap">
                                    {shared && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 flex items-center gap-1">Dùng chung ({shared.worker_count})</span>}
                                    {completed > 20 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">Nhiều task</span>}
                                    {!shared && completed <= 20 && bots === 0 && <span className="text-slate-300 text-[10px]">—</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                                  {row.last_seen ? ago(row.last_seen) : '—'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {ipLoading && isExp
                                    ? <span className="text-slate-400 text-xs">Đang tải...</span>
                                    : <button className="p-1.5 rounded text-slate-400">
                                      <ChevronRight size={16} className={`transition-transform duration-200 ${isExp ? 'rotate-90 text-slate-800' : 'group-hover:text-slate-800'}`} />
                                    </button>}
                                </td>
                              </tr>

                              {/* IP Drilldown Row */}
                              {isExp && (
                                <tr>
                                  <td colSpan={7} className="px-0 py-0 border-0 bg-slate-50/50">
                                    <div className="animate-in slide-in-from-top-2 fade-in duration-300 overflow-hidden">
                                      <div className="p-6 border-b border-slate-200">
                                        {ipLoading ? (
                                          <div className="flex justify-center py-8">
                                            <div className="flex flex-col items-center gap-3">
                                              <div className="w-6 h-6 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
                                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đang phân tích mạng...</span>
                                            </div>
                                          </div>
                                        ) : ipDetail ? (
                                          <div className="space-y-4 max-w-5xl mx-auto">
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black border shadow-sm tracking-wider ${ipDetail.riskLevel === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' : ipDetail.riskLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                RISK SCORE: {ipDetail.riskScore}/100
                                              </span>
                                              {(ipDetail.risks || []).map((r, i) => (
                                                <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${r.severity === 'high' ? 'bg-rose-50 border-rose-100 text-rose-700' : r.severity === 'medium' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>{r.label}</span>
                                              ))}
                                              {shared && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500 text-white shadow-sm shadow-rose-200 flex items-center gap-1.5"><AlertTriangle size={12} /> CHÚ Ý: {shared.worker_names} cùng chung mạng</span>}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {/* GEO Card */}
                                              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Search size={12} /> Định vị Mạng lưới</p>
                                                {ipDetail.geo ? (
                                                  <div className="space-y-2.5 text-[12px]">
                                                    {[['Quốc gia', ipDetail.geo.country], ['Khu vực', [ipDetail.geo.city, ipDetail.geo.region].filter(Boolean).join(', ')], ['Nhà cung cấp', ipDetail.geo.isp]]
                                                      .map(([k, v]) => v && (
                                                        <div key={k} className="flex justify-between items-center bg-slate-50 pb-2 border-b border-slate-100 last:border-0 last:pb-0 pt-1 px-1">
                                                          <span className="text-slate-500 font-medium">{k}</span>
                                                          <span className="font-bold text-slate-800 text-right max-w-[60%] truncate">{v}</span>
                                                        </div>
                                                      ))}
                                                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                                      {ipDetail.geo.proxy && <span className="px-2 py-1 rounded shadow-sm text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">VPN / PROXY</span>}
                                                      {ipDetail.geo.hosting && <span className="px-2 py-1 rounded shadow-sm text-[10px] font-black bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200">DATACENTER</span>}
                                                      {ipDetail.geo.mobile && <span className="px-2 py-1 rounded shadow-sm text-[10px] font-black bg-sky-50 text-sky-600 border border-sky-200">MOBILE NET</span>}
                                                      {!ipDetail.geo.proxy && !ipDetail.geo.hosting && <span className="px-2 py-1 rounded shadow-sm text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200">RESIDENTIAL</span>}
                                                    </div>
                                                  </div>
                                                ) : <p className="text-[12px] text-slate-400 italic">Máy chủ ngoại tuyến hoặc không có dữ liệu truy vấn.</p>}
                                              </div>

                                              {/* Shared Workers Card */}
                                              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Accounts Liên Quan ({(ipDetail.workers || []).length})</p>
                                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                                  {(ipDetail.workers || []).map(w => (
                                                    <div key={w.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                                                      <div className="min-w-0 pr-3">
                                                        <p className="text-[12px] font-black text-slate-800 truncate">{w.name || 'Anonymous'}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium truncate">{w.email}</p>
                                                      </div>
                                                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                        <span className="px-2 py-0.5 bg-white shadow-sm border border-slate-200 rounded text-[10px] font-bold text-slate-600">{w.task_count} jobs</span>
                                                        {w.status === 'banned' && <span className="text-[9px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded">BAN</span>}
                                                      </div>
                                                    </div>
                                                  ))}
                                                  {!(ipDetail.workers || []).length && (
                                                    <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-slate-100 rounded-xl">
                                                      <p className="text-[11px] text-slate-400 font-bold">Chỉ có 1 tài khoản duy nhất</p>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center py-8 text-rose-400">
                                            <Shield size={24} className="mb-2 opacity-50" />
                                            <p className="text-xs font-bold">Hệ thống Firewall từ chối truy vấn IP này.</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalIpPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 bg-slate-50/50 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400">{filtered.length} BẢN GHI ĐƯỢC THEO DÕI</span>
                      <div className="flex items-center gap-1.5">
                        <button disabled={ipPage === 1} onClick={() => { setIpPage(p => p - 1); setSelectedIp(null); }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 disabled:opacity-40 transition-all text-slate-600"><ChevronLeft size={16} /></button>
                        {Array.from({ length: Math.min(totalIpPages, 5) }, (_, i) => {
                          const p = totalIpPages <= 5 ? i + 1 : ipPage <= 3 ? i + 1 : ipPage >= totalIpPages - 2 ? totalIpPages - 4 + i : ipPage - 2 + i;
                          return (
                            <button key={p} onClick={() => { setIpPage(p); setSelectedIp(null); }}
                              className={`w-8 h-8 rounded-xl text-[12px] font-black transition-all ${ipPage === p ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-white border border-slate-200 shadow-sm hover:border-slate-300 text-slate-600'}`}>
                              {p}
                            </button>
                          );
                        })}
                        <button disabled={ipPage === totalIpPages} onClick={() => { setIpPage(p => p + 1); setSelectedIp(null); }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 disabled:opacity-40 transition-all text-slate-600"><ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {modal && <TaskModal task={modal} onClose={() => setModal(null)} />}
      {eventModal && <EventModal event={eventModal} onClose={() => setEventModal(null)} />}
    </div>
  );
}



/* ═══════════════════ MAIN PAGE ═══════════════════ */
export default function AdminSecurity() {
  usePageTitle('Admin - Anti Cheat');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [sort, setSort] = useState('ok');
  const _todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [dateFrom, setDateFrom] = useState(_todayVN);
  const [dateTo, setDateTo] = useState(_todayVN);
  const [activePreset, setActivePreset] = useState(1);
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

  // Dùng local date (VN timezone) tránh lệch múi giờ UTC
  const localDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const setPreset = (days) => {
    setActivePreset(days);
    if (days === 0) {
      setDateFrom(''); setDateTo('');
    } else if (days === 1) {
      const today = localDate(new Date());
      setDateFrom(today); setDateTo(today);
    } else {
      const now = new Date();
      const from = new Date(now); from.setDate(now.getDate() - days + 1);
      setDateFrom(localDate(from)); setDateTo(localDate(now));
    }
    setPage(1);
  };

  if (detail) return <UserDetail user={detail} dateFrom={dateFrom} dateTo={dateTo} onBack={() => { setDetail(null); load(); }} />;

  return (
    <div className="space-y-6 w-full">
      {/* Header & Global Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="text-indigo-600" size={24} />
            Hệ thống Anti-Cheat
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Giám sát {total} người dùng</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border border-indigo-100 shadow-sm rounded-xl text-sm font-semibold hover:from-indigo-100 hover:to-violet-100 hover:shadow disabled:opacity-50 transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Đang phân tích...' : 'Cập nhật DL'}
          </button>
          <button onClick={async () => {
            if (!confirm('Xóa toàn bộ dữ liệu Anti-Cheat?\n(security_logs + bot_detected + security_detail)')) return;
            if (!confirm('XÁC NHẬN LẦN 2: Hành động này không thể hoàn tác!')) return;
            try {
              await api.delete('/admin/security/clear-all');
              alert('Đã xóa toàn bộ dữ liệu anti-cheat!');
              load();
            } catch (e) { alert('Lỗi: ' + (e.message || 'Không xóa được')); }
          }} className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 shadow-sm rounded-lg text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
            Xóa Dữ Liệu
          </button>
        </div>
      </div>

      {/* Date filters & Search Controller */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4 flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-md">
            {[['Hôm nay', 1], ['7 Ngày', 7], ['30 Ngày', 30], ['Tất cả', 0]].map(([l, d]) => (
              <button key={l} onClick={() => setPreset(d)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${activePreset === d ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mx-1 px-3 py-1.5 bg-slate-50 rounded-md border border-slate-200">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-transparent text-xs text-slate-700 focus:outline-none" />
            <span className="text-slate-400">→</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="bg-transparent text-xs text-slate-700 focus:outline-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Tìm dữ liệu (Tên, Email, IP)..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-slate-400 transition-colors placeholder:text-slate-400" />
          </div>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:border-slate-400 cursor-pointer transition-colors appearance-none pr-8 relative">
            <option value="ok">Sắp xếp theo: Số Lượt Vượt</option>
            <option value="blocked">Sắp xếp theo: Cảnh báo Bot</option>
            <option value="earned">Sắp xếp theo: Thu nhập</option>
            <option value="total">Sắp xếp theo: Tổng Lượt</option>
            <option value="last_at">Sắp xếp theo: Mới nhất</option>
          </select>
        </div>
      </div>

      {/* ── USERS LIST ── */}
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent"></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {['Thông tin User', 'Tỉ Lệ', 'Chi tiết', 'Truy vết IP', 'Tương tác', ''].map((h, i) => (
                  <th key={i} className={`px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs ${i === 0 || i === 3 ? 'text-left' : 'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <RefreshCw size={16} className="animate-spin text-slate-400" />
                      <p className="text-sm font-medium">Đang tải dữ liệu người dùng...</p>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Search size={32} className="opacity-30 mb-3" />
                      <p className="text-sm font-medium">Chưa tìm thấy dữ liệu gian lận nào phù hợp</p>
                    </div>
                  </td>
                </tr>
              ) : users.map(u => {
                const total = u.total || 0;
                const ok = u.ok || 0;
                const events = u.events || 0;
                const dangerLvl = events > 10 ? 'high' : events > 0 ? 'medium' : 'safe';

                return (
                  <tr key={u.id} className={`group transition-all duration-300 ${dangerLvl === 'high' ? 'bg-rose-50/30 hover:bg-rose-50/80' : 'hover:bg-slate-50 hover:shadow-[0_0_15px_rgba(0,0,0,0.03)] relative z-0 hover:z-10'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-violet-100 to-indigo-100 text-indigo-700 border-2 border-white shadow-sm shadow-indigo-100">
                              {(u.name || u.email || '?')[0].toUpperCase()}
                            </div>
                          )}
                          {u.status === 'banned' && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-600 rounded-full border border-white"></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate text-sm flex items-center gap-1.5">
                            {u.name || 'Ẩn Danh'}
                            {u.status === 'banned' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">ĐÃ CẤM</span>}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1.5 w-full max-w-[140px] mx-auto">
                        <div className="w-full flex justify-between text-[11px] font-bold">
                          <span className="text-emerald-500 drop-shadow-sm">{ok}</span>
                          <span className="text-slate-300">{total - ok - events}</span>
                          <span className="text-rose-500 drop-shadow-sm">{events}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                          <div style={{ width: `${total ? (ok / total) * 100 : 0}%` }} className="bg-emerald-400 h-full shadow-[0_0_8px_rgba(52,211,153,0.8)] relative"></div>
                          <div style={{ width: `${total ? ((total - ok - events) / total) * 100 : 0}%` }} className="bg-slate-200 h-full"></div>
                          <div style={{ width: `${total ? (events / total) * 100 : 0}%` }} className="bg-rose-400 h-full shadow-[0_0_8px_rgba(251,113,133,0.8)] relative"></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <span className="text-xs font-bold text-slate-700">{total} <span className="text-[10px] text-slate-400 font-semibold leading-none">LƯỢT</span></span>
                        {(events > 0) ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 mt-1 border border-red-200 flex items-center gap-1">
                            <Activity size={10} /> {events} LỖI
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1"><CheckCircle size={10} className="text-slate-300"/> An Toàn</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {u.ips.slice(0, 2).map((ip, j) => (
                          <span key={j} className="font-mono text-xs text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            {ip}
                          </span>
                        ))}
                        {u.ips.length > 2 && (
                          <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                            +{u.ips.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {ago(u.last_at)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDetail(u)}
                        className="opacity-100 lg:opacity-0 group-hover:opacity-100 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all ml-auto lg:translate-x-4 group-hover:translate-x-0 flex items-center gap-1.5 focus:outline-none">
                        <Eye size={14} /> Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 border-t border-slate-200">
          <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}