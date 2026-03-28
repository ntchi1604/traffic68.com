/**
 * LinkGateway — public page /vuot-link/:slug
 * Visitor must complete a vượt link task to access the destination URL
 * set by the worker who created this link.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, Globe, ShieldCheck, ShieldOff, ExternalLink, ArrowRight,
  AlertCircle, Loader2, WifiOff, Copy, Check, Lock, Unlock, RefreshCw, Clock,
} from 'lucide-react';

/* ─── CreepJS via iframe (chờ bắt buộc, không fallback) ─── */
let _creepResult = null;
let _creepVisitorId = 'unknown';
let _creepDone = false;
let _creepResolvers = [];

function _resolveCreep(result) {
  if (_creepDone) return;
  // Chỉ resolve khi có visitorId thật HOẶC đã retry hết
  _creepResult = result;
  _creepDone = true;
  _creepResolvers.forEach(r => r(result));
  _creepResolvers = [];
}

if (typeof window !== 'undefined') {
  // Lắng nghe message từ iframe
  window.addEventListener('message', function handler(e) {
    if (!e.data || e.data.type !== 'creep-result') return;
    const d = e.data.data;
    if (d) {
      if (d.visitorId && d.visitorId !== 'unknown') _creepVisitorId = d.visitorId;
      if (d.botDetection) _creepResult = d.botDetection;
    }
    window.removeEventListener('message', handler);
    if (_creepVisitorId && _creepVisitorId !== 'unknown') {
      _resolveCreep(d?.botDetection || { bot: false });
    }
  });

  let _retryCount = 0;
  const _loadCreepIframe = () => {
    const iframe = document.createElement('iframe');
    iframe.src = '/creep-frame.html';
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.onerror = () => {
      if (_retryCount < 3) {
        _retryCount++;
        setTimeout(_loadCreepIframe, 2000);
      } else {
        _resolveCreep({ bot: false, creepError: true });
      }
    };
    document.body.appendChild(iframe);

    // Timeout 30s → retry
    setTimeout(() => {
      if (!_creepDone && (!_creepVisitorId || _creepVisitorId === 'unknown')) {
        if (_retryCount < 3) {
          _retryCount++;
          _loadCreepIframe();
        } else {
          _resolveCreep({ bot: false, creepTimeout: true });
        }
      }
    }, 30000);
  };

  if (document.body) _loadCreepIframe();
  else document.addEventListener('DOMContentLoaded', _loadCreepIframe);
}

function getCreepData() {
  if (_creepDone) return Promise.resolve({ botDetection: _creepResult, visitorId: _creepVisitorId });
  return new Promise(resolve => {
    _creepResolvers.push(r => resolve({ botDetection: r, visitorId: _creepVisitorId }));
  });
}


/* ─── Behavioral signal collectors (những gì CreepJS không thu thập) ─── */
// Click latency tracker
const _clickEvents = [];
let _mouseDownTime = 0;
if (typeof window !== 'undefined') {
  document.addEventListener('mousedown', () => { _mouseDownTime = performance.now(); }, true);
  document.addEventListener('mouseup', () => {
    if (_mouseDownTime > 0 && _clickEvents.length < 20) {
      _clickEvents.push({ duration: Math.round(performance.now() - _mouseDownTime) });
      _mouseDownTime = 0;
    }
  }, true);
}

// Scroll speed tracker
let _scrollStart = 0, _scrollDist = 0, _scrollLastY = window?.scrollY || 0, _scrollTime = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => {
    const now = performance.now();
    const dy = Math.abs(window.scrollY - _scrollLastY);
    if (_scrollStart === 0) _scrollStart = now;
    _scrollDist += dy;
    _scrollLastY = window.scrollY;
    _scrollTime = now - _scrollStart;
  }, { passive: true });
}

// DeviceMotion sensor samples (mobile only)
const _motionSamples = [];
if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
  const _motionHandler = (e) => {
    if (_motionSamples.length < 10 && e.accelerationIncludingGravity) {
      _motionSamples.push({
        x: parseFloat((e.accelerationIncludingGravity.x || 0).toFixed(3)),
        y: parseFloat((e.accelerationIncludingGravity.y || 0).toFixed(3)),
        z: parseFloat((e.accelerationIncludingGravity.z || 0).toFixed(3)),
      });
    }
    if (_motionSamples.length >= 10) window.removeEventListener('devicemotion', _motionHandler);
  };
  window.addEventListener('devicemotion', _motionHandler, { passive: true });
}

/* ─── Device data: automation flags + behavioral signals (CreepJS cung cấp phần còn lại) ─── */
function getDeviceData() {
  const automation = {};
  try {
    automation.webdriver = !!navigator.webdriver;
    automation.cdc = !!(window.cdc_adoQpoasnfa76pfcZLmcfl_ || window.cdc_adoQpoasnfa76pfcZLmcfl_Array);
    automation.selenium = !!(document.__selenium_unwrapped || document.__webdriver_evaluate || window._Selenium_IDE_Recorder);
  } catch (e) { }

  // Detect extension overriding Event.prototype.isTrusted
  // Only flag if we CONFIRM tampering — not when browser simply doesn't expose a getter
  try {
    const desc = Object.getOwnPropertyDescriptor(Event.prototype, 'isTrusted');
    if (desc && typeof desc.get === 'function') {
      // Browser has getter — check if it's native
      automation.eventTampered = !desc.get.toString().includes('[native code]');
    } else {
      // Browser doesn't expose isTrusted getter (Safari iOS, Firefox) — not tampered
      automation.eventTampered = false;
    }
  } catch (e) {
    automation.eventTampered = false;
  }

  return {
    automation,
    behavior: {
      clicks: _clickEvents.slice(-10),
      scroll: _scrollDist > 0 ? { totalDistance: Math.round(_scrollDist), timeMs: Math.round(_scrollTime) } : null,
    },
    sensor: {
      motion: _motionSamples.length >= 3 ? { samples: _motionSamples } : null,
    },
  };
}




const API = '/api/vuot-link';

/* ─── Main Component ─── */
export default function LinkGateway() {
  const { slug } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkError, setLinkError] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [task, setTask] = useState(null);
  const [isIncognito, setIsIncognito] = useState(false);
  const [isAdBlock, setIsAdBlock] = useState(false);

  const [inputCode, setInputCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [showError, setShowError] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const [humanPassed, setHumanPassed] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeToken, setChallengeToken] = useState(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

  // Set tab title
  useEffect(() => {
    document.title = 'Vượt link để truy cập — traffic68.com';
  }, []);

  // Ad blocker detection
  useEffect(() => {
    const detectAdBlock = async () => {
      const bait = document.createElement('div');
      bait.className = 'ad ads adsbox ad-placement ad-banner textads banner-ads';
      bait.setAttribute('id', 'ad-test-banner');
      bait.innerHTML = '&nbsp;';
      bait.style.cssText = 'position:absolute;top:-10px;left:-10px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(bait);
      await new Promise(r => setTimeout(r, 200));
      const baitBlocked = bait.offsetHeight === 0 || bait.clientHeight === 0 ||
        window.getComputedStyle(bait).display === 'none' ||
        window.getComputedStyle(bait).visibility === 'hidden';
      bait.remove();
      let fetchBlocked = false;
      try { await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', { method: 'HEAD', mode: 'no-cors', cache: 'no-cache' }); } catch { fetchBlocked = true; }
      if (baitBlocked || fetchBlocked) setIsAdBlock(true);
    };
    detectAdBlock();
  }, []);

  // Step 1: Load link info
  useEffect(() => {
    fetch(`/api/shortlink/info/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setLinkError(data.error);
        else setLinkInfo(data.link);
      })
      .catch(() => setLinkError('Không thể tải thông tin link'));
  }, [slug]);

  // Track skipped campaigns
  const [skippedCampaigns, setSkippedCampaigns] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(`gw_skip_${slug}`)) || []; } catch { return []; }
  });

  // Fetch challenge + task (reusable)
  const fetchTask = useCallback(async (force = false, excludeList = null) => {
    if (!linkInfo) return;
    const sessionKey = `gw_task_${slug}`;

    // If not forced, try to restore from sessionStorage
    if (!force) {
      try {
        const cached = sessionStorage.getItem(sessionKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Only use cache if task is still pending and hasn't exceeded 12-14 mins locally
          if (parsed && parsed.id && !parsed._expired) {
            if (!parsed._fetched_at || (Date.now() - parsed._fetched_at < 13 * 60 * 1000)) {
              setTask(parsed);
              setLoading(false);
              return;
            } else {
              try { sessionStorage.removeItem(sessionKey); } catch { }
            }
          }
        }
      } catch { }
    }

    try {
      setLoading(true); setError('');

      // Incognito detection
      if (navigator.storage && navigator.storage.estimate) {
        const { quota } = await navigator.storage.estimate();
        if (quota && quota < 10 * 1024 * 1024 * 1024) {
          setIsIncognito(true);
          return;
        }
      }

      const creepData = await getCreepData();
      let visitorId = creepData.visitorId || 'unknown';
      let botDetectionResult = creepData.botDetection;

      if (window.clarity) {
        window.clarity('set', 'visitor_id', visitorId);
        window.clarity('identify', visitorId);
      }

      // Get challenge — pass slug so server binds worker_link_id to session
      const chRes = await fetch(`${API}/challenge?slug=${encodeURIComponent(slug)}`);
      if (!chRes.ok) throw new Error('Không thể lấy challenge');
      const challenge = await chRes.json();

      // Solve PoW
      let powNonce = 0;
      const target = '0'.repeat(challenge.d || 4);
      const enc = new TextEncoder();
      while (true) {
        const data = enc.encode(challenge.p + powNonce);
        const buf = await crypto.subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (hex.startsWith(target)) break;
        powNonce++;
        if (powNonce > 5000000) throw new Error('PoW timeout');
      }


      // Request task
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const taskRes = await fetch(`${API}/task`, {
        method: 'POST', headers,
        body: JSON.stringify({
          challengeId: challenge.c,
          powNonce,
          visitorId,
          botDetection: botDetectionResult,
          deviceData: getDeviceData(),
          excludeCampaigns: excludeList || skippedCampaigns,
        }),
      });

      if (taskRes.status === 404) {
        setError('Hiện tại không có nhiệm vụ nào. Vui lòng thử lại sau.');
        return;
      }
      if (taskRes.status === 429) {
        const e = await taskRes.json();
        setError(e.error || 'Bạn đã đạt giới hạn hôm nay.');
        return;
      }
      if (!taskRes.ok) throw new Error('Không thể lấy nhiệm vụ');
      const newTask = await taskRes.json();
      setTask(newTask);
      // Save to sessionStorage with timestamp to drop old tasks on reload
      try { sessionStorage.setItem(sessionKey, JSON.stringify({ ...newTask, _fetched_at: Date.now() })); } catch { }
    } catch (err) {
      setError(err.message || 'Lỗi');
    } finally {
      setLoading(false);
    }
  }, [linkInfo, slug]);

  // Step 2: After link info loaded, fetch challenge + task (chỉ gọi 1 lần)
  const _taskInitRef = useRef(false);
  useEffect(() => {
    if (!linkInfo || _taskInitRef.current) return;
    _taskInitRef.current = true;
    fetchTask(false);
  }, [linkInfo, fetchTask]);

  // Auto-refresh: when task expires (10 min), automatically fetch new campaign
  const expiryTimerRef = useRef(null);
  const [countdown, setCountdown] = useState(600);
  useEffect(() => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (!task || verified) return;
    setCountdown(600);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          console.log('[LinkGateway] Task expired, auto-fetching new campaign...');
          setTask(null);
          setInputCode('');
          setShowError(false);
          try { sessionStorage.removeItem(`gw_task_${slug}`); } catch { }
          fetchTask(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [task, verified, slug, fetchTask]);

  // Change task (skip current)
  const [changingTask, setChangingTask] = useState(false);
  const handleChangeTask = useCallback(async () => {
    setChangingTask(true);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    // Build new skip list with current campaign
    const newSkipList = task?.campaign_id
      ? [...new Set([...skippedCampaigns, task.campaign_id])]
      : skippedCampaigns;
    setSkippedCampaigns(newSkipList);
    try { sessionStorage.setItem(`gw_skip_${slug}`, JSON.stringify(newSkipList)); } catch { }
    setTask(null);
    setInputCode('');
    setVerified(false);
    setCompletionResult(null);
    setShowError(false);
    try { sessionStorage.removeItem(`gw_task_${slug}`); } catch { }
    // Pass exclude list directly (don't rely on state update)
    await fetchTask(true, newSkipList);
    setChangingTask(false);
  }, [fetchTask, slug, task, skippedCampaigns]);

  // Called when shake/curve challenge passes — fetch server-side token
  const handleChallengePass = useCallback(async (shakeLog) => {
    setShowChallenge(false);
    setChallengeLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body = { _tk: task._tk };
      if (Array.isArray(shakeLog) && shakeLog.length >= 3) body.shakeLog = shakeLog;
      const res = await fetch(`${API}/task/${task.id}/challenge-passed`, {
        method: 'POST', headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // Task hết hạn → tự động lấy task mới
      if (res.status === 410) {
        setTask(null);
        setInputCode('');
        setHumanPassed(false);
        setChallengeToken(null);
        setShowError(false);
        try { sessionStorage.removeItem(`gw_task_${slug}`); } catch { }
        fetchTask(true);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Xác minh thất bại');
      setChallengeToken(data.challengeToken);
      setHumanPassed(true);
    } catch (err) {
      setShowError(true);
      setError('Xác minh thất bại, vui lòng thử lại: ' + (err.message || ''));
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setChallengeLoading(false);
    }
  }, [task, slug, fetchTask]);

  // Verify code
  const handleVerify = useCallback(async () => {
    if (!inputCode.trim() || inputCode.trim().length < 4) {
      setShowError(true); setError('Vui lòng nhập mã xác nhận.');
      setTimeout(() => setShowError(false), 3000); return;
    }
    setCompleting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/task/${task.id}/verify`, {
        method: 'POST', headers,
        body: JSON.stringify({ code: inputCode.trim(), _tk: task._tk, challengeToken }),
      });
      const data = await res.json();

      // Task expired → auto fetch new campaign
      if (res.status === 410) {
        setCompleting(false);
        setInputCode('');
        setShowError(false);
        setTask(null);
        try { sessionStorage.removeItem(`gw_task_${slug}`); } catch { }
        fetchTask(true);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Mã không đúng');
      setCompletionResult(data);
      setVerified(true); setShowError(false);
      try { sessionStorage.removeItem(`gw_task_${slug}`); } catch { }

      // Redirect to destination_url after 3 seconds
      if (data.destination_url) {
        setRedirecting(true);
        setTimeout(() => { window.location.href = data.destination_url; }, 3000);
      }
    } catch (err) {
      setShowError(true); setError(err.message);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setCompleting(false);
    }
  }, [inputCode, task, slug, fetchTask]);

  const keyword = task?.keyword || '';
  const campaignImage = task?.image1_url || '';
  const campaignImage2 = task?.image2_url || '';
  const hasMultiSite = !!(campaignImage2);
  const widgetConfig = task?.widgetConfig || null;
  const trafficType = task?.traffic_type || 'google_search';
  const targetUrl = task?.target_url || '';
  const isDirect = trafficType === 'direct';

  // ── Link not found ──
  if (linkError) return (
    <Wrapper>
      <Center>
        <Icon bg="#FEF2F2" border="#FECACA"><WifiOff size={32} color="#EF4444" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: '0 0 8px' }}>Link không tồn tại</h2>
        <p style={{ color: '#64748B', margin: 0 }}>{linkError}</p>
      </Center>
    </Wrapper>
  );

  // ── Loading link info ──
  if (!linkInfo) return (
    <Wrapper>
      <Center>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748B', fontWeight: 500 }}>Đang tải link...</p>
      </Center>
    </Wrapper>
  );

  // ── Incognito ──
  if (isIncognito) return (
    <Wrapper>
      <Center>
        <Icon bg="#FFF7ED" border="#FED7AA"><ShieldCheck size={32} color="#F97316" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: 0 }}>Không hỗ trợ trình duyệt ẩn danh</h2>
        <p style={{ color: '#64748B', margin: 0 }}>Vui lòng mở bằng cửa sổ trình duyệt bình thường.</p>
      </Center>
    </Wrapper>
  );

  // ── Ad Blocker ──
  if (isAdBlock) return (
    <Wrapper>
      <Center>
        <Icon bg="#FEF2F2" border="#FECACA"><ShieldOff size={32} color="#EF4444" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: 0 }}>Vui lòng tắt trình chặn quảng cáo</h2>
        <p style={{ color: '#64748B', margin: 0, maxWidth: 400, lineHeight: 1.6 }}>
          Hệ thống phát hiện bạn đang sử dụng tiện ích chặn quảng cáo.<br />
          Vui lòng <strong>tắt trình chặn quảng cáo</strong> rồi tải lại trang.
        </p>
        <button onClick={() => window.location.reload()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', padding: '12px 28px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8, boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
          Tải lại trang
        </button>
      </Center>
    </Wrapper>
  );

  // ── Loading task ──
  if (loading) return (
    <Wrapper>
      <Center>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748B', fontWeight: 500 }}>Đang chuẩn bị nhiệm vụ...</p>
      </Center>
    </Wrapper>
  );

  // ── Error getting task ──
  if (error && !task) return (
    <Wrapper>
      <Center>
        <Icon bg="#FEF2F2" border="#FECACA"><WifiOff size={32} color="#EF4444" /></Icon>
        <h2 style={{ color: '#1E3A6E', fontWeight: 800, margin: '0 0 8px' }}>Không thể tải nhiệm vụ</h2>
        <p style={{ color: '#64748B', margin: '0 0 16px' }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#3B82F6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Thử lại</button>
      </Center>
    </Wrapper>
  );

  return (
    <Wrapper>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 48px' }}>


        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(20px,4vw,30px)', fontWeight: 900, color: '#1E3A6E', margin: '0 0 6px' }}>
            HOÀN THÀNH NHIỆM VỤ ĐỂ TRUY CẬP
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>Thực hiện {isDirect ? 2 : 4} bước bên dưới theo thứ tự để mở khóa liên kết</p>
          {/* Countdown timer */}
          {!verified && countdown > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: countdown < 120 ? '#FEF2F2' : '#F0F9FF', border: `1px solid ${countdown < 120 ? '#FECACA' : '#BFDBFE'}`, borderRadius: 10, padding: '6px 14px' }}>
                <Clock size={14} style={{ color: countdown < 120 ? '#EF4444' : '#3B82F6' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: countdown < 120 ? '#EF4444' : '#1E3A6E', fontVariantNumeric: 'tabular-nums' }}>
                  {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 11, color: countdown < 120 ? '#EF4444' : '#64748B' }}>
                  {countdown < 120 ? 'Sắp hết hạn!' : 'Thời gian còn lại'}
                </span>
              </div>
              <div style={{ width: 200, height: 3, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: countdown < 120 ? '#EF4444' : '#3B82F6', borderRadius: 99, width: `${(countdown / 600) * 100}%`, transition: 'width 1s linear' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Google Search cards (only when NOT direct) ── */}
          {!isDirect && (
            <StepCard n={1} color="#3B82F6" title="MỞ GOOGLE" verified={verified}>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0' }}>
                  <div style={{ background: '#F1F5F9', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {['#EF4444', '#F59E0B', '#22C55E'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                    </div>
                    <div style={{ flex: 1, background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#3B82F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Globe size={12} style={{ color: '#3B82F6' }} /> google.com
                    </div>
                  </div>
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>
                      <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span><span style={{ color: '#FBBC04' }}>o</span><span style={{ color: '#4285F4' }}>g</span><span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', margin: '16px auto 0', maxWidth: 300, background: '#fff', border: '1px solid #ddd', borderRadius: 24, padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                      <Search size={16} style={{ color: '#94A3B8', marginRight: 8 }} />
                      <span style={{ color: '#94A3B8', fontSize: 14 }}>Tìm kiếm...</span>
                    </div>
                  </div>
                </div>
                <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', textDecoration: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
                  <ExternalLink size={15} /> Mở Google
                </a>
              </div>
            </StepCard>
          )}

          {!isDirect && (
            <StepCard n={2} color="#F97316" title="NHẬP TỪ KHÓA" verified={verified}>
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14, padding: 16 }}>
                <p style={{ fontSize: 11, color: '#92400E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Từ khóa tìm kiếm</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px dashed #FB923C', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
                  <Search size={16} color="#F97316" />
                  <span style={{ flex: 1, color: '#EA580C', fontSize: 'clamp(13px,2.5vw,16px)', fontWeight: 700 }}>{keyword || 'traffic user giá rẻ traffic68'}</span>
                  <CopyBtn text={keyword || 'traffic user giá rẻ traffic68'} />
                </div>
                {['Copy từ khóa bên trên', 'Dán vào ô tìm kiếm Google', 'Nhấn Enter để tìm kiếm'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(249,115,22,0.06)', borderRadius: 8, padding: '8px 12px', marginBottom: i < 2 ? 6 : 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    </div>
                    <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                  </div>
                ))}
              </div>
            </StepCard>
          )}

          {!isDirect && (
            <StepCard n={3} color="#7C3AED" title="TÌM TRANG ĐÍCH" verified={verified}>
              {(campaignImage || campaignImage2) && (
                <div style={{ marginBottom: 16 }}>
                  {hasMultiSite ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                        <span style={{ fontSize: 16 }}>&#x1F4A1;</span>
                        <p style={{ margin: 0, color: '#1D4ED8', fontSize: 13, fontWeight: 700 }}>
                          Bạn có thể truy cập <strong>1 trong 2 trang web</strong> bất kỳ dưới đây.
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[{ img: campaignImage, label: 'Trang web 1' }, { img: campaignImage2, label: 'Trang web 2' }].map(({ img, label }, idx) => img ? (
                          <div key={idx}>
                            <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>🎯 {label}</p>
                            <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #DDD6FE', boxShadow: '0 4px 16px rgba(99,102,241,0.1)' }}>
                              <img src={img} alt={label} style={{ width: '100%', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                            </div>
                          </div>
                        ) : null)}
                      </div>
                    </>
                  ) : campaignImage ? (
                    <>
                      <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                        🎯 Trang đích cần tìm:
                      </p>
                      <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #DDD6FE', boxShadow: '0 4px 20px rgba(99,102,241,0.12)' }}>
                        <img src={campaignImage} alt="Trang đích" style={{ width: '100%', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                      </div>
                    </>
                  ) : null}
                </div>
              )}
              <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 14, padding: 14 }}>
                {['Cuộn tìm trong kết quả Google', hasMultiSite ? 'Tìm trang có giao diện giống 1 trong 2 hình trên' : 'Tìm trang có giao diện giống hình trên', 'Click vào kết quả để truy cập trang'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(139,92,246,0.06)', borderRadius: 8, padding: '8px 12px', marginBottom: i < 2 ? 8 : 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    </div>
                    <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                  </div>
                ))}
              </div>
            </StepCard>
          )}

          {/* ── Direct traffic card ── */}
          {isDirect && (
            <StepCard n={1} color="#3B82F6" title="TRUY CẬP TRANG WEB" verified={verified}>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px dashed #3B82F6', borderRadius: 10, padding: '12px 16px', width: '100%', maxWidth: 400 }}>
                  <Globe size={16} style={{ color: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#1D4ED8', fontSize: 'clamp(12px,2.5vw,14px)', fontWeight: 700, wordBreak: 'break-all' }}>{targetUrl}</span>
                  <CopyBtn text={targetUrl} />
                </div>
                <a href={targetUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', textDecoration: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
                  <ExternalLink size={15} /> Mở trang web
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {['Copy hoặc nhấn nút mở trang web', 'Ở lại trang và tương tác tự nhiên', 'Tìm nút lấy mã trên trang → lấy mã', 'Quay lại đây nhập mã xác nhận'].map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                      </div>
                      <span style={{ color: '#374151', fontSize: 13 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StepCard>
          )}

          {/* Change task button */}
          {task && !verified && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={handleChangeTask} disabled={changingTask}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid #CBD5E1', color: '#64748B', padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B'; }}>
                <RefreshCw size={14} style={changingTask ? { animation: 'spin 1s linear infinite' } : {}} />
                {changingTask ? 'Đang đổi...' : 'Không tìm thấy? Đổi nhiệm vụ'}
              </button>
            </div>
          )}

          {/* Step — Code entry */}
          <StepCard n={isDirect ? 2 : 4} color="#16A34A" title="NHẬP MÃ XÁC NHẬN" verified={verified}>
            {verified ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F0FEF4', border: '3px solid #86EFAC', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Unlock size={36} color="#22C55E" />
                </div>
                <h3 style={{ color: '#16A34A', fontWeight: 800, margin: '0 0 8px' }}>Xác nhận thành công!</h3>
                <p style={{ color: '#64748B', margin: '0 0 20px' }}>
                  {redirecting ? '🔄 Đang chuyển hướng đến trang đích...' : 'Bạn đã hoàn thành nhiệm vụ!'}
                </p>
                {redirecting && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ height: 4, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: 4, background: '#22C55E', borderRadius: 99, animation: 'progress 3s linear forwards' }} />
                    </div>
                  </div>
                )}
                {completionResult?.destination_url && (
                  <a href={completionResult.destination_url}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
                    Đến trang đích ngay <ArrowRight size={16} />
                  </a>
                )}
              </div>
            ) : (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Flow steps */}
                {[
                  {
                    num: '1', color: '#3B82F6', label: 'Cuộn & tìm nút',
                    content: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#64748B' }}>Nút trông như thế này trên trang đích:</span>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          background: widgetConfig?.buttonColor || '#F97316',
                          color: widgetConfig?.textColor || '#fff',
                          borderRadius: `${widgetConfig?.borderRadius ?? 50}px`,
                          fontSize: `${widgetConfig?.fontSize || 15}px`,
                          fontWeight: 700,
                          padding: '8px 16px',
                          boxShadow: `0 4px 16px ${(widgetConfig?.buttonColor || '#F97316')}55`,
                          userSelect: 'none', whiteSpace: 'nowrap', cursor: 'default',
                        }}>
                          <img
                            src={widgetConfig?.iconUrl || 'https://traffic68.com/lg.png'}
                            width={widgetConfig?.iconSize ?? 22}
                            height={widgetConfig?.iconSize ?? 22}
                            alt=""
                            style={{
                              background: widgetConfig?.iconBg ?? 'rgba(255,255,255,0.92)',
                              borderRadius: 6,
                              padding: 2,
                              objectFit: 'contain',
                              flexShrink: 0,
                              display: 'block',
                            }}
                            onError={e => { e.target.src = 'https://traffic68.com/lg.png'; }}
                          />
                          {widgetConfig?.buttonText || 'Lấy Mã'}
                        </div>
                      </div>
                    ),
                  },
                  {
                    num: '2', color: '#F97316', label: 'Chờ đủ thời gian → bấm nút → sao chép mã',
                    content: (
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                        Khi nút kích hoạt, bấm vào — popup sẽ hiện mã. Sao chép mã rồi quay lại đây.
                      </p>
                    ),
                  },
                ].map(({ num, color, label, content }) => (
                  <div key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>{num}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>{label}</p>
                      {content}
                    </div>
                  </div>
                ))}

                <div style={{ borderTop: '1.5px dashed #BBF7D0', margin: 0 }} />

                {!humanPassed ? (
                  <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px' }}>
                      {isMobileDevice
                        ? '📱 Cần xác minh bạn là người thật trước khi nhập mã'
                        : '🖱️ Cần xác minh bạn là người thật trước khi nhập mã'}
                    </p>
                    <button
                      onClick={() => setShowChallenge(true)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                        background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                        color: '#fff', border: 'none', borderRadius: 12,
                        padding: '13px 28px', fontSize: 14, fontWeight: 800,
                        cursor: 'pointer', boxShadow: '0 6px 24px rgba(124,58,237,0.35)',
                        animation: 'glow-purple 2.5s ease-in-out infinite',
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{isMobileDevice ? '📳' : '🖱️'}</span>
                      {isMobileDevice ? 'LẮC ĐIỆN THOẠI ĐỂ XÁC MINH' : 'RÊ CHUỘT ĐỂ XÁC MINH'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: '#16A34A', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22C55E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 900, flexShrink: 0 }}>3</span>
                      Nhập mã xác nhận
                    </p>
                    <div style={{ marginBottom: 10 }}>
                      <input type="text" maxLength={6} value={inputCode}
                        onChange={e => setInputCode(e.target.value.toUpperCase())}
                        disabled={completing} placeholder="Nhập mã tại đây"
                        onKeyDown={e => e.key === 'Enter' && handleVerify()}
                        style={{ width: '100%', padding: '12px 14px', background: '#fff', border: `1.5px solid ${showError ? '#FCA5A5' : '#86EFAC'}`, borderRadius: 10, outline: 'none', fontSize: 16, fontWeight: 700, letterSpacing: 3, textAlign: 'center', color: '#1E293B', boxSizing: 'border-box' }}
                      />
                    </div>
                    {showError && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                        <AlertCircle size={14} color="#EF4444" />
                        <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 500 }}>{error || 'Mã xác nhận không đúng.'}</span>
                      </div>
                    )}
                    <button onClick={handleVerify} disabled={inputCode.length < 4 || completing}
                      style={{
                        width: '100%', padding: 15, borderRadius: 12, border: 'none',
                        background: inputCode.length >= 4 && !completing ? 'linear-gradient(135deg,#F97316,#EA580C)' : '#E2E8F0',
                        color: inputCode.length >= 4 ? '#fff' : '#94A3B8',
                        fontSize: 14, fontWeight: 800,
                        cursor: inputCode.length >= 4 && !completing ? 'pointer' : 'not-allowed',
                        letterSpacing: '0.3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: inputCode.length >= 4 && !completing ? '0 6px 24px rgba(249,115,22,0.4)' : 'none',
                        transition: 'all 0.3s',
                        animation: inputCode.length >= 4 && !completing ? 'glow 2.5s ease-in-out infinite' : 'none',
                      }}
                      onMouseEnter={e => { if (inputCode.length >= 4 && !completing) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                    >
                      {completing ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN VÀ MỞ KHÓA LINK'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </StepCard>
        </div>
      </div>

      {showChallenge && !humanPassed && (
        isMobileDevice
          ? <ShakeChallenge onPass={handleChallengePass} onClose={() => setShowChallenge(false)} />
          : <CurveChallenge onPass={handleChallengePass} onClose={() => setShowChallenge(false)} />
      )}

      {challengeLoading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,15,35,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#22C55E', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>Đang xác minh với máy chủ...</p>
        </div>
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes progress { from{width:0} to{width:100%} }
        @keyframes glow { 0%,100%{box-shadow:0 6px 24px rgba(249,115,22,0.4)} 50%{box-shadow:0 8px 36px rgba(249,115,22,0.6)} }
        @keyframes glow-purple { 0%,100%{box-shadow:0 6px 24px rgba(124,58,237,0.35)} 50%{box-shadow:0 8px 40px rgba(124,58,237,0.6)} }
      `}</style>

    </Wrapper>
  );
}

function Wrapper({ children }) {
  return (
    <div style={{ background: 'linear-gradient(160deg,#DBEAFE 0%,#EFF6FF 40%,#F0F9FF 70%,#F8FAFC 100%)', fontFamily: "'Inter',sans-serif", position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
          <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1E3A6E" strokeWidth="1" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

function Center({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '0 24px' }}>{children}</div>;
}

function Icon({ children, bg, border }) {
  return <div style={{ width: 72, height: 72, borderRadius: '50%', background: bg, border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>;
}

function StepCard({ n, color, title, verified, children }) {
  const colors = { 1: '#3B82F6', 2: '#F97316', 3: '#7C3AED', 4: '#22C55E' };
  const c = colors[n] || color;
  return (
    <div style={{
      background: '#fff', border: `2px solid ${verified ? '#86EFAC' : n === 4 ? '#BBF7D0' : '#E2E8F0'}`,
      borderRadius: 20, padding: 'clamp(20px,3vw,28px)',
      boxShadow: verified ? '0 4px 16px rgba(34,197,94,0.08)' : '0 2px 12px rgba(0,0,0,0.05)',
      transition: 'all 0.4s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: verified ? '#22C55E' : c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${c}40` }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>{n}</span>
        </div>
        <span style={{ color: verified ? '#16A34A' : c, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>BƯỚC {n}</span>
        {verified && <span style={{ marginLeft: 'auto', background: '#F0FEF4', border: '1px solid #86EFAC', color: '#16A34A', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>✓ HOÀN THÀNH</span>}
      </div>
      <h2 style={{ color: verified ? '#16A34A' : c, fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, margin: '0 0 14px' }}>{title}</h2>
      {children}
    </div>
  );
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? '#F0FEF4' : '#FFF7ED', border: `1px solid ${copied ? '#86EFAC' : '#FED7AA'}`, color: copied ? '#16A34A' : '#EA580C', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Đã copy' : 'Copy'}
    </button>
  );
}

function ShakeChallenge({ onPass, onClose }) {
  const [shakeCount, setShakeCount] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const [passed, setPassed] = useState(false);
  const [fakeDetected, setFakeDetected] = useState(false);
  const lastShakeRef = useRef(0);
  const shakeLogRef = useRef([]);
  const intervalLogRef = useRef([]);
  const TARGET = 3;

  useEffect(() => {
    const requestAndListen = async () => {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm !== 'granted') return;
        } catch (e) { return; }
      }
      const handler = (e) => {
        if (!(e instanceof DeviceMotionEvent)) return;
        if (!e.isTrusted) return;
        const acc = e.accelerationIncludingGravity;
        if (!acc) return;
        const ax = acc.x || 0, ay = acc.y || 0, az = acc.z || 0;
        const total = (ax < 0 ? -ax : ax) + (ay < 0 ? -ay : ay) + (az < 0 ? -az : az);
        if (ax === ay && ay === az) return;
        const now = Date.now();

        // Track raw interval between ALL events (not just shakes) để phát hiện fixed-interval
        if (intervalLogRef.current.length > 0) {
          intervalLogRef.current.push(now - intervalLogRef.current[intervalLogRef.current.length - 1]);
        } else {
          intervalLogRef.current.push(now);
        }

        if (total > 32 && now - lastShakeRef.current > 500) {
          lastShakeRef.current = now;
          shakeLogRef.current.push({ t: now, ax: +ax.toFixed(2), ay: +ay.toFixed(2), az: +az.toFixed(2) });
          setFlashing(true);
          setTimeout(() => setFlashing(false), 300);
          setShakeCount(prev => {
            const next = prev + 1;
            if (next >= TARGET) {
              const log = shakeLogRef.current.slice(-TARGET);

              // ── Frontend emulator detection ──
              // 1. az = 0 tuyệt đối trên tất cả shake events
              const allAzZero = log.every(s => s.az === 0);
              // 2. Tần suất event cảm biến đều tuyệt đối (fixed setInterval)
              const ivals = intervalLogRef.current.slice(1); // bỏ entry đầu là timestamp tuyệt đối
              let fixedInterval = false;
              if (ivals.length >= 5) {
                const avg = ivals.reduce((a, b) => a + b, 0) / ivals.length;
                const variance = ivals.reduce((a, v) => a + (v - avg) ** 2, 0) / ivals.length;
                fixedInterval = variance < 5 && avg > 0; // < 5ms variance = cực kỳ đều
              }
              // 3. ax hoặc ay cũng = 0 hoàn toàn (chỉ 1 trục có giá trị - emulator thường vậy)
              const allAxZero = log.every(s => s.ax === 0);

              if (allAzZero || fixedInterval || allAxZero) {
                setFakeDetected(true);
                return next; // không call onPass
              }

              setPassed(true);
              setTimeout(() => onPass(log), 800);
            }
            return next;
          });
        }
      };
      window.addEventListener('devicemotion', handler, { passive: true });
      return () => window.removeEventListener('devicemotion', handler);
    };
    const cleanup = requestAndListen();
    return () => { cleanup.then && cleanup.then(fn => fn && fn()); };
  }, [onPass]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: passed ? 'rgba(34,197,94,0.92)' : 'rgba(15,15,35,0.92)',
      backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      transition: 'background 0.4s',
    }}>
      {/* Close */}
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

      {passed ? (
        <div style={{ textAlign: 'center', color: '#fff', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 8px' }}>Xác minh thành công!</h2>
          <p style={{ fontSize: 16, opacity: 0.9 }}>Đang mở ô nhập mã...</p>
        </div>
      ) : fakeDetected ? (
        <div style={{ textAlign: 'center', color: '#fff', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 12px', color: '#fca5a5' }}>Phát hiện giả lập!</h2>
          <p style={{ fontSize: 14, opacity: 0.8, margin: '0 0 24px' }}>Cảm biến điện thoại cho thấy thiết bị không hợp lệ.<br/>Vui lòng dùng thiết bị thật.</p>
          <button onClick={onClose} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Đóng</button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#fff' }}>
          {/* Phone animation */}
          <div style={{
            fontSize: 72, marginBottom: 24,
            animation: flashing ? 'shake-anim 0.3s ease' : 'phone-idle 2s ease-in-out infinite',
            display: 'inline-block',
          }}>📱</div>

          <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px', letterSpacing: 0.5 }}>
            LẮC ĐIỆN THOẠI ĐỂ XÁC MINH
          </h2>
          <p style={{ fontSize: 14, opacity: 0.75, margin: '0 0 32px' }}>
            Lắc mạnh điện thoại <strong>{TARGET} lần</strong> để chứng minh bạn là người thật
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 28 }}>
            {Array.from({ length: TARGET }).map((_, i) => (
              <div key={i} style={{
                width: 20, height: 20, borderRadius: '50%',
                background: i < shakeCount ? '#22C55E' : 'rgba(255,255,255,0.25)',
                border: '2px solid ' + (i < shakeCount ? '#22C55E' : 'rgba(255,255,255,0.4)'),
                transition: 'all 0.3s',
                transform: i < shakeCount ? 'scale(1.2)' : 'scale(1)',
                boxShadow: i < shakeCount ? '0 0 12px rgba(34,197,94,0.6)' : 'none',
              }} />
            ))}
          </div>

          <p style={{ fontSize: 13, opacity: 0.6 }}>
            {shakeCount === 0 ? 'Chưa phát hiện lắc...' : `Đã lắc ${shakeCount}/${TARGET} lần 💪`}
          </p>
        </div>
      )}

      <style>{`
        @keyframes phone-idle {
          0%,100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes shake-anim {
          0% { transform: rotate(0deg) scale(1.1); }
          25% { transform: rotate(-15deg) scale(1.2); }
          75% { transform: rotate(15deg) scale(1.2); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

function _genCurve(w, h) {
  const m = 60;
  return [
    { x: m + Math.random() * w * 0.2, y: m + Math.random() * (h - m * 2) },
    { x: w * 0.3 + Math.random() * w * 0.15, y: m + Math.random() * (h - m * 2) },
    { x: w * 0.55 + Math.random() * w * 0.15, y: m + Math.random() * (h - m * 2) },
    { x: w - m - Math.random() * w * 0.2, y: m + Math.random() * (h - m * 2) },
  ];
}
function _sampleBezier(pts, n = 120) {
  const [p0, p1, p2, p3] = pts;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), mt = 1 - t;
    return {
      x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
    };
  });
}

function CurveChallenge({ onPass, onClose }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ points: [], progress: 0, isDragging: false, passed: false, curveLog: [] });
  const [progress, setProgress] = useState(0);
  const [passed, setPassed] = useState(false);
  const [started, setStarted] = useState(false);
  const animRef = useRef(null);
  const onPassRef = useRef(onPass);
  useEffect(() => { onPassRef.current = onPass; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = canvas.width = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 560;
    const H = canvas.height = 220;

    const state = stateRef.current;
    if (!state.initialized) {
      state.pts = _genCurve(W, H);
      state.samples = _sampleBezier(state.pts);
      state.initialized = true;
    }
    state.progress = 0;
    state.isDragging = false;
    state.passed = false;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background guide track (faint)
      ctx.beginPath();
      ctx.moveTo(state.pts[0].x, state.pts[0].y);
      ctx.bezierCurveTo(state.pts[1].x, state.pts[1].y, state.pts[2].x, state.pts[2].y, state.pts[3].x, state.pts[3].y);
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 20;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Dashed guideline
      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.moveTo(state.pts[0].x, state.pts[0].y);
      ctx.bezierCurveTo(state.pts[1].x, state.pts[1].y, state.pts[2].x, state.pts[2].y, state.pts[3].x, state.pts[3].y);
      ctx.strokeStyle = 'rgba(99,102,241,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);

      // Progress fill
      const prog = Math.min(state.progress, state.samples.length);
      if (prog > 1) {
        ctx.beginPath();
        ctx.moveTo(state.samples[0].x, state.samples[0].y);
        for (let i = 1; i < prog; i++) ctx.lineTo(state.samples[i].x, state.samples[i].y);
        ctx.strokeStyle = 'rgba(124,58,237,0.9)';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Glow effect
        ctx.beginPath();
        ctx.moveTo(state.samples[0].x, state.samples[0].y);
        for (let i = 1; i < prog; i++) ctx.lineTo(state.samples[i].x, state.samples[i].y);
        ctx.strokeStyle = 'rgba(167,139,250,0.3)';
        ctx.lineWidth = 14;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(state.pts[0].x, state.pts[0].y, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(124,58,237,0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(state.pts[0].x, state.pts[0].y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#7C3AED';
      ctx.fill();

      const endPt = state.pts[3];
      ctx.beginPath();
      ctx.arc(endPt.x, endPt.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = state.passed ? 'rgba(34,197,94,0.2)' : 'rgba(226,232,240,0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(endPt.x, endPt.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = state.passed ? '#22C55E' : '#94A3B8';
      ctx.fill();

      ctx.fillStyle = '#A78BFA';
      ctx.font = 'bold 11px Inter,sans-serif';
      ctx.fillText('BẮT ĐẦU', state.pts[0].x - 28, state.pts[0].y - 16);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('KẾT THÚC', endPt.x - 28, endPt.y - 16);

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    };

    const onMove = (e) => {
      if (!state.isDragging) return;
      if (!e.isTrusted) { state.isDragging = false; return; }
      e.preventDefault();

      const { x, y } = getPos(e);
      const now = performance.now();

      if (state.lastMoveTime && state.lastPos) {
        const dt = Math.max(now - state.lastMoveTime, 1);
        const spd = Math.sqrt((x - state.lastPos.x) ** 2 + (y - state.lastPos.y) ** 2) / dt;
        state.speedBuf = state.speedBuf || [];
        state.speedBuf.push(spd);
        if (state.speedBuf.length > 12) state.speedBuf.shift();
        if (state.speedBuf.length === 12) {
          const avg = state.speedBuf.reduce((a, b) => a + b, 0) / 12;
          const variance = state.speedBuf.reduce((a, s) => a + (s - avg) ** 2, 0) / 12;
          // Chỉ reset nếu tốc độ hoàn toàn đều tuyệt đối (bot) và đang di chuyển
          if (variance < 0.00008 && avg > 0.08) {
            state.progress = 0; setProgress(0); state.speedBuf = []; state.curveLog = []; return;
          }
        }
      }
      state.lastMoveTime = now;
      state.lastPos = { x, y };

      // Collect curve points for server verification (max 50 to save bandwidth)
      if (state.curveLog.length < 50 && (state.curveLog.length === 0 || now - state.curveLog[state.curveLog.length - 1].t > 20)) {
        state.curveLog.push({ x: +x.toFixed(1), y: +y.toFixed(1), t: now });
      }

      const current = state.progress;
      const sample = state.samples[current] || state.samples[state.samples.length - 1];
      const dx = x - sample.x, dy = y - sample.y;
      if (Math.sqrt(dx * dx + dy * dy) < 52) {
        state.progress = Math.min(current + 1, state.samples.length);
        setProgress(Math.round((state.progress / state.samples.length) * 100));
        if (state.progress >= Math.floor(state.samples.length * 0.75) && !state.passed) {
          const elapsed = now - (state.dragStartTime || now);
          if (elapsed < 800) { state.progress = 0; setProgress(0); state.speedBuf = []; state.curveLog = []; return; }
          state.passed = true;
          setPassed(true);
          setTimeout(() => onPassRef.current(state.curveLog), 900);
        }
      }
    };

    const onDown = (e) => {
      if (!e.isTrusted) return;
      state.isDragging = true;
      state.dragStartTime = performance.now();
      state.speedBuf = [];
      state.curveLog = [];
      state.lastMoveTime = null;
      state.lastPos = null;
      setStarted(true);
      onMove(e);
    };

    const onUp = () => { state.isDragging = false; };


    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    };
  }, []);


  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: passed ? 'rgba(34,197,94,0.88)' : 'rgba(15,15,35,0.93)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.4s',
    }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

      {passed ? (
        <div style={{ textAlign: 'center', color: '#fff', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 8px' }}>Xác minh thành công!</h2>
          <p style={{ fontSize: 16, opacity: 0.9 }}>Đang mở ô nhập mã...</p>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 600, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>
              🖱️ RÊ CHUỘT THEO ĐƯỜNG
            </h2>
            <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
              {started ? `Hoàn thành: ${progress}%` : 'Nhấn giữ chuột tại điểm BẮT ĐẦU và kéo theo đường tím'}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#7C3AED,#A78BFA)', borderRadius: 99, transition: 'width 0.1s' }} />
          </div>

          {/* Canvas */}
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '2px solid rgba(124,58,237,0.4)', boxShadow: '0 0 40px rgba(124,58,237,0.2)', cursor: 'crosshair', background: 'rgba(255,255,255,0.05)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 220, display: 'block', userSelect: 'none', touchAction: 'none' }} />
          </div>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0 }}>
            Rê chậm và sát đường dẫn để được xác minh là người thật
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes glow-purple { 0%,100%{box-shadow:0 6px 24px rgba(124,58,237,0.35)} 50%{box-shadow:0 8px 40px rgba(124,58,237,0.6)} }
      `}</style>
    </div>
  );
}

