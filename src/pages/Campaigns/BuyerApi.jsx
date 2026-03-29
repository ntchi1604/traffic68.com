import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import {
  Code2, Copy, Check, Key, RefreshCw, Eye, EyeOff,
  ChevronDown, ChevronUp, Terminal, BookOpen, Zap,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';

/* ── helper: copy to clipboard ── */
function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

/* ── collapsible endpoint row ── */
function Endpoint({ method, path, desc, children }) {
  const [open, setOpen] = useState(false);
  const colors = { GET: 'bg-green-100 text-green-700', POST: 'bg-blue-100 text-blue-700', PUT: 'bg-amber-100 text-amber-700', DELETE: 'bg-red-100 text-red-700' };
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${colors[method] || 'bg-slate-100 text-slate-700'}`}>{method}</span>
        <code className="text-xs font-mono text-slate-700 flex-1">{path}</code>
        <span className="text-xs text-slate-400 hidden sm:block mr-2">{desc}</span>
        {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">{children}</div>}
    </div>
  );
}

/* ── code block ── */
function Code({ children, lang = 'json', id, copy, copied }) {
  return (
    <div className="relative">
      <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">{children}</pre>
      {copy && (
        <button onClick={() => copy(children, id)}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition">
          {copied === id ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-slate-400" />}
        </button>
      )}
    </div>
  );
}

function Field({ name, type, required, desc }) {
  return (
    <tr className="border-b border-slate-50 text-xs">
      <td className="py-2 pr-3"><code className="px-1.5 py-0.5 bg-slate-100 rounded font-bold text-slate-700">{name}</code></td>
      <td className="py-2 pr-3 text-slate-400 font-mono">{type}</td>
      <td className="py-2 pr-3">
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${required ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          {required ? 'required' : 'optional'}
        </span>
      </td>
      <td className="py-2 text-slate-500">{desc}</td>
    </tr>
  );
}

export default function BuyerApi() {
  usePageTitle('Buyer API');
  const toast = useToast();
  const { copied, copy } = useCopy();

  const [keyData, setKeyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    try { const d = await api.get('/quicklink/key'); setKeyData(d.key || null); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    setRegenerating(true);
    try { const d = await api.post('/quicklink/key'); setKeyData(d.key); setShowKey(true); toast.success('Tạo API key thành công!'); }
    catch (e) { toast.error(e.message); }
    finally { setRegenerating(false); }
  };

  const regenerateKey = async () => {
    if (!await toast.confirm('Đổi API key? Key cũ sẽ ngừng hoạt động ngay lập tức.')) return;
    setRegenerating(true);
    try { const d = await api.put('/quicklink/key'); setKeyData(d.key); setShowKey(true); toast.success('Đã đổi API key!'); }
    catch (e) { toast.error(e.message); }
    finally { setRegenerating(false); }
  };

  const maskKey = k => k ? k.slice(0, 10) + '•'.repeat(k.length - 14) + k.slice(-4) : '';
  const BASE = window.location.origin;
  const apiKey = keyData?.api_key || 'YOUR_API_KEY';
  const authHeader = `Authorization: Bearer ${apiKey}`;

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/buyer/dashboard' }, { label: 'Buyer API' }]} />
      {/* ── API Key card ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Key size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">API Key</h2>
            <p className="text-slate-400 text-xs">Thêm vào header mọi request: <code className="text-green-400">Authorization: Bearer KEY</code></p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-4">Đang tải...</p>
        ) : !keyData ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 mb-4">Chưa có API key. Tạo key để bắt đầu.</p>
            <button onClick={createKey} disabled={regenerating}
              className="px-6 py-2.5 text-sm font-bold bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition disabled:opacity-50 inline-flex items-center gap-2">
              <Key size={15} /> {regenerating ? 'Đang tạo...' : 'Tạo API key'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-800/60 border border-slate-700 px-4 py-3 rounded-xl text-xs font-mono text-green-400 overflow-x-auto select-all">
              {showKey ? keyData.api_key : maskKey(keyData.api_key)}
            </code>
            <button onClick={() => setShowKey(!showKey)} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition shrink-0">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={() => copy(keyData.api_key, 'key')}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition shrink-0">
              {copied === 'key' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
            <button onClick={regenerateKey} disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition shrink-0 disabled:opacity-50">
              <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} /> Đổi key
            </button>
          </div>
        )}
      </div>

      {/* ── Quick start ── */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-5">
        <h3 className="text-sm font-black text-violet-900 mb-2 flex items-center gap-2">
          <Zap size={16} className="text-violet-500" /> Quick Start
        </h3>
        <p className="text-xs text-violet-700 mb-3">Base URL: <code className="font-mono font-bold">{BASE}/api/buyer/v1</code></p>
        <Code id="qs" copy={copy} copied={copied}>{`curl ${BASE}/api/buyer/v1/me \\
  -H "Authorization: Bearer ${apiKey}"
`}</Code>
      </div>

      {/* ── Endpoints ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BookOpen size={18} className="text-slate-500" /> API Reference
        </h2>

        {/* GET /me */}
        <Endpoint method="GET" path="/api/buyer/v1/me" desc="Tài khoản + số dư">
          <p className="text-xs text-slate-500">Lấy thông tin tài khoản và số dư ví.</p>
          <Code id="me-req" copy={copy} copied={copied}>{`curl ${BASE}/api/buyer/v1/me \\
  -H "${authHeader}"`}</Code>
          <Code id="me-res">{`{
  "user": { "id": 42, "name": "Nguyễn A", "email": "a@example.com" },
  "wallet": {
    "main_balance": 500000,
    "earning_balance": 0
  },
  "campaigns": {
    "total": 5, "running": 2, "paused": 1, "completed": 2,
    "total_budget_allocated": 3000000
  }
}`}</Code>
        </Endpoint>

        {/* GET /pricing */}
        <Endpoint method="GET" path="/api/buyer/v1/pricing" desc="Bảng giá">
          <Code id="pricing-req" copy={copy} copied={copied}>{`curl ${BASE}/api/buyer/v1/pricing \\
  -H "${authHeader}"`}</Code>
          <Code id="pricing-res">{`{
  "pricing": {
    "google_search": [
      { "duration_seconds": 60, "price_v1_per_view": 50, "price_v2_per_view": 80 },
      { "duration_seconds": 120, "price_v1_per_view": 90, "price_v2_per_view": 140 }
    ],
    "direct": [...]
  },
  "currency": "VND"
}`}</Code>
        </Endpoint>

        {/* GET /campaigns */}
        <Endpoint method="GET" path="/api/buyer/v1/campaigns" desc="Danh sách chiến dịch">
          <p className="text-xs text-slate-500 mb-2">Query params: <code className="bg-slate-100 px-1 rounded font-mono text-[10px]">status=running|paused|completed</code>, <code className="bg-slate-100 px-1 rounded font-mono text-[10px]">page</code>, <code className="bg-slate-100 px-1 rounded font-mono text-[10px]">limit</code></p>
          <Code id="list-req" copy={copy} copied={copied}>{`curl "${BASE}/api/buyer/v1/campaigns?status=running&page=1&limit=20" \\
  -H "${authHeader}"`}</Code>
          <Code id="list-res">{`{
  "campaigns": [
    {
      "id": 1, "name": "SEO Game Bài", "url": "https://example.com",
      "traffic_type": "google_search", "version": "v1",
      "status": "running", "total_views": 1000,
      "budget": 50000, "cpc": 50,
      "completed_views": 312, "cost_spent": 15600
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}`}</Code>
        </Endpoint>

        {/* POST /campaigns */}
        <Endpoint method="POST" path="/api/buyer/v1/campaigns" desc="Tạo chiến dịch mới">
          <table className="w-full text-xs mb-3">
            <thead><tr className="text-left text-[10px] text-slate-400 uppercase border-b"><th className="pb-1.5 pr-2">Field</th><th className="pb-1.5 pr-2">Type</th><th className="pb-1.5 pr-2">Required</th><th className="pb-1.5">Mô tả</th></tr></thead>
            <tbody>
              <Field name="name" type="string" required desc="Tên chiến dịch" />
              <Field name="url" type="string" required desc="URL trang cần tăng traffic" />
              <Field name="traffic_type" type="string" required desc="google_search | direct | social" />
              <Field name="total_views" type="number" required desc="Tổng lượt xem (min 100)" />
              <Field name="duration" type="number" required desc="Thời gian xem (giây). Xem /pricing để biết các mốc hợp lệ" />
              <Field name="version" type="string" desc="v1 (default) | v2 — kiểu traffic" />
              <Field name="keyword" type="string" desc="Từ khóa tìm kiếm (cho google_search)" />
              <Field name="daily_views" type="number" desc="Số lượt tối đa mỗi ngày (default 500)" />
              <Field name="url2" type="string" desc="URL trang phụ (v2 multi-step)" />
            </tbody>
          </table>
          <Code id="create-req" copy={copy} copied={copied}>{`curl -X POST ${BASE}/api/buyer/v1/campaigns \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "SEO từ khóa game bài",
    "url": "https://example.com",
    "traffic_type": "google_search",
    "keyword": "game bài đổi thưởng",
    "total_views": 1000,
    "duration": 60,
    "version": "v1"
  }'`}</Code>
          <Code id="create-res">{`{
  "message": "Campaign created successfully",
  "campaign": {
    "id": 7, "name": "SEO từ khóa game bài",
    "status": "running", "total_views": 1000,
    "budget": 50000, "cpc": 50, "currency": "VND",
    "note": "Budget is deducted as views are completed, not upfront."
  }
}`}</Code>
        </Endpoint>

        {/* GET /campaigns/:id */}
        <Endpoint method="GET" path="/api/buyer/v1/campaigns/:id" desc="Chi tiết + stats">
          <Code id="detail-req" copy={copy} copied={copied}>{`curl ${BASE}/api/buyer/v1/campaigns/7 \\
  -H "${authHeader}"`}</Code>
          <Code id="detail-res">{`{
  "id": 7, "name": "SEO từ khóa game bài",
  "status": "running", "budget": 50000, "cpc": 50,
  "stats": {
    "completed_views": 312,
    "expired": 44,
    "bot_blocked": 5,
    "cost_spent": 15600,
    "remaining_budget": 34400
  }
}`}</Code>
        </Endpoint>

        {/* PUT /campaigns/:id/status */}
        <Endpoint method="PUT" path="/api/buyer/v1/campaigns/:id/status" desc="Pause / Resume">
          <Code id="status-req" copy={copy} copied={copied}>{`# Dừng chiến dịch
curl -X PUT ${BASE}/api/buyer/v1/campaigns/7/status \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "paused"}'

# Tiếp tục
curl -X PUT ${BASE}/api/buyer/v1/campaigns/7/status \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "running"}'`}</Code>
        </Endpoint>

        {/* GET /campaigns/:id/stats */}
        <Endpoint method="GET" path="/api/buyer/v1/campaigns/:id/stats" desc="Thống kê theo ngày">
          <p className="text-xs text-slate-500 mb-2">Query params: <code className="bg-slate-100 px-1 rounded font-mono text-[10px]">days=7</code> (max 30)</p>
          <Code id="stats-req" copy={copy} copied={copied}>{`curl "${BASE}/api/buyer/v1/campaigns/7/stats?days=7" \\
  -H "${authHeader}"`}</Code>
          <Code id="stats-res">{`{
  "campaign_id": 7,
  "days": 7,
  "daily": [
    { "date": "2026-03-27", "completed_views": 80, "expired": 5, "bot_blocked": 1, "cost": 4000 },
    { "date": "2026-03-26", "completed_views": 95, "expired": 7, "bot_blocked": 0, "cost": 4750 }
  ],
  "totals": { "completed_views": 312, "cost": 15600 }
}`}</Code>
        </Endpoint>
      </div>

      {/* ── Error codes ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Code2 size={15} className="text-slate-500" /> HTTP Status Codes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-400 text-[10px] uppercase border-b border-slate-100">
              <th className="py-2 pr-4">Code</th><th className="py-2 pr-4">Ý nghĩa</th><th className="py-2">Khi nào</th>
            </tr></thead>
            <tbody>
              {[
                ['200', 'OK', 'Thành công'],
                ['201', 'Created', 'Tạo chiến dịch thành công'],
                ['400', 'Bad Request', 'Thiếu/sai tham số (name, url, traffic_type...)'],
                ['401', 'Unauthorized', 'Thiếu hoặc sai API key'],
                ['402', 'Payment Required', 'Số dư ví không đủ để tạo chiến dịch'],
                ['403', 'Forbidden', 'Tài khoản bị khóa'],
                ['404', 'Not Found', 'Chiến dịch không tồn tại hoặc không thuộc tài khoản'],
                ['500', 'Server Error', 'Lỗi hệ thống'],
              ].map(([code, name, desc]) => (
                <tr key={code} className="border-b border-slate-50">
                  <td className="py-2 pr-4"><span className={`px-2 py-0.5 rounded font-bold text-[10px] ${code.startsWith('2') ? 'bg-green-100 text-green-700' : code.startsWith('4') ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{code}</span></td>
                  <td className="py-2 pr-4 font-semibold text-slate-700">{name}</td>
                  <td className="py-2 text-slate-500">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-5">
        <h3 className="text-sm font-black text-violet-900 mb-2">Lưu ý quan trọng</h3>
        <ul className="text-xs text-violet-800 space-y-1.5 list-disc pl-4">
          <li>Budget <strong>không bị trừ ngay</strong> khi tạo chiến dịch — trừ dần theo từng lượt xem hoàn thành.</li>
          <li>Dùng <code className="bg-white/70 px-1 rounded font-mono">/v1/pricing</code> để lấy <code className="bg-white/70 px-1 rounded font-mono">duration</code> hợp lệ trước khi tạo chiến dịch.</li>
          <li>API key <strong>dùng chung</strong> với Worker API (cùng bảng <code className="bg-white/70 px-1 rounded font-mono">api_keys</code>). Nếu đổi key, cả 2 đều thay đổi.</li>
          <li>Mỗi tài khoản chỉ có <strong>1 API key</strong>.</li>
          <li>Rate limit: <strong>1000 requests/giờ</strong> (sắp ra mắt).</li>
        </ul>
      </div>
    </div>
  );
}
