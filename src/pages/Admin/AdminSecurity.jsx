import React, { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Shield, Search, RefreshCw, X, Eye, Copy,
  ChevronLeft, ChevronRight, ArrowLeft, Bot, AlertTriangle, CheckCircle,
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
  // V2 new detection types
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
  // Widget bot detection
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

/* ─── Task Detail Modal ─── */
function TaskModal({ task: t, onClose }) {
  if (!t) return null;
  let sd = {};
  try { sd = typeof t.security_detail === 'string' ? JSON.parse(t.security_detail || '{}') : (t.security_detail || {}); } catch { }
  const dl = sd.detectionLog || [];
  const mobile = isMobileUA(t.user_agent);
  const st = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600' };

  // Bot flags — bao gồm cả widget_bot
  const botFlags = [];
  if (sd.botDetected || t.bot_detected) botFlags.push({ k: 'Bot phát hiện', bad: true });
  if (sd.widget_bot) botFlags.push({ k: 'Widget Bot', bad: true });
  const allDl = [...(dl || []), ...(sd.widget_detection_log || [])];
  [...new Set(allDl)].forEach(d => botFlags.push({ k: DL_VI[d] || d, bad: true }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 rounded-t-2xl flex items-center justify-between ${t.bot_detected ? 'bg-red-50' : t.status === 'completed' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-800">Task #{t.id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.c}`}>{st.l}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mobile ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                {mobile ? 'Mobile' : 'Desktop'}
              </span>
              {t.bot_detected && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1"><Bot size={9} />BOT</span>}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{fmt(t.created_at)} · {t.ip_address}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60"><X size={16} className="text-slate-500" /></button>
        </div>

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
              ['Thời gian', t.time_on_site ? `${t.time_on_site}s` : '—'],
            ].map(([k, v, copyable]) => (
              <div key={k} className="flex justify-between gap-2 items-center">
                <span className="text-slate-400 shrink-0">{k}</span>
                <div className="flex items-center gap-1 min-w-0 max-w-[65%]">
                  <span className="font-semibold text-slate-700 text-right truncate">{v || '—'}</span>
                  {copyable && v && v !== '—' && <CopyBtn text={v} />}
                </div>
              </div>
            ))}
          </div>

          {/* User Agent */}
          {t.user_agent && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">User Agent</p>
              <div className="bg-slate-50 rounded-xl p-2.5 font-mono text-[10px] text-slate-600 break-all leading-relaxed">{t.user_agent}</div>
            </div>
          )}

          {/* Bot detection result */}
          {botFlags.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase mb-1.5">🚨 Phát hiện Bot</p>
              <div className="space-y-1">
                {botFlags.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                    <Bot size={12} className="text-red-500 shrink-0" />
                    <span className="font-bold text-red-700 text-xs">{f.k}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle size={14} className="text-emerald-500" />
              <span className="text-emerald-700 font-bold text-xs">Không phát hiện bot</span>
            </div>
          )}

          {/* CreepJS Fingerprint Summary */}
          {(sd.creepSummary || sd.canvasHash || sd.reasons?.length > 0) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Fingerprint Analysis</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                {sd.creepSummary && (
                  <>
                    {sd.creepSummary.totalLies > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">API Lies</span>
                        <span className={`font-bold ${sd.creepSummary.totalLies >= 5 ? 'text-red-600' : 'text-amber-600'}`}>
                          {sd.creepSummary.totalLies} lies
                          {sd.creepSummary.canvasLied && ' · Canvas✗'}
                          {sd.creepSummary.audioLied && ' · Audio✗'}
                        </span>
                      </div>
                    )}
                    {sd.creepSummary.webglRenderer && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400 shrink-0">WebGL</span>
                        <span className="font-mono text-[10px] text-slate-600 truncate max-w-[55%]">{sd.creepSummary.webglRenderer}</span>
                      </div>
                    )}
                  </>
                )}
                {sd.canvasHash && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400 shrink-0">Canvas Hash</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-slate-600 truncate max-w-[140px]">{sd.canvasHash}</span>
                      <CopyBtn text={sd.canvasHash} />
                    </div>
                  </div>
                )}
                {sd.audioHash && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400 shrink-0">Audio Hash</span>
                    <span className="font-mono text-[10px] text-slate-600 truncate max-w-[55%]">{sd.audioHash}</span>
                  </div>
                )}
                {sd.canvas?.noisy === true && (
                  <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-red-50 rounded-lg border border-red-100">
                    <Bot size={10} className="text-red-500" />
                    <span className="text-red-700 font-bold text-[10px]">Canvas Noise detected (Anti-detect browser)</span>
                  </div>
                )}
                {sd.reasons && sd.reasons.length > 0 && (
                  <div className="mt-1.5">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Detection Reasons</p>
                    <div className="flex flex-wrap gap-1">
                      {sd.reasons.map((r, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-50 text-amber-700 border border-amber-100">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
  try { det = typeof ev.details === 'string' ? JSON.parse(ev.details || '{}') : (ev.details || {}); } catch { }
  const mobile = isMobileUA(ev.user_agent);
  const dl = det.detectionLog || [];

  // Build check flags from available data only
  const flags = [];
  if (det.bot === true) flags.push('Fingerprint Bot');
  if (det.webdriver) flags.push('Webdriver');
  if (det.selenium) flags.push('Selenium');
  if (det.cdc) flags.push('CDP');
  dl.forEach(d => { if (!flags.includes(DL_VI[d] || d)) flags.push(DL_VI[d] || d); });
  if (det.count > 0) flags.push(`Rate limit ×${det.count}`);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 rounded-t-2xl flex items-center justify-between bg-amber-50">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-800">Sự kiện #{ev.id}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{REASON_VI[ev.reason] || ev.reason}</span>
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

        <div className="overflow-y-auto flex-1 p-5 space-y-4 text-xs">
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            {[
              ['IP', ev.ip_address || '—', true],
              ['Visitor ID', ev.visitor_id || '—', true],
              ['Lý do', ev.reason],
              ['Nguồn', ev.source],
            ].map(([k, v, copyable]) => (
              <div key={k} className="flex justify-between gap-2 items-center">
                <span className="text-slate-400 shrink-0">{k}</span>
                <div className="flex items-center gap-1 min-w-0 max-w-[65%]">
                  <span className="font-semibold text-slate-700 text-right truncate">{v || '—'}</span>
                  {copyable && v && v !== '—' && <CopyBtn text={v} />}
                </div>
              </div>
            ))}
          </div>

          {ev.user_agent && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">User Agent</p>
              <div className="bg-slate-50 rounded-xl p-2.5 font-mono text-[10px] text-slate-600 break-all leading-relaxed">{ev.user_agent}</div>
            </div>
          )}

          {flags.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase mb-1.5">🚨 Flags phát hiện</p>
              <div className="flex flex-wrap gap-1.5">
                {flags.map((f, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 flex items-center gap-1">
                    <Bot size={9} />{f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {det.reasons && det.reasons.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-amber-500 uppercase mb-1.5">Lý do phát hiện chi tiết</p>
              <div className="space-y-1.5">
                {det.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                    <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-amber-800 text-[11px] font-medium leading-snug">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lịch sử tất cả lần xuất hiện */}
          {ev.occurrences && ev.occurrences.length > 1 && (
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase mb-1.5">
                🔁 Lịch sử xuất hiện ({ev.occurrences.length} lần)
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {ev.occurrences.map((occ, i) => {
                  let occDet = {};
                  try { occDet = typeof occ.details === 'string' ? JSON.parse(occ.details || '{}') : (occ.details || {}); } catch {}
                  const occReasons = occDet.reasons?.length > 0 ? occDet.reasons : (occDet.detectionLog || []);
                  return (
                    <div key={i} className="px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-red-700">#{i + 1} · {fmt(occ.created_at)}</span>
                        {(occ.gateway_slug || occ.target_url) && (
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">
                            {occ.gateway_slug ? `g/${occ.gateway_slug}` : (occ.target_url || '').slice(0, 30)}
                          </span>
                        )}
                      </div>
                      {occReasons.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {occReasons.map((r, j) => (
                            <span key={j} className="text-[9px] font-mono bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 leading-tight">
                              ↳ {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Điểm rủi ro */}
          {det.deviceScore != null && (
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Điểm bot</span>
              <span className={`text-sm font-black ${det.deviceScore >= 80 ? 'text-red-600' : det.deviceScore >= 40 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                {det.deviceScore}/100
                {det.deviceType && <span className="text-[10px] font-normal text-slate-400 ml-1">({det.deviceType})</span>}
              </span>
            </div>
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
      api.get(`/admin/security/user/${u.id}/events?page=${eventPage}&limit=${LIMIT}`)
        .then(d => { setEvents(d.events || []); setEventTotal(d.total || 0); })
        .catch(console.error).finally(() => setEventsLoading(false));
    }
  }, [tab, u.id, eventPage]);

  const exportEvents = async () => {
    if (!confirm('Xuất toàn bộ bot events của user này ra file CSV?')) return;
    try {
      setEventsLoading(true);
      const d = await api.get(`/admin/security/user/${u.id}/events?page=1&limit=10000`);
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
        } catch(e){}
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
          <p className="text-xs text-slate-500">{u.email} · {taskTotal} tasks</p>
        </div>
        <button onClick={toggleBan}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${banned ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'}`}>
          {banned ? 'Mở ban' : 'Ban'}
        </button>
        <button onClick={async () => {
          if (!confirm(`Xóa ${u.name || u.email}?\nTất cả dữ liệu sẽ bị xóa vĩnh viễn.`)) return;
          if (!confirm('XÁC NHẬN: Hành động KHÔNG THỂ HOÀN TÁC. Tiếp tục?')) return;
          try { await api.delete(`/admin/users/${u.id}`); alert('Đã xóa user'); onBack(); }
          catch (e) { alert('Lỗi: ' + e.message); }
        }} className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition">Xóa</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          ['Tổng', u.total, 'text-slate-800'],
          ['Hoàn thành', u.ok, 'text-emerald-600'],
          ['Bot', u.blocked + (u.events || 0), 'text-red-600'],
          ['Thu nhập', money(u.earned), 'text-emerald-600'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase">{l}</p>
            <p className={`text-lg font-black ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['tasks', `Tasks (${taskTotal})`], ['events', `Bot events (${eventTotal})`], ['ips', `IPs (${allIps.length}${!ipsLoaded && allIps.length >= 5 ? '+' : ''})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${tab === k ? 'bg-violet-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap items-center bg-white border border-slate-200 rounded-xl px-3 py-2">
            {[
              { key: 'ip', placeholder: 'Lọc theo IP...', icon: '🌐' },
              { key: 'visitorId', placeholder: 'Lọc theo Visitor ID...', icon: '🔑' },
              { key: 'slug', placeholder: 'Lọc theo slug link...', icon: '🔗' },
            ].map(({ key, placeholder, icon }) => (
              <div key={key} className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                <span className="text-[11px]">{icon}</span>
                <input
                  value={taskFilterInput[key]}
                  onChange={e => setTaskFilterInput(f => ({ ...f, [key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { setTaskFilter({ ...taskFilterInput, [key]: taskFilterInput[key] }); setTaskPage(1); } }}
                  placeholder={placeholder}
                  className="flex-1 text-[11px] outline-none bg-transparent text-slate-700 placeholder-slate-300"
                />
                {taskFilterInput[key] && (
                  <button onClick={() => { const f = { ...taskFilterInput, [key]: '' }; setTaskFilterInput(f); setTaskFilter(f); setTaskPage(1); }}
                    className="text-slate-300 hover:text-slate-500 text-xs">✕</button>
                )}
              </div>
            ))}
            <button onClick={() => { setTaskFilter(taskFilterInput); setTaskPage(1); }}
              className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 shrink-0">
              Lọc
            </button>
            {(taskFilter.ip || taskFilter.visitorId || taskFilter.slug) && (
              <button onClick={() => { const empty = { ip: '', visitorId: '', slug: '' }; setTaskFilter(empty); setTaskFilterInput(empty); setTaskPage(1); }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold hover:bg-slate-200 shrink-0">
                Xóa lọc
              </button>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Thời gian', 'Nguồn', 'Trạng thái', 'IP', 'Keyword', 'Earning', 'Bot', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                  ) : tasks.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Không có task{(taskFilter.ip || taskFilter.visitorId || taskFilter.slug) ? ' (không khớp bộ lọc)' : ''}</td></tr>
                  ) : tasks.map(t => {
                    const s = ST[t.status] || { l: t.status, c: 'bg-slate-100 text-slate-600' };
                    return (
                      <tr key={t.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${t.bot_detected ? 'bg-red-50/30' : ''}`}>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmt(t.created_at)}</td>
                        <td className="px-3 py-2.5">
                          {t.worker_link_id
                            ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">GW{t.gateway_slug ? ` /${t.gateway_slug}` : ''}</span>
                            : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">VL</span>}
                        </td>
                        <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.c}`}>{s.l}</span></td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 text-[10px]">{t.ip_address}</td>
                        <td className="px-3 py-2.5 text-slate-700 max-w-[120px] truncate">{t.keyword || '—'}</td>
                        <td className="px-3 py-2.5 font-bold text-emerald-700">{t.earning ? money(t.earning) : '—'}</td>
                        <td className="px-3 py-2.5">
                          {t.bot_detected
                            ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1 w-fit"><Bot size={9} />BOT</span>
                            : t.status === 'completed'
                              ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">✓</span>
                              : <span className="text-slate-300">—</span>}
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
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={exportEvents} disabled={eventsLoading} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-[11px] font-bold rounded-lg transition shadow-sm disabled:opacity-50">
              📥 Xuất CSV
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Thời gian', 'Lý do', 'Nguồn', 'Thiết bị', 'IP', 'Visitor ID', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventsLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                ) : events.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">Không có cảnh báo</td></tr>
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
                    // Lấy event gốc
                    const rootEv = evGroup.occurrences[0];
                    const mob = isMobileUA(rootEv.user_agent);
                    const isGroup = evGroup.occurrences.length > 1;

                    // Tổng hợp lý do chung
                    const allReasons = [];
                    const allSubReasons = [];
                    evGroup.occurrences.forEach(occ => {
                      if (!allReasons.includes(occ.reason)) allReasons.push(occ.reason);
                      let det = {};
                      try { det = typeof occ.details === 'string' ? JSON.parse(occ.details || '{}') : (occ.details || {}); } catch { }
                      const sr = (det.reasons && det.reasons.length > 0) ? det.reasons : (det.detectionLog || []);
                      sr.forEach(r => { if (!allSubReasons.includes(r)) allSubReasons.push(r); });
                    });

                    return (
                      <tr key={rootEv.id || `${rootEv.created_at}_${idx}`} className="border-b border-slate-100 bg-red-50/20 hover:bg-red-50/40">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-slate-500">{fmt(rootEv.created_at)}</span>
                          {(rootEv.count > 1 || isGroup) && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500 text-white">
                              {isGroup ? `×${evGroup.occurrences.length}` : `×${rootEv.count}`}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {allReasons.slice(0, 2).map((r, ri) => (
                              <span key={ri} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 block w-fit">{r}</span>
                            ))}
                            {allReasons.length > 2 && <span className="text-[9px] text-slate-400">+{allReasons.length - 2}</span>}
                          </div>
                          {allSubReasons.slice(0, 2).map((r, i) => (
                            <span key={i} className="block text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 mb-0.5 leading-tight truncate max-w-full">
                              ↳ {r}
                            </span>
                          ))}
                          {allSubReasons.length > 2 && (
                            <span className="text-[9px] text-slate-400">+{allSubReasons.length - 2} lý do khác...</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rootEv.source === 'widget' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {rootEv.source === 'widget' ? 'Script' : rootEv.source === 'vuotlink' ? 'VL' : rootEv.source}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mob ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                            {mob ? 'Mobile' : 'Desktop'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 text-[10px]">{rootEv.ip_address}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500 text-[10px] max-w-[80px] truncate">
                          {rootEv.visitor_id ? rootEv.visitor_id.substring(0, 12) + '...' : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => setEventModal(evGroup)} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold">
                            <Eye size={11} className="inline mr-0.5" />Xem
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          <Pager page={eventPage} total={eventTotal} limit={LIMIT} onChange={setEventPage} />
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
          { k: 'all', l: 'Tất cả', n: allIps.length },
          { k: 'shared', l: 'Dùng chung', n: allIps.filter(r => r.shared).length },
          { k: 'many', l: 'Nhiều task', n: allIps.filter(r => r.completed > 20).length },
          { k: 'bot', l: 'Có bot', n: allIps.filter(r => r.bots > 0).length },
        ];
        return (
          <div className="space-y-3">
            {ipsLoaded && allIps.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {chips.map(ch => (
                  <button key={ch.k} onClick={() => { setIpFilter(ch.k); setIpPage(1); setSelectedIp(null); setIpDetail(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${ipFilter === ch.k ? 'bg-violet-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {ch.l}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${ipFilter === ch.k ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{ch.n}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {!ipsLoaded && allIps.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Không có IP nào phù hợp</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {['IP', 'Tasks', 'Hoàn thành', 'Bot', 'Cảnh báo', 'Hoạt động', ''].map(h => (
                            <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px] ${h === 'IP' || h === 'Hoạt động' ? 'text-left' : 'text-center'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
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
                                className={`border-b cursor-pointer ${danger ? 'bg-red-50/20 border-red-100' : 'border-slate-100'} ${isExp ? 'bg-violet-50/40' : 'hover:bg-slate-50/50'}`}>
                                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 font-bold">
                                  <span className="underline decoration-dotted">{ip}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-slate-700">{total || '—'}</td>
                                <td className="px-3 py-2.5 text-center">
                                  {completed > 0
                                    ? <span className={`font-bold ${completed > 20 ? 'text-amber-600' : 'text-emerald-600'}`}>{completed}</span>
                                    : <span className="text-slate-300">0</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {bots > 0
                                    ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{bots}</span>
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex gap-1 justify-center flex-wrap">
                                    {shared && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">Dùng chung ({shared.worker_count})</span>}
                                    {completed > 20 && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">Nhiều task</span>}
                                    {!shared && completed <= 20 && bots === 0 && <span className="text-slate-300 text-[9px]">—</span>}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap text-[10px]">
                                  {row.last_seen ? ago(row.last_seen) : '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                  {ipLoading && isExp
                                    ? <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto" />
                                    : <ChevronRight size={12} className={`text-slate-400 mx-auto transition-transform ${isExp ? 'rotate-90' : ''}`} />}
                                </td>
                              </tr>
                              {isExp && (
                                <tr>
                                  <td colSpan={7} className="px-4 py-4 bg-slate-50/80 border-b border-slate-200">
                                    {ipLoading ? (
                                      <div className="flex justify-center py-4">
                                        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                      </div>
                                    ) : ipDetail ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ipDetail.riskLevel === 'high' ? 'bg-red-100 text-red-700' : ipDetail.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            Risk: {ipDetail.riskScore}/100 · {ipDetail.riskLevel === 'high' ? 'Cao' : ipDetail.riskLevel === 'medium' ? 'Trung bình' : 'Thấp'}
                                          </span>
                                          {(ipDetail.risks || []).map((r, i) => (
                                            <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.severity === 'high' ? 'bg-red-50 text-red-700' : r.severity === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{r.label}</span>
                                          ))}
                                          {shared && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">⚠ Dùng chung: {shared.worker_names}</span>}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div className="bg-white rounded-xl border border-slate-200 p-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Thông tin IP</p>
                                            {ipDetail.geo ? (
                                              <div className="space-y-1.5 text-[10px]">
                                                {[['Quốc gia', ipDetail.geo.country], ['Thành phố', [ipDetail.geo.city, ipDetail.geo.region].filter(Boolean).join(', ')], ['ISP', ipDetail.geo.isp]]
                                                  .map(([k, v]) => v && (
                                                    <div key={k} className="flex justify-between">
                                                      <span className="text-slate-400">{k}</span>
                                                      <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">{v}</span>
                                                    </div>
                                                  ))}
                                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                                  {ipDetail.geo.proxy && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">VPN/Proxy</span>}
                                                  {ipDetail.geo.hosting && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">Datacenter</span>}
                                                  {ipDetail.geo.mobile && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-100 text-cyan-700">Mobile</span>}
                                                  {!ipDetail.geo.proxy && !ipDetail.geo.hosting && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">Residential</span>}
                                                </div>
                                              </div>
                                            ) : <p className="text-[10px] text-slate-400">Không có dữ liệu</p>}
                                          </div>
                                          <div className="bg-white rounded-xl border border-slate-200 p-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Workers dùng IP này ({(ipDetail.workers || []).length})</p>
                                            {(ipDetail.workers || []).map(w => (
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
                                            {!(ipDetail.workers || []).length && <p className="text-[10px] text-slate-400">Chỉ user này</p>}
                                          </div>
                                        </div>
                                      </div>
                                    ) : <p className="text-xs text-slate-400 text-center py-2">Không tải được dữ liệu IP</p>}
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
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400">{filtered.length} IP · trang {ipPage}/{totalIpPages}</span>
                      <div className="flex gap-1">
                        <button disabled={ipPage === 1} onClick={() => { setIpPage(p => p - 1); setSelectedIp(null); }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40">‹</button>
                        {Array.from({ length: Math.min(totalIpPages, 5) }, (_, i) => {
                          const p = totalIpPages <= 5 ? i + 1 : ipPage <= 3 ? i + 1 : ipPage >= totalIpPages - 2 ? totalIpPages - 4 + i : ipPage - 2 + i;
                          return (
                            <button key={p} onClick={() => { setIpPage(p); setSelectedIp(null); }}
                              className={`w-7 h-7 rounded-lg text-[11px] font-bold ${ipPage === p ? 'bg-violet-600 text-white' : 'border border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                              {p}
                            </button>
                          );
                        })}
                        <button disabled={ipPage === totalIpPages} onClick={() => { setIpPage(p => p + 1); setSelectedIp(null); }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40">›</button>
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState(0);
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

  if (detail) return <UserDetail user={detail} onBack={() => { setDetail(null); load(); }} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Shield size={20} className="text-violet-600" /> Anti Cheat
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} user · Fingerprint + Automation detection</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
          <button onClick={async () => {
            if (!confirm('Xóa toàn bộ dữ liệu Anti-Cheat?\n(security_logs + bot_detected + security_detail)')) return;
            if (!confirm('XÁC NHẬN LẦN 2: Hành động này không thể hoàn tác!')) return;
            try {
              await api.delete('/admin/security/clear-all');
              alert('Đã xóa toàn bộ dữ liệu anti-cheat!');
              load();
            } catch (e) { alert('Lỗi: ' + (e.message || 'Không xóa được')); }
          }} className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-100 transition">
            <AlertTriangle size={14} /> Xóa tất cả data
          </button>
        </div>

      </div>

      {/* Date filters & Search */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-white px-1 py-1 rounded-xl">
        <div className="flex items-center gap-2">
          {[['Hôm nay', 1], ['7 ngày', 7], ['30 ngày', 30], ['Tất cả', 0]].map(([l, d]) => (
            <button key={l} onClick={() => setPreset(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activePreset === d ? 'bg-violet-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
          <div className="flex items-center gap-1 mx-2">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400" />
          </div>
        </div>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white focus:outline-none shrink-0">
          <option value="ok">Hoàn thành ↓</option>
          <option value="blocked">Blocked ↓</option>
          <option value="earned">Thu nhập ↓</option>
          <option value="total">Tổng task ↓</option>
          <option value="last_at">Mới nhất ↓</option>
        </select>
      </div>

      {/* ── USERS LIST ── */}
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Tìm tên, email, ip, visitor_id..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['User', 'Tổng', 'OK', 'Bot', 'IP', 'Hoạt động', ''].map(h => (
                    <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 uppercase text-[10px] ${['User', 'IP', 'Hoạt động'].includes(h) ? 'text-left' : 'text-center'}`}>{h}</th>
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
                    <tr key={u.id} className={`border-b ${danger ? 'bg-red-50 border-red-100 hover:bg-red-50/70' : 'border-slate-100 hover:bg-slate-50/50'}`}>
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
                        {(u.blocked + (u.events || 0)) > 0
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1 w-fit mx-auto"><Bot size={9} />{u.blocked + (u.events || 0)}</span>
                          : <span className="text-slate-300">0</span>}
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
      </div>
    </div>
  );
}

