import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, Globe, Target, ShieldCheck,
    ExternalLink, ArrowRight,
    AlertCircle, Loader2, WifiOff,
    Copy, Check, ShieldOff,
} from 'lucide-react';

/* ─── CreepJS via iframe (same approach as embed script — avoids console.log conflicts) ── */
let _creepResult = null;
let _creepVisitorId = 'unknown';
let _creepDone = false;
let _creepResolvers = [];

function _resolveCreep(result) {
    if (_creepDone) return;
    _creepResult = result;
    _creepDone = true;
    _creepResolvers.forEach(r => r(result));
    _creepResolvers = [];
}

// Fallback visitorId from canvas + WebGL fingerprint
function _generateFallbackId() {
    try {
        const cv = document.createElement('canvas');
        cv.width = 200; cv.height = 50;
        const ctx = cv.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('traffic68-fp-' + navigator.userAgent.length, 2, 2);
        return 'fb-' + cv.toDataURL().slice(-32);
    } catch { return 'fb-' + Date.now().toString(36); }
}

if (typeof window !== 'undefined') {
    // Listen for creep-frame.html postMessage
    window.addEventListener('message', function handler(e) {
        if (!e.data || e.data.type !== 'creep-result') return;
        const d = e.data.data;
        if (d) {
            if (d.visitorId && d.visitorId !== 'unknown') _creepVisitorId = d.visitorId;
            _resolveCreep(d.botDetection || { bot: false });
        }
        window.removeEventListener('message', handler);
    });

    // Load creep-frame.html in hidden iframe
    const _loadCreepFrame = () => {
        const iframe = document.createElement('iframe');
        iframe.src = '/creep-frame.html';
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.onerror = () => {
            if (_creepVisitorId === 'unknown') _creepVisitorId = _generateFallbackId();
            _resolveCreep({ bot: false, creepError: true });
        };
        document.body.appendChild(iframe);
    };

    if (document.body) {
        _loadCreepFrame();
    } else {
        document.addEventListener('DOMContentLoaded', _loadCreepFrame);
    }

    // Timeout fallback
    setTimeout(() => {
        if (!_creepDone) {
            if (_creepVisitorId === 'unknown') _creepVisitorId = _generateFallbackId();
            _resolveCreep({ bot: false, creepTimeout: true });
        }
    }, 12000);
}

function getCreepData() {
    if (_creepDone) return Promise.resolve({ botDetection: _creepResult, visitorId: _creepVisitorId });
    return new Promise(resolve => {
        _creepResolvers.push(r => resolve({ botDetection: r, visitorId: _creepVisitorId }));
        setTimeout(() => {
            if (!_creepDone) {
                if (_creepVisitorId === 'unknown') _creepVisitorId = _generateFallbackId();
                _resolveCreep({ bot: false, creepTimeout: true });
            }
        }, 12000);
    });
}

const probeData = {};
if (typeof window !== 'undefined') {
    try {
        probeData.webdriver = !!navigator.webdriver;
        probeData.cdc = !!(window.cdc_adoQpoasnfa76pfcZLmcfl_ || window.cdc_adoQpoasnfa76pfcZLmcfl_Array || window.cdc_adoQpoasnfa76pfcZLmcfl_Promise || window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol);
        probeData.selenium = !!(document.__selenium_unwrapped || document.__webdriver_evaluate || document.__driver_evaluate || window._Selenium_IDE_Recorder || window.__nightmare);
        probeData.pluginCount = navigator.plugins ? navigator.plugins.length : -1;
        probeData.langCount = navigator.languages ? navigator.languages.length : 0;
        probeData.hasChrome = !!window.chrome;
        probeData.hasChromeRuntime = !!(window.chrome && window.chrome.runtime);
        if (window.Notification) probeData.notifPerm = Notification.permission;
        if (navigator.connection) probeData.rtt = navigator.connection.rtt;
    } catch (e) { }
}

const _bhv = {
    startTime: Date.now(),
    mouseTrail: [], clickPositions: [],
    keyDwellTimes: [], keyFlightTimes: [], _keyDownMap: {},
    backspaceCount: 0, totalKeys: 0,
    scrollEvents: [], scrollPauses: 0, _lastScrollT: 0,
    totalBlur: 0, rafStable: true, _lastKeyUp: 0,
    screen: typeof window !== 'undefined' ? { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 } : null,
};
let _bhvBound = false;
function bindBehavior() {
    if (_bhvBound || typeof document === 'undefined') return;
    _bhvBound = true;
    const st = _bhv.startTime;
    document.addEventListener('mousemove', (e) => {
        _bhv.mouseTrail.push({ x: e.clientX, y: e.clientY, t: Date.now() - st });
        if (_bhv.mouseTrail.length > 80) _bhv.mouseTrail.shift();
    }, { passive: true });
    document.addEventListener('click', (e) => {
        const r = e.target ? e.target.getBoundingClientRect() : null;
        const entry = { x: e.clientX, y: e.clientY, t: Date.now() - st };
        if (r) { entry.elCenterX = Math.round(r.left + r.width / 2); entry.elCenterY = Math.round(r.top + r.height / 2); }
        _bhv.clickPositions.push(entry);
        if (_bhv.clickPositions.length > 20) _bhv.clickPositions.shift();
    }, { passive: true });
    document.addEventListener('keydown', (e) => {
        _bhv.totalKeys++;
        if (e.key === 'Backspace') _bhv.backspaceCount++;
        if (!_bhv._keyDownMap[e.key]) _bhv._keyDownMap[e.key] = Date.now();
    }, { passive: true });
    document.addEventListener('keyup', (e) => {
        const d = _bhv._keyDownMap[e.key];
        if (d) {
            const dwell = Date.now() - d;
            _bhv.keyDwellTimes.push(dwell);
            if (_bhv.keyDwellTimes.length > 30) _bhv.keyDwellTimes.shift();
            if (_bhv._lastKeyUp) {
                _bhv.keyFlightTimes.push(Date.now() - _bhv._lastKeyUp);
                if (_bhv.keyFlightTimes.length > 30) _bhv.keyFlightTimes.shift();
            }
            _bhv._lastKeyUp = Date.now();
            delete _bhv._keyDownMap[e.key];
        }
    }, { passive: true });
    window.addEventListener('scroll', () => {
        const now = Date.now();
        if (_bhv._lastScrollT && (now - _bhv._lastScrollT) > 500) _bhv.scrollPauses++;
        _bhv._lastScrollT = now;
        _bhv.scrollEvents.push({ y: window.scrollY || 0, t: now - st });
        if (_bhv.scrollEvents.length > 40) _bhv.scrollEvents.shift();
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) _bhv.totalBlur++; });
    let rafCount = 0; const rafStart = performance.now();
    function checkRaf(ts) {
        rafCount++;
        if (rafCount < 60) requestAnimationFrame(checkRaf);
        else _bhv.rafStable = (ts - rafStart) < 3000;
    }
    if (window.requestAnimationFrame) requestAnimationFrame(checkRaf);
}
if (typeof window !== 'undefined') bindBehavior();

function getBehavioralData() {
    return {
        mouseTrail: _bhv.mouseTrail,
        clickPositions: _bhv.clickPositions,
        keyDwellTimes: _bhv.keyDwellTimes,
        keyFlightTimes: _bhv.keyFlightTimes,
        backspaceCount: _bhv.backspaceCount,
        totalKeys: _bhv.totalKeys,
        scrollEvents: _bhv.scrollEvents,
        scrollPauses: _bhv.scrollPauses,
        totalBlur: _bhv.totalBlur,
        rafStable: _bhv.rafStable,
        screen: _bhv.screen,
        probes: probeData,
    };
}

const API = '/api/vuot-link';


/* ─── Main Component ────────────────────────────────── */
export default function VuotLink() {
    // Set tab title
    useEffect(() => {
        document.title = 'Vượt Link — traffic68.com';
    }, []);

    // Task state from API
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [task, setTask] = useState(null);
    const [isIncognito, setIsIncognito] = useState(false);
    const [isAdBlock, setIsAdBlock] = useState(false);

    // Ad blocker detection
    useEffect(() => {
        const detectAdBlock = async () => {
            // Method 1: Create a bait element that ad blockers typically hide
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

            // Method 2: Try to fetch a known ad-related URL
            let fetchBlocked = false;
            try {
                const resp = await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-cache',
                });
            } catch {
                fetchBlocked = true;
            }

            // Method 3: Try loading a script that looks like an ad
            let scriptBlocked = false;
            try {
                const testScript = document.createElement('script');
                testScript.src = 'https://static.cloudflareinsights.com/beacon.min.js';
                testScript.async = true;
                const loadPromise = new Promise((resolve) => {
                    testScript.onload = () => resolve(false);
                    testScript.onerror = () => resolve(true);
                    setTimeout(() => resolve(true), 2000);
                });
                document.head.appendChild(testScript);
                scriptBlocked = await loadPromise;
                testScript.remove();
            } catch {
                scriptBlocked = true;
            }

            if (baitBlocked || fetchBlocked || scriptBlocked) {
                setIsAdBlock(true);
            }
        };
        detectAdBlock();
    }, []);

    // UI state
    const [inputCode, setInputCode] = useState('');
    const [verified, setVerified] = useState(false);
    const [showError, setShowError] = useState(false);
    const [completionResult, setCompletionResult] = useState(null);
    const [completing, setCompleting] = useState(false);

    const waitTime = task?.waitTime || 60;


    /* ─── Fetch task from API on mount ─────────────── */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError('');

                // Incognito detection via storage quota
                if (navigator.storage && navigator.storage.estimate) {
                    const { quota } = await navigator.storage.estimate();
                    if (quota && quota < 10 * 1024 * 1024 * 1024) {
                        if (!cancelled) setIsIncognito(true);
                        return;
                    }
                }

                // Step 1: Load CreepJS for bot detection + visitorId
                const creepData = await getCreepData();
                let visitorId = creepData.visitorId || 'unknown';
                let botDetectionResult = creepData.botDetection;

                // Tag Clarity session with visitor_id
                if (window.clarity) {
                    window.clarity('set', 'visitor_id', visitorId);
                    window.clarity('identify', visitorId);
                }

                // Step 2: Get challenge + solve Proof-of-Work
                const chRes = await fetch(`${API}/challenge`);
                if (!chRes.ok) throw new Error('Không thể lấy challenge');
                const challenge = await chRes.json();

                // Solve PoW: find nonce where SHA-256(prefix+nonce) starts with d zeros
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

                // Solve DOM challenge: Canvas 2D + WebGL (requires real browser)
                let domWidth = 0;
                let glRenderer = '';
                let glPixel = [0, 0, 0];
                try {
                    const cv = document.createElement('canvas');
                    const ctx2d = cv.getContext('2d');
                    ctx2d.font = `${challenge.df}px monospace`;
                    domWidth = ctx2d.measureText(challenge.dt).width;
                } catch { }

                try {
                    const glCv = document.createElement('canvas');
                    glCv.width = 4; glCv.height = 4;
                    const gl = glCv.getContext('webgl') || glCv.getContext('experimental-webgl');
                    if (gl) {
                        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                        glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
                        const [cr, cg, cb] = challenge.gc;
                        gl.clearColor(cr, cg, cb, 1);
                        gl.clear(gl.COLOR_BUFFER_BIT);
                        const px = new Uint8Array(4);
                        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                        glPixel = [px[0], px[1], px[2]];
                    }
                } catch { }

                // Step 3: Request task with PoW + Canvas 2D + WebGL proof
                const token = localStorage.getItem('token');
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const taskRes = await fetch(`${API}/task`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        challengeId: challenge.c,
                        powNonce,
                        domWidth,
                        glRenderer,
                        glPixel,
                        visitorId,
                        botDetection: botDetectionResult,
                        probes: probeData,
                        behavioral: getBehavioralData(),
                    }),
                });

                if (taskRes.status === 404) {
                    if (!cancelled) setError('Hiện tại không có nhiệm vụ nào. Vui lòng thử lại sau.');
                    return;
                }
                if (taskRes.status === 429) {
                    const errData = await taskRes.json();
                    if (!cancelled) setError(errData.error || 'Bạn đã đạt giới hạn lượt vượt link hôm nay.');
                    return;
                }
                if (!taskRes.ok) throw new Error('Không thể lấy nhiệm vụ');

                const taskData = await taskRes.json();

                if (!cancelled) {
                    setTask(taskData);
                }
            } catch (err) {
                if (!cancelled) setError(err.message || 'Đã xảy ra lỗi');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []); // run once on mount

    /* ─── Verify code entered by user ─────────────── */
    const handleVerify = useCallback(async () => {
        if (!inputCode.trim() || inputCode.trim().length < 4) {
            setShowError(true);
            setError('Vui lòng nhập mã xác nhận.');
            setTimeout(() => setShowError(false), 3000);
            return;
        }

        // Verify code via API — server checks against code_given in vuot_link_tasks
        setCompleting(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API}/task/${task.id}/verify`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ code: inputCode.trim(), _tk: task._tk }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Mã xác nhận không đúng');
            }

            setCompletionResult(data);
            setVerified(true);
            setShowError(false);
        } catch (err) {
            setShowError(true);
            setError(err.message);
            setTimeout(() => setShowError(false), 5000);
        } finally {
            setCompleting(false);
        }
    }, [inputCode, task]);

    /* ─── Derived ──────────────────────────────────── */
    const keyword = task?.keyword || '';
    const campaignImage = task?.image1_url || '';
    const campaignImage2 = task?.image2_url || '';
    const hasMultiSite = !!(campaignImage2);
    const waitTime_ = task?.waitTime || waitTime || 60;
    const widgetConfig = task?.widgetConfig || null;

    /* ─── Loading ──────────────────────────────────────── */
    if (loading) return (
        <Wrapper>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#64748b', fontWeight: 500 }}>Đang tải nhiệm vụ...</p>
            </div>
        </Wrapper>
    );

    /* ─── Incognito (check FIRST — incognito may also trigger adblock) ── */
    if (isIncognito) return (
        <Wrapper>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px', textAlign: 'center', padding: '0 24px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#fff7ed', border: '2px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={32} style={{ color: '#f97316' }} />
                </div>
                <h2 style={{ color: '#1e3a6e', fontWeight: 800, margin: 0 }}>Không hỗ trợ trình duyệt ẩn danh</h2>
                <p style={{ color: '#64748b', margin: 0 }}>Vui lòng mở bằng cửa sổ trình duyệt bình thường.</p>
            </div>
        </Wrapper>
    );

    /* ─── Ad Blocker ───────────────────────────────────── */
    if (isAdBlock) return (
        <Wrapper>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px', textAlign: 'center', padding: '0 24px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#fef2f2', border: '2px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldOff size={32} style={{ color: '#ef4444' }} />
                </div>
                <h2 style={{ color: '#1e3a6e', fontWeight: 800, margin: 0 }}>Vui lòng tắt trình chặn quảng cáo</h2>
                <p style={{ color: '#64748b', margin: 0, maxWidth: '400px', lineHeight: 1.6 }}>
                    Hệ thống phát hiện bạn đang sử dụng tiện ích chặn quảng cáo (AdBlock, uBlock, ...).<br />
                    Vui lòng <strong>tắt trình chặn quảng cáo</strong> rồi tải lại trang để tiếp tục vượt link.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', maxWidth: '380px', width: '100%' }}>
                    <p style={{ color: '#475569', fontSize: '13px', fontWeight: 700, margin: 0 }}>Cách tắt:</p>
                    {['Nhấn vào biểu tượng tiện ích (puzzle) trên thanh trình duyệt', 'Tìm AdBlock / uBlock Origin', 'Chọn "Tạm dừng" hoặc "Tắt trên trang này"', 'Tải lại trang (F5)'].map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ color: '#fff', fontSize: '10px', fontWeight: 900 }}>{i + 1}</span>
                            </div>
                            <span style={{ color: '#475569', fontSize: '12px' }}>{t}</span>
                        </div>
                    ))}
                </div>
                <Btn onClick={() => window.location.reload()}>Tải lại trang</Btn>
            </div>
        </Wrapper>
    );

    /* ─── Error ────────────────────────────────────────── */
    if (error && !task) return (
        <Wrapper>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px', textAlign: 'center', padding: '0 24px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#fef2f2', border: '2px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <WifiOff size={32} style={{ color: '#ef4444' }} />
                </div>
                <h2 style={{ color: '#1e3a6e', fontWeight: 800, margin: 0 }}>Không thể tải nhiệm vụ</h2>
                <p style={{ color: '#64748b', margin: 0 }}>{error}</p>
                <Btn onClick={() => window.location.reload()}>Thử lại</Btn>
            </div>
        </Wrapper>
    );

    /* ─── Main UI ──────────────────────────────────────── */
    return (
        <Wrapper>
            {/* Title */}
            <div style={{ textAlign: 'center', padding: '40px 16px 28px', maxWidth: '720px', margin: '0 auto' }}>
                <h1 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, color: '#1e3a6e', margin: '0 0 6px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                    HƯỚNG DẪN VƯỢT LINK CHI TIẾT
                </h1>
                <p style={{ color: '#3b5ea6', fontSize: '13px', fontWeight: 600, margin: '0 0 6px', letterSpacing: '0.3px' }}>
                    CUỘN XUỐNG ĐỂ THỰC HIỆN CÁC BƯỚC
                </p>
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                    Vui lòng thực hiện theo thứ tự từng bước trên trang để hoàn tất nhiệm vụ.
                </p>
            </div>

            {/* Two-column layout — responsive: hide timeline on mobile */}
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px 48px' }}>
                <div className="vl-grid" style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '0 8px', alignItems: 'start' }}>

                    {/* LEFT: Sticky timeline */}
                    <div className="vl-timeline" style={{ position: 'sticky', top: '80px', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {[1, 2, 3, 4].map((n, i) => (
                                <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        background: verified ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: verified ? '0 0 0 3px rgba(34,197,94,0.18)' : '0 0 0 3px rgba(59,130,246,0.15)',
                                        transition: 'all 0.4s ease', fontSize: '15px', fontWeight: 900, color: '#fff',
                                        flexShrink: 0,
                                    }}>
                                        {verified
                                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                            : n
                                        }
                                    </div>
                                    {i < 3 && (
                                        <div style={{ width: '3px', height: '200px', background: verified ? 'linear-gradient(180deg,#22c55e,#16a34a)' : 'linear-gradient(180deg,#3b82f6,#93c5fd)', margin: '4px 0', borderRadius: '2px', transition: 'all 0.5s ease' }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>


                    {/* RIGHT: All 4 cards always visible */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* ── CARD 1: Mở Google ── */}
                        <StepPanel n={1} title="MỞ GOOGLE" desc="Mở trình duyệt và truy cập trang chủ Google." verified={verified}>
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                                {/* Browser mock */}
                                <div style={{ width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                                    <div style={{ background: '#f1f5f9', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            {['#ef4444', '#f59e0b', '#22c55e'].map(c => <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />)}
                                        </div>
                                        <div style={{ flex: 1, background: '#fff', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Globe size={12} style={{ color: '#3b82f6' }} /> google.com
                                        </div>
                                    </div>
                                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px' }}>
                                            <span style={{ color: '#4285f4' }}>G</span><span style={{ color: '#ea4335' }}>o</span><span style={{ color: '#fbbc04' }}>o</span><span style={{ color: '#4285f4' }}>g</span><span style={{ color: '#34a853' }}>l</span><span style={{ color: '#ea4335' }}>e</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', margin: '16px auto 0', maxWidth: '300px', background: '#fff', border: '1px solid #ddd', borderRadius: '24px', padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                            <Search size={16} style={{ color: '#94a3b8', marginRight: '8px' }} />
                                            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Tìm kiếm...</span>
                                        </div>
                                    </div>
                                </div>
                                <a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', textDecoration: 'none', padding: '11px 28px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
                                    <ExternalLink size={15} /> Mở Google
                                </a>
                            </div>
                        </StepPanel>

                        {/* ── CARD 2: Nhập từ khóa ── */}
                        <StepPanel n={2} title="NHẬP TỪ KHÓA" desc="Tìm kiếm từ khóa bên dưới trên Google." verified={verified}>
                            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '14px', padding: '20px' }}>
                                <p style={{ color: '#92400e', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' }}>Từ khóa tìm kiếm</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1.5px dashed #fb923c', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
                                    <Search size={16} style={{ color: '#f97316', flexShrink: 0 }} />
                                    <span style={{ flex: 1, color: '#ea580c', fontSize: 'clamp(13px,2.5vw,16px)', fontWeight: 700 }}>{keyword || 'traffic user giá rẻ traffic68'}</span>
                                    <CopyBtn keyword={keyword} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {['Copy từ khóa bên trên', 'Dán vào ô tìm kiếm Google', 'Nhấn Enter để tìm kiếm'].map((t, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(249,115,22,0.06)', borderRadius: '8px', padding: '8px 12px' }}>
                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800 }}>{i + 1}</span>
                                            </div>
                                            <span style={{ color: '#374151', fontSize: '13px' }}>{t}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </StepPanel>

                        {/* ── CARD 3: Tìm trang đích ── */}
                        <StepPanel n={3} title="TÌM TRANG ĐÍCH" desc="Tìm trang đích trong kết quả tìm kiếm Google và click vào." verified={verified}>
                            {(campaignImage || campaignImage2) && (
                                <div style={{ marginBottom: '16px' }}>
                                    {hasMultiSite ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '16px' }}>&#x1F4A1;</span>
                                                <p style={{ margin: 0, color: '#1d4ed8', fontSize: '13px', fontWeight: 700 }}>
                                                    Bạn có thể truy cập <strong>1 trong 2 trang web</strong> bất kỳ dưới đây để hoàn thành nhiệm vụ.
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {[{ img: campaignImage, label: 'Trang web 1' }, { img: campaignImage2, label: 'Trang web 2' }].map(({ img, label }, idx) => img ? (
                                                    <div key={idx}>
                                                        <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                                                            🎯 {label}
                                                        </p>
                                                        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '2px solid #e0e7ff', boxShadow: '0 4px 16px rgba(99,102,241,0.1)' }}>
                                                            <img src={img} alt={label} style={{ width: '100%', display: 'block', maxHeight: '200px', objectFit: 'cover', objectPosition: 'top' }} onError={e => e.target.style.display = 'none'} />
                                                        </div>
                                                    </div>
                                                ) : null)}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                                                🎯 Trang đích cần tìm — giao diện trông giống như hình bên dưới:
                                            </p>
                                            <div style={{ borderRadius: '14px', overflow: 'hidden', border: '2px solid #e0e7ff', boxShadow: '0 4px 20px rgba(99,102,241,0.12)' }}>
                                                <img src={campaignImage} alt="Trang đích" style={{ width: '100%', display: 'block', maxHeight: '340px', objectFit: 'cover', objectPosition: 'top' }} onError={e => e.target.style.display = 'none'} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '14px', padding: '14px' }}>
                                {['Cuộn tìm trong kết quả Google', hasMultiSite ? 'Tìm trang có giao diện giống 1 trong 2 hình trên' : 'Tìm trang có giao diện giống hình trên', 'Click vào kết quả để truy cập trang'].map((t, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(139,92,246,0.06)', borderRadius: '8px', padding: '8px 12px', marginBottom: i < 2 ? '6px' : 0 }}>
                                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800 }}>{i + 1}</span>
                                        </div>
                                        <span style={{ color: '#374151', fontSize: '13px' }}>{t}</span>
                                    </div>
                                ))}
                            </div>
                        </StepPanel>

                        {/* ── CARD 4: Xác nhận ── */}
                        <StepPanel n={4} title="XÁC NHẬN" desc="Nhập mã xác nhận để hoàn tất nhiệm vụ." verified={verified}>
                            {verified ? (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0fef4', border: '3px solid #86efac', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                    <h3 style={{ color: '#16a34a', fontWeight: 800, margin: '0 0 8px' }}>Xác nhận thành công!</h3>
                                    <p style={{ color: '#64748b', margin: '0 0 20px' }}>Bạn đã hoàn thành tất cả các bước. Cảm ơn bạn!</p>
                                    {completionResult?.earning > 0 && (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '12px 24px', marginBottom: '20px' }}>
                                            <span style={{ color: '#64748b', fontSize: '13px' }}>Tiền thưởng:</span>
                                            <span style={{ color: '#f97316', fontSize: '18px', fontWeight: 800 }}>{Number(completionResult.earning).toLocaleString('vi-VN')} VNĐ</span>
                                        </div>
                                    )}
                                    <br />
                                    <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: '12px', fontSize: '14px', fontWeight: 700 }}>
                                        Quay về trang chủ <ArrowRight size={16} />
                                    </Link>
                                </div>
                            ) : (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                    {/* ── Flow steps ── */}
                                    {[
                                        {
                                            num: '1', color: '#3b82f6', label: 'Cuộn & tìm nút',
                                            content: (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '12px', color: '#64748b' }}>Nút trông như thế này trên trang đích:</span>
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                        background: widgetConfig?.buttonColor || '#f97316',
                                                        color: widgetConfig?.textColor || '#fff',
                                                        borderRadius: `${widgetConfig?.borderRadius ?? 50}px`,
                                                        fontSize: `${widgetConfig?.fontSize || 15}px`,
                                                        fontWeight: 700,
                                                        padding: '8px 16px',
                                                        boxShadow: `0 4px 16px ${(widgetConfig?.buttonColor || '#f97316')}55`,
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
                                            num: '2', color: '#f97316', label: 'Chờ đủ thời gian → bấm nút → sao chép mã',
                                            content: (
                                                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                                                    Khi nút kích hoạt, bấm vào — popup sẽ hiện mã. Sao chép mã rồi quay lại đây.
                                                </p>
                                            ),
                                        },
                                    ].map(({ num, color, label, content }) => (
                                        <div key={num} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                                                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 900 }}>{num}</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '11px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>{label}</p>
                                                {content}
                                            </div>
                                        </div>
                                    ))}

                                    {/* ── Divider ── */}
                                    <div style={{ borderTop: '1.5px dashed #bbf7d0', margin: '0' }} />

                                    {/* ── Code input ── */}
                                    <div>
                                        <p style={{ color: '#16a34a', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#22c55e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', fontWeight: 900, flexShrink: 0 }}>3</span>
                                            Nhập mã xác nhận
                                        </p>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                            <input type="text" maxLength={6} value={inputCode}
                                                onChange={e => setInputCode(e.target.value.toUpperCase())}
                                                disabled={completing} placeholder="Nhập mã tại đây"
                                                style={{ flex: 1, padding: '12px 14px', background: '#fff', border: `1.5px solid ${showError ? '#fca5a5' : '#86efac'}`, borderRadius: '10px', outline: 'none', color: '#1e293b', fontSize: '15px', fontWeight: 600, letterSpacing: '2px', textAlign: 'center' }}
                                            />
                                            <button onClick={handleVerify} disabled={inputCode.length < 4 || completing}
                                                style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: inputCode.length >= 4 && !completing ? 'linear-gradient(135deg,#22c55e,#16a34a)' : '#e2e8f0', color: inputCode.length >= 4 ? '#fff' : '#94a3b8', fontSize: '13px', fontWeight: 700, cursor: inputCode.length >= 4 && !completing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                                                {completing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                                {completing ? 'Đang xử lý...' : 'Xác nhận'}
                                            </button>
                                        </div>
                                        {showError && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px' }}>
                                                <AlertCircle size={14} style={{ color: '#ef4444' }} />
                                                <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 500 }}>{error || 'Mã xác nhận không đúng.'}</span>
                                            </div>
                                        )}
                                        <OrangeBtn onClick={handleVerify} disabled={inputCode.length < 4 || completing}>
                                            {completing ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN VÀ HOÀN TẤT →'}
                                        </OrangeBtn>
                                    </div>
                                </div>
                            )}
                        </StepPanel>
                    </div>
                </div>{/* end grid */}
            </div>{/* end outer */}

            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes glow { 0%,100%{box-shadow:0 6px 24px rgba(249,115,22,0.4)} 50%{box-shadow:0 8px 36px rgba(249,115,22,0.6)} }
                @media(max-width:540px) {
                    .vl-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
                    .vl-timeline { display: none !important; }
                }
            `}</style>
        </Wrapper>
    );
}

/* ─── Wrapper ─────────────────────────────────────────── */
function Wrapper({ children }) {
    return (
        <div style={{ background: 'linear-gradient(160deg,#dbeafe 0%,#eff6ff 40%,#f0f9ff 70%,#f8fafc 100%)', fontFamily: "'Inter',sans-serif", position: 'relative' }}>
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
                <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
                    <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e3a6e" strokeWidth="1" /></pattern></defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </div>
    );
}

/* ─── StepPanel ── always visible, no locking ─────────── */
function StepPanel({ n, title, desc, verified, children }) {
    const colors = { 1: '#3b82f6', 2: '#f97316', 3: '#7c3aed', 4: '#22c55e' };
    const c = colors[n];
    return (
        <div style={{
            background: '#fff', border: `2px solid ${verified ? '#86efac' : n === 4 ? '#bbf7d0' : '#e2e8f0'}`,
            borderRadius: '20px', padding: 'clamp(20px,3vw,28px)',
            boxShadow: verified ? '0 4px 16px rgba(34,197,94,0.08)' : '0 2px 12px rgba(0,0,0,0.05)',
            transition: 'all 0.4s ease',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: verified ? '#22c55e' : c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${c}40` }}>
                    <span style={{ color: '#fff', fontSize: '14px', fontWeight: 900 }}>{n}</span>
                </div>
                <span style={{ color: verified ? '#16a34a' : c, fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>BƯỚC {n}</span>
                {verified && <span style={{ marginLeft: 'auto', background: '#f0fef4', border: '1px solid #86efac', color: '#16a34a', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px' }}>✓ HOÀN THÀNH</span>}
            </div>
            <h2 style={{ color: verified ? '#16a34a' : c, fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, margin: '0 0 6px' }}>{title}</h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 18px' }}>{desc}</p>
            {children}
        </div>
    );
}

/* ─── OrangeBtn ───────────────────────────────────────── */
function OrangeBtn({ onClick, children, disabled }) {
    return (
        <button onClick={onClick} disabled={disabled}
            style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', background: disabled ? '#e2e8f0' : 'linear-gradient(135deg,#f97316,#ea580c)', color: disabled ? '#94a3b8' : '#fff', fontSize: '14px', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: disabled ? 'none' : '0 6px 24px rgba(249,115,22,0.4)', transition: 'all 0.3s', animation: !disabled ? 'glow 2.5s ease-in-out infinite' : 'none', letterSpacing: '0.3px' }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
        >{children}</button>
    );
}

/* ─── Btn ─────────────────────────────────────────────── */
function Btn({ onClick, children }) {
    return (
        <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
            {children}
        </button>
    );
}

/* ─── CopyBtn ─────────────────────────────────────────── */
function CopyBtn({ keyword }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        if (!keyword) return;
        navigator.clipboard.writeText(keyword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handle} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: copied ? '#f0fef4' : '#fff7ed', border: `1px solid ${copied ? '#86efac' : '#fed7aa'}`, color: copied ? '#16a34a' : '#ea580c', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Đã copy' : 'Copy'}
        </button>
    );
}